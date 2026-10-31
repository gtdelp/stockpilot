import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, pipe, switchMap, tap } from 'rxjs';
import { DashboardData, StatsFilter, toApiError } from '../../core/models';
import { StatsService } from '../../core/services/stats.service';

/** Estado del cuadro de mando. */
interface DashboardState {
  /** Datos cargados o `null`. */
  data: DashboardData | null;
  /** `true` mientras se cargan datos. */
  loading: boolean;
  /** Último mensaje de error o `null`. */
  error: string | null;
  /** Fecha de la última actualización (ISO 8601). */
  lastUpdated: string | null;
}

/**
 * ViewModel del cuadro de mando (NgRx SignalStore, ámbito de la página).
 * `load` reacciona a un flujo de filtros: cada cambio cancela la petición
 * anterior (`switchMap`) y lanza las cinco consultas en paralelo (`forkJoin`).
 */
export const DashboardStore = signalStore(
  withState<DashboardState>({ data: null, loading: true, error: null, lastUpdated: null }),
  withComputed(({ data, loading }) => ({
    /** `true` durante la primera carga (sin datos previos). */
    initialLoading: computed(() => loading() && !data()),
  })),
  withMethods((store, stats = inject(StatsService)) => ({
    /** Carga los datos para cada filtro emitido. */
    load: rxMethod<StatsFilter>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((filter) =>
          stats.dashboard(filter).pipe(
            tap((data) =>
              patchState(store, { data, loading: false, lastUpdated: new Date().toISOString() }),
            ),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
);
