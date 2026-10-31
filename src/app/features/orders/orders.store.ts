import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { Order, OrderFilter, OrderStatus, toApiError } from '../../core/models';
import { OrdersService } from '../../core/services/orders.service';

/** Estado del listado de pedidos. */
interface OrdersState {
  /** Número de pedidos o lista de pedidos. */
  orders: Order[];
  /** `true` mientras se cargan datos. */
  loading: boolean;
  /** Último mensaje de error o `null`. */
  error: string | null;
}

/**
 * ViewModel del listado de pedidos (NgRx SignalStore de ámbito de página).
 */
export const OrdersStore = signalStore(
  withState<OrdersState>({ orders: [], loading: true, error: null }),
  withMethods((store, api = inject(OrdersService)) => ({
    /** Carga los pedidos para cada filtro emitido (cancela peticiones obsoletas). */
    load: rxMethod<OrderFilter>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((filter) =>
          api.list(filter).pipe(
            tap((orders) => patchState(store, { orders, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),

    /** Cambia el estado de un pedido y actualiza la lista. */
    async updateStatus(id: number, status: OrderStatus): Promise<Order> {
      const updated = await firstValueFrom(api.updateStatus(id, status));
      patchState(store, {
        orders: store
          .orders()
          .map((order) => (order.id === id ? { ...order, status: updated.status } : order)),
      });
      return updated;
    },
  })),
);
