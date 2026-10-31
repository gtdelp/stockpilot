import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { silentContext } from '../interceptors/http-context';
import { AvailabilityResponse, Product, ProductInput } from '../models';
import { toParams } from './http-params';

/** Filtros del listado de productos. */
export interface ProductFilter {
  /** Identificador de la categoría. */
  categoryId?: number | null;
  /** Productos con stock bajo (o filtro de stock bajo). */
  lowStock?: boolean;
}

/**
 * Acceso a la API REST de productos (PostgreSQL).
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  /** Lista productos con filtros opcionales. */
  list(filter: ProductFilter = {}): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl, {
      params: toParams({ categoryId: filter.categoryId, lowStock: filter.lowStock || null }),
    });
  }

  /** Comprueba si un SKU está libre (validación asíncrona). */
  isSkuAvailable(sku: string, excludeId?: number): Observable<boolean> {
    return this.http
      .get<AvailabilityResponse>(`${this.baseUrl}/sku-available`, {
        params: toParams({ sku, excludeId }),
        context: silentContext(),
      })
      .pipe(map((response) => response.available));
  }

  /** Crea un producto. */
  create(input: ProductInput): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, input, { context: silentContext() });
  }

  /** Actualiza un producto. */
  update(id: number, input: ProductInput): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, input, { context: silentContext() });
  }

  /** Elimina un producto. */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { context: silentContext() });
  }
}
