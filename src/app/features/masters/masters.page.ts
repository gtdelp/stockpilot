import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { ModalController } from '@ionic/angular/modal-controller';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Category, CategoryInput, Supplier, SupplierInput, toApiError } from '../../core/models';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm.service';
import {
  DataTableComponent,
  RowActionEvent,
  TableAction,
  TableColumn,
} from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';
import { MasterFormModal, MasterKind } from './master-form.modal';

/**
 * Datos maestros (solo Administrador): categorías y proveedores. Reutiliza
 * la misma tabla con distintas columnas, demostrando su independencia de la vista.
 */
@Component({
  selector: 'app-masters-page',
  imports: [
    FormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    PageHeaderComponent,
    DataTableComponent,
    EmptyStateComponent,
  ],
  templateUrl: './masters.page.html',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MastersPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly modals = inject(ModalController);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly help = inject(HelpService);

  /** Pestaña activa (two-way binding con el segmento). */
  protected readonly tab = signal<MasterKind>('category');
  protected readonly categories = signal<Category[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly categoryKey = (row: Category): number => row.id;
  protected readonly supplierKey = (row: Supplier): number => row.id;

  protected readonly categoryColumns: TableColumn<Category>[] = [
    { key: 'name', header: 'Categoría', value: (row) => row.name, sortable: true, primary: true },
    { key: 'description', header: 'Descripción', value: (row) => row.description },
    {
      key: 'products',
      header: 'Productos',
      value: (row) => row.productCount,
      type: 'number',
      sortable: true,
    },
  ];

  protected readonly supplierColumns: TableColumn<Supplier>[] = [
    { key: 'name', header: 'Proveedor', value: (row) => row.name, sortable: true, primary: true },
    { key: 'email', header: 'Correo', value: (row) => row.email, sortable: true },
    { key: 'phone', header: 'Teléfono', value: (row) => row.phone, hideOnMobile: true },
    { key: 'city', header: 'Ciudad', value: (row) => row.city, sortable: true },
    {
      key: 'products',
      header: 'Productos',
      value: (row) => row.productCount,
      type: 'number',
      sortable: true,
    },
  ];

  protected readonly categoryActions: TableAction<Category>[] = [
    { id: 'edit', label: 'Editar', icon: 'create-outline', color: 'primary' },
    {
      id: 'delete',
      label: 'Eliminar',
      icon: 'trash-outline',
      color: 'danger',
      visible: (row) => row.productCount === 0,
    },
  ];

  protected readonly supplierActions: TableAction<Supplier>[] = [
    { id: 'edit', label: 'Editar', icon: 'create-outline', color: 'primary' },
    {
      id: 'delete',
      label: 'Eliminar',
      icon: 'trash-outline',
      color: 'danger',
      visible: (row) => row.productCount === 0,
    },
  ];

  /** Carga ambas tablas en paralelo. */
  ngOnInit(): void {
    void this.load();
  }

  /** Carga (o recarga) los datos. */
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { categories, suppliers } = await firstValueFrom(
        forkJoin({ categories: this.catalog.categories(), suppliers: this.catalog.suppliers() }),
      );
      this.categories.set(categories);
      this.suppliers.set(suppliers);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Abre el formulario de alta de la pestaña activa. */
  protected create(): Promise<void> {
    return this.openForm(this.tab(), null);
  }

  /** Acciones sobre categorías. */
  protected onCategoryAction(event: RowActionEvent<Category>): Promise<void> {
    return event.action === 'edit'
      ? this.openForm('category', event.row)
      : this.remove('category', event.row);
  }

  /** Acciones sobre proveedores. */
  protected onSupplierAction(event: RowActionEvent<Supplier>): Promise<void> {
    return event.action === 'edit'
      ? this.openForm('supplier', event.row)
      : this.remove('supplier', event.row);
  }

  private async openForm(kind: MasterKind, item: Category | Supplier | null): Promise<void> {
    const modal = await this.modals.create({
      component: MasterFormModal,
      componentProps: {
        kind,
        item,
        onSave: async (value: CategoryInput | SupplierInput, id?: number) => {
          if (kind === 'category') {
            const saved = await firstValueFrom(
              this.catalog.saveCategory(value as CategoryInput, id),
            );
            this.categories.update((list) => upsert(list, saved));
          } else {
            const saved = await firstValueFrom(
              this.catalog.saveSupplier(value as SupplierInput, id),
            );
            this.suppliers.update((list) => upsert(list, saved));
          }
        },
      },
      cssClass: 'sp-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'save') {
      void this.toast.success(item ? 'Cambios guardados.' : 'Registro creado.');
    }
  }

  private async remove(kind: MasterKind, item: Category | Supplier): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: kind === 'category' ? 'Eliminar categoría' : 'Eliminar proveedor',
      message: `¿Seguro que quieres eliminar «${item.name}»?`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      if (kind === 'category') {
        await firstValueFrom(this.catalog.deleteCategory(item.id));
        this.categories.update((list) => list.filter((entry) => entry.id !== item.id));
      } else {
        await firstValueFrom(this.catalog.deleteSupplier(item.id));
        this.suppliers.update((list) => list.filter((entry) => entry.id !== item.id));
      }
      void this.toast.success('Registro eliminado.');
    } catch (error) {
      void this.toast.error(toApiError(error).message);
    }
  }
}

/** Inserta o sustituye un elemento de una lista por su id (inmutable). */
function upsert<T extends { id: number }>(list: T[], item: T): T[] {
  return list.some((entry) => entry.id === item.id)
    ? list.map((entry) => (entry.id === item.id ? item : entry))
    : [...list, item];
}
