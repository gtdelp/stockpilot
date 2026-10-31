import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { ModalController } from '@ionic/angular/modal-controller';
import { AuthStore } from '../../core/auth/auth.store';
import { ORDER_STATUS_LABELS, ORDER_STATUSES, Order, OrderStatus } from '../../core/models';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { ExportColumn } from '../../core/utils/csv';
import { formatCurrency, formatDate, formatDateTime } from '../../core/utils/format';
import {
  DataTableComponent,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ExportMenuComponent } from '../../shared/components/export-menu/export-menu.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';
import { OrderDetailModal } from './order-detail.modal';
import { OrdersStore } from './orders.store';

/**
 * Listado de pedidos: todos para el Administrador, los propios para el Usuario estándar.
 */
@Component({
  selector: 'app-orders-page',
  imports: [
    FormsModule,
    RouterLink,
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    PageHeaderComponent,
    DataTableComponent,
    ExportMenuComponent,
    EmptyStateComponent,
  ],
  providers: [OrdersStore],
  templateUrl: './orders.page.html',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  protected readonly store = inject(OrdersStore);
  protected readonly auth = inject(AuthStore);
  protected readonly help = inject(HelpService);
  private readonly modals = inject(ModalController);
  private readonly reports = inject(ReportService);
  private readonly toast = inject(ToastService);

  // --- Filtros (two-way binding) ---
  protected readonly status = signal<OrderStatus | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');

  protected readonly visibleRows = signal<Order[]>([]);
  protected readonly exporting = signal(false);
  protected readonly statuses = ORDER_STATUSES.map((value) => ({
    value,
    label: ORDER_STATUS_LABELS[value],
  }));

  private readonly filter = computed(() => ({
    status: this.status(),
    from: this.from() || null,
    to: this.to() || null,
  }));

  /** Columnas: la de cliente solo tiene sentido para el administrador. */
  protected readonly columns = computed<TableColumn<Order>[]>(() => [
    { key: 'id', header: 'Pedido', value: (row) => `#${row.id}`, sortable: true, primary: true },
    { key: 'date', header: 'Fecha', value: (row) => row.createdAt, type: 'date', sortable: true },
    ...(this.auth.isAdmin()
      ? [
          {
            key: 'customer',
            header: 'Cliente',
            value: (row: Order) => row.customerName,
            sortable: true,
          },
        ]
      : []),
    {
      key: 'items',
      header: 'Unidades',
      value: (row) => row.itemCount,
      type: 'number',
      sortable: true,
      hideOnMobile: true,
    },
    { key: 'total', header: 'Total', value: (row) => row.total, type: 'currency', sortable: true },
    {
      key: 'status',
      header: 'Estado',
      value: (row) => ORDER_STATUS_LABELS[row.status],
      type: 'badge',
      sortable: true,
      badge: (row) => ({ label: ORDER_STATUS_LABELS[row.status], variant: row.status }),
    },
  ]);

  protected readonly rowKey = (row: Order): number => row.id;

  private readonly exportColumns = computed<ExportColumn<Order>[]>(() => [
    { header: 'Pedido', value: (row) => row.id },
    { header: 'Fecha', value: (row) => formatDateTime(row.createdAt) },
    ...(this.auth.isAdmin()
      ? [{ header: 'Cliente', value: (row: Order) => row.customerName }]
      : []),
    { header: 'Unidades', value: (row) => row.itemCount, align: 'right' as const },
    { header: 'Total', value: (row) => row.total, align: 'right' as const },
    { header: 'Estado', value: (row) => ORDER_STATUS_LABELS[row.status] },
  ]);

  constructor() {
    this.store.load(this.filter);
  }

  /** Recarga tras un error. */
  protected retry(): void {
    this.store.load(this.filter());
  }

  /** Limpia los filtros. */
  protected clearFilters(): void {
    this.status.set(null);
    this.from.set('');
    this.to.set('');
    this.search.set('');
  }

  /** Abre el detalle de un pedido. */
  protected async open(order: Order): Promise<void> {
    const modal = await this.modals.create({
      component: OrderDetailModal,
      componentProps: {
        orderId: order.id,
        canManage: this.auth.isAdmin(),
        onStatusChange: (id: number, status: OrderStatus) => this.store.updateStatus(id, status),
      },
      cssClass: 'sp-modal',
    });
    await modal.present();
    const { role, data } = await modal.onDidDismiss<OrderStatus>();
    if (role === 'save' && data) {
      void this.toast.success(`Pedido #${order.id}: ${ORDER_STATUS_LABELS[data]}.`);
    }
  }

  /** Exporta las filas visibles a CSV. */
  protected exportCsv(): void {
    const file = this.reports.exportCsv({
      entity: 'pedidos',
      columns: this.exportColumns(),
      rows: this.visibleRows(),
    });
    void this.toast.success(`Descargado ${file}`);
  }

  /** Exporta las filas visibles a PDF. */
  protected async exportPdf(): Promise<void> {
    const rows = this.visibleRows();
    const columns = this.exportColumns().map((column) =>
      column.header === 'Total'
        ? { ...column, value: (row: Order) => formatCurrency(row.total) }
        : column,
    );
    this.exporting.set(true);
    try {
      const totals = columns.map((column, index) =>
        index === 0
          ? 'Total'
          : column.header === 'Total'
            ? formatCurrency(rows.reduce((sum, row) => sum + row.total, 0))
            : '',
      );
      const file = await this.reports.exportPdf({
        title: this.auth.isAdmin() ? 'Listado de pedidos' : 'Mis pedidos',
        entity: 'pedidos',
        author: this.auth.profile()?.fullName,
        filters: this.describeFilters(),
        columns,
        rows,
        totals,
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
    const status = this.status();
    if (status) {
      filters.push(`Estado: ${ORDER_STATUS_LABELS[status]}`);
    }
    if (this.from()) {
      filters.push(`Desde: ${formatDate(this.from())}`);
    }
    if (this.to()) {
      filters.push(`Hasta: ${formatDate(this.to())}`);
    }
    if (this.search()) {
      filters.push(`Búsqueda: "${this.search()}"`);
    }
    return filters;
  }
}
