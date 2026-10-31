import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { silentContext } from '../interceptors/http-context';
import { Category, CategoryInput, Supplier, SupplierInput } from '../models';

/**
 * Acceso a la API REST de datos maestros: categorías y proveedores.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Lista las categorías. */
  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  /** Crea o actualiza una categoría. */
  saveCategory(input: CategoryInput, id?: number): Observable<Category> {
    return id
      ? this.http.patch<Category>(`${this.baseUrl}/categories/${id}`, input, {
          context: silentContext(),
        })
      : this.http.post<Category>(`${this.baseUrl}/categories`, input, { context: silentContext() });
  }

  /** Elimina una categoría. */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${id}`, { context: silentContext() });
  }

  /** Lista los proveedores. */
  suppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.baseUrl}/suppliers`);
  }

  /** Crea o actualiza un proveedor. */
  saveSupplier(input: SupplierInput, id?: number): Observable<Supplier> {
    return id
      ? this.http.patch<Supplier>(`${this.baseUrl}/suppliers/${id}`, input, {
          context: silentContext(),
        })
      : this.http.post<Supplier>(`${this.baseUrl}/suppliers`, input, { context: silentContext() });
  }

  /** Elimina un proveedor. */
  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/suppliers/${id}`, { context: silentContext() });
  }
}
