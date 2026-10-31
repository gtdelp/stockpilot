import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { AuthStore } from '../../core/auth/auth.store';
import { Product, ProductInput, isLowStock, toApiError } from '../../core/models';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { ExportColumn } from '../../core/utils/csv';
import { formatCurrency, formatNumber } from '../../core/utils/format';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm.service';
import {
  DataTableComponent,
  RowActionEvent,
  TableAction,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ExportMenuComponent } from '../../shared/components/export-menu/export-menu.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';
import { ProductFormModal } from './product-form.modal';
import { ProductsStore } from './products.store';

/**
 * Inventario de productos. El Administrador puede crear, editar y eliminar;
 * el Usuario estándar lo consulta como catálogo.
 */
@Component({
  selector: 'app-products-page',
  imports: [
    FormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonToggle,
    PageHeaderComponent,
    DataTableComponent,
    ExportMenuComponent,
    EmptyStateComponent,
  ],
  providers: [ProductsStore],
  templateUrl: './products.page.html',
  styleUrl: './products.page.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  protected readonly store = inject(ProductsStore);
  protected readonly auth = inject(AuthStore);
  protected readonly help = inject(HelpService);
  private readonly modals = inject(ModalController);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly reports = inject(ReportService);
  private readonly router = inject(Router);

  // --- Filtros (two-way binding) ---
  protected readonly categoryId = signal<number | null>(null);
  protected readonly lowStockOnly = signal(false);
  /** Búsqueda enlazada en ambos sentidos con la tabla: `[(search)]`. */
  protected readonly search = signal('');

  /** Filas visibles en la tabla (para exportar exactamente lo que se ve). */
  protected readonly visibleRows = signal<Product[]>([]);
  protected readonly exporting = signal(false);

  /** Filtro reactivo que dispara la carga en el store. */
  private readonly filter = computed(() => ({
    categoryId: this.categoryId(),
    lowStock: this.lowStockOnly(),
  }));

  protected readonly columns: TableColumn<Product>[] = [
    { key: 'sku', header: 'SKU', value: (row) => row.sku, sortable: true },
    { key: 'name', header: 'Producto', value: (row) => row.name, sortable: true, primary: true },
    { key: 'category', header: 'Categoría', value: (row) => row.categoryName, sortable: true },
    {
      key: 'supplier',
      header: 'Proveedor',
      value: (row) => row.supplierName,
      sortable: true,
      hideOnMobile: true,
    },
    { key: 'price', header: 'Precio', value: (row) => row.price, type: 'currency', sortable: true },
    { key: 'stock', header: 'Stock', value: (row) => row.stock, type: 'number', sortable: true },
    {
      key: 'status',
      header: 'Estado',
      value: (row) => (row.active ? (isLowStock(row) ? 'Stock bajo' : 'Disponible') : 'Inactivo'),
      type: 'badge',
      badge: (row) =>
        !row.active
          ? { label: 'Inactivo', variant: 'neutral' }
          : isLowStock(row)
            ? { label: 'Stock bajo', variant: 'pending' }
            : { label: 'Disponible', variant: 'shipped' },
    },
  ];

  protected readonly adminActions: TableAction<Product>[] = [
    { id: 'edit', label: 'Editar', icon: 'create-outline', color: 'primary' },
    { id: 'delete', label: 'Eliminar', icon: 'trash-outline', color: 'danger' },
  ];

  protected readonly rowKey = (row: Product): number => row.id;

  private readonly exportColumns: ExportColumn<Product>[] = [
    { header: 'SKU', value: (row) => row.sku },
    { header: 'Producto', value: (row) => row.name },
    { header: 'Categoría', value: (row) => row.categoryName },
    { header: 'Proveedor', value: (row) => row.supplierName },
    { header: 'Precio', value: (row) => row.price, align: 'right' },
    { header: 'Stock', value: (row) => row.stock, align: 'right' },
    { header: 'Stock mínimo', value: (row) => row.minStock, align: 'right' },
    { header: 'Activo', value: (row) => (row.active ? 'Sí' : 'No') },
  ];

  constructor() {
    this.store.load(this.filter);
  }

  /** Recarga tras un error. */
  protected retry(): void {
    this.store.load(this.filter());
  }

  /** Abre el formulario de alta. */
  protected create(): Promise<void> {
    return this.openForm(null);
  }

  /** Gestiona las acciones de fila. */
  protected async onAction(event: RowActionEvent<Product>): Promise<void> {
    if (event.action === 'edit') {
      await this.openForm(event.row);
    } else if (event.action === 'delete') {
      await this.remove(event.row);
    }
  }

  /** Lleva al formulario de pedido (usuario estándar). */
  protected newOrder(): Promise<boolean> {
    return this.router.navigate(['/pedidos/nuevo']);
  }

  /** Exporta las filas visibles a CSV. */
  protected exportCsv(): void {
    const file = this.reports.exportCsv({
      entity: 'productos',
      columns: this.exportColumns,
      rows: this.visibleRows(),
    });
    void this.toast.success(`Descargado ${file}`);
  }

  /** Exporta las filas visibles a PDF. */
  protected async exportPdf(): Promise<void> {
    const rows = this.visibleRows();
    this.exporting.set(true);
    try {
      const file = await this.reports.exportPdf({
        title: 'Inventario de productos',
        entity: 'productos',
        author: this.auth.profile()?.fullName,
        filters: this.describeFilters(),
        columns: this.exportColumns.map((column) =>
          column.header === 'Precio'
            ? { ...column, value: (row: Product) => formatCurrency(row.price) }
            : column,
        ),
        rows,
        totals: [
          'Total',
          '',
          '',
          '',
          '',
          formatNumber(rows.reduce((sum, row) => sum + row.stock, 0)),
          '',
          '',
        ],
      });
      void this.toast.success(`Descargado ${file}`);
    } catch {
      void this.toast.error('No se ha podido generar el PDF.');
    } finally {
      this.exporting.set(false);
    }
  }

  private describeFilters(): string[] {
    const filters: string[] = [];
    const category = this.store.categories().find((item) => item.id === this.categoryId());
    if (category) {
      filters.push(`Categoría: ${category.name}`);
    }
    if (this.lowStockOnly()) {
      filters.push('Solo stock bajo');
    }
    if (this.search()) {
      filters.push(`Búsqueda: "${this.search()}"`);
    }
    return filters;
  }

  private async openForm(product: Product | null): Promise<void> {
    const modal = await this.modals.create({
      component: ProductFormModal,
      componentProps: {
        product,
        categories: this.store.categories(),
        suppliers: this.store.suppliers(),
        onSave: (value: ProductInput, id?: number) => this.store.save(value, id),
      },
      cssClass: 'sp-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'save') {
      void this.toast.success(product ? 'Producto actualizado.' : 'Producto creado.');
    }
  }

  private async remove(product: Product): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar producto',
      message: `¿Seguro que quieres eliminar «${product.name}»? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(product.id);
      void this.toast.success('Producto eliminado.');
    } catch (error) {
      void this.toast.error(toApiError(error).message);
    }
  }
}
