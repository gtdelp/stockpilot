import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, firstValueFrom, forkJoin, pipe, switchMap, tap } from 'rxjs';
import { Category, Product, ProductInput, Supplier, toApiError } from '../../core/models';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductFilter, ProductsService } from '../../core/services/products.service';

/** Estado de la vista de productos. */
interface ProductsState {
  /** Lista de productos. */
  products: Product[];
  /** Lista de categorías. */
  categories: Category[];
  /** Lista de proveedores. */
  suppliers: Supplier[];
  /** `true` mientras se cargan datos. */
  loading: boolean;
  /** Último mensaje de error o `null`. */
  error: string | null;
}

/**
 * ViewModel de productos (NgRx SignalStore de ámbito de página).
 * Carga productos y datos maestros en paralelo y expone operaciones CRUD.
 */
export const ProductsStore = signalStore(
  withState<ProductsState>({
    products: [],
    categories: [],
    suppliers: [],
    loading: true,
    error: null,
  }),
  withComputed(({ products }) => ({
    /** Número de productos en stock bajo. */
    lowStockCount: computed(
      () => products().filter((product) => product.stock <= product.minStock).length,
    ),
  })),
  withMethods((store, api = inject(ProductsService), catalog = inject(CatalogService)) => ({
    /** Carga (o recarga) productos con filtros y los datos maestros. */
    load: rxMethod<ProductFilter>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((filter) =>
          forkJoin({
            products: api.list(filter),
            categories: catalog.categories(),
            suppliers: catalog.suppliers(),
          }).pipe(
            tap((result) => patchState(store, { ...result, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),

    /** Crea o actualiza un producto y actualiza la lista sin recargar. */
    async save(input: ProductInput, id?: number): Promise<Product> {
      const saved = await firstValueFrom(id ? api.update(id, input) : api.create(input));
      const exists = store.products().some((product) => product.id === saved.id);
      patchState(store, {
        products: exists
          ? store.products().map((product) => (product.id === saved.id ? saved : product))
          : [...store.products(), saved],
      });
      return saved;
    },

    /** Elimina un producto. */
    async remove(id: number): Promise<void> {
      await firstValueFrom(api.remove(id));
      patchState(store, { products: store.products().filter((product) => product.id !== id) });
    },
  })),
);
