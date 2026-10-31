import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { silentContext } from '../interceptors/http-context';
import { Order, OrderFilter, OrderInput, OrderStatus } from '../models';
import { toParams } from './http-params';

/**
 * Acceso a la API REST de pedidos (PostgreSQL).
 * La API devuelve todos los pedidos a un administrador y solo los propios a un usuario.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  /** Lista pedidos con filtros. */
  list(filter: OrderFilter = {}): Observable<Order[]> {
    return this.http.get<Order[]>(this.baseUrl, {
      params: toParams({ status: filter.status, from: filter.from, to: filter.to }),
    });
  }

  /** Detalle de un pedido con sus líneas. */
  get(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  /** Crea un pedido. */
  create(input: OrderInput): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, input, { context: silentContext() });
  }

  /** Cambia el estado de un pedido (solo administradores). */
  updateStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(
      `${this.baseUrl}/${id}/status`,
      { status },
      { context: silentContext() },
    );
  }
}
