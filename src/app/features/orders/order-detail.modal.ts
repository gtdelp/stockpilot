import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { firstValueFrom } from 'rxjs';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  Order,
  OrderStatus,
  toApiError,
} from '../../core/models';
import { OrdersService } from '../../core/services/orders.service';
import { formatCurrency, formatDateTime } from '../../core/utils/format';

/**
 * Detalle de un pedido con sus líneas. El Administrador puede cambiar su estado.
 */
@Component({
  selector: 'app-order-detail-modal',
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    IonSpinner,
  ],
  templateUrl: './order-detail.modal.html',
  styleUrl: './order-detail.modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly orders = inject(OrdersService);

  /** Id del pedido. */
  readonly orderId = input.required<number>();
  /** Permite cambiar el estado (solo administradores). */
  readonly canManage = input(false);
  /** Función que persiste el cambio de estado (la aporta la vista padre). */
  readonly onStatusChange = input<(id: number, status: OrderStatus) => Promise<unknown>>();

  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  /** Estado seleccionado en el selector (two-way binding). */
  protected readonly selectedStatus = signal<OrderStatus>('pending');

  protected readonly statuses = ORDER_STATUSES.map((value) => ({
    value,
    label: ORDER_STATUS_LABELS[value],
  }));
  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly canChange = computed(() => {
    const order = this.order();
    return this.canManage() && order !== null && order.status !== 'cancelled';
  });

  /** Carga el detalle al abrir. */
  async ngOnInit(): Promise<void> {
    try {
      const order = await firstValueFrom(this.orders.get(this.orderId()));
      this.order.set(order);
      this.selectedStatus.set(order.status);
    } catch (error) {
      this.error.set(toApiError(error).message);
    }
  }

  /** Formatea importes. */
  protected currency(value: number): string {
    return formatCurrency(value);
  }

  /** Formatea fechas. */
  protected date(value: string): string {
    return formatDateTime(value);
  }

  /** Cierra el diálogo. */
  protected close(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Guarda el nuevo estado. */
  protected async saveStatus(): Promise<void> {
    const order = this.order();
    const save = this.onStatusChange();
    if (!order || !save || this.selectedStatus() === order.status) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await save(order.id, this.selectedStatus());
      await this.modalCtrl.dismiss(this.selectedStatus(), 'save');
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
