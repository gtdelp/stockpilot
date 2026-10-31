import { DestroyRef, Injector, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  Observable,
  filter,
  firstValueFrom,
  map,
  of,
  switchMap,
  catchError,
  take,
  tap,
} from 'rxjs';
import { RegisterInput, Role, UserProfile, toApiError } from '../models';
import { UsersService } from '../services/users.service';
import { AuthProvider, AuthUser } from './auth-provider';

/** Estado de la sesión. `checking` mientras se resuelve la identidad y el perfil. */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/** Estado del store de autenticación. */
export interface AuthState {
  /** Estado. */
  status: AuthStatus;
  /** Perfil del usuario autenticado o `null`. */
  profile: UserProfile | null;
  /** Último mensaje de error o `null`. */
  error: string | null;
  /** Número de cargas de perfil completadas (con éxito o error) tras un inicio de sesión. */
  profileLoads: number;
}

/** Estado inicial: comprobando sesión. */
const initialState: AuthState = { status: 'checking', profile: null, error: null, profileLoads: 0 };

/**
 * Store global de sesión (NgRx SignalStore).
 * Es la única fuente de verdad del usuario autenticado y su rol: los guards,
 * el menú y las vistas leen de aquí. El estado solo cambia mediante `patchState`.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ status, profile }) => ({
    /** `true` cuando hay sesión con perfil cargado. */
    isAuthenticated: computed(() => status() === 'authenticated'),
    /** `true` si el usuario es administrador. */
    isAdmin: computed(() => profile()?.role === 'admin'),
    /** Rol actual o `null`. */
    role: computed<Role | null>(() => profile()?.role ?? null),
    /** Ruta de inicio según el rol. */
    homeUrl: computed(() => (profile()?.role === 'admin' ? '/panel' : '/productos')),
  })),
  withMethods(
    (
      store,
      provider = inject(AuthProvider),
      users = inject(UsersService),
      injector = inject(Injector),
    ) => {
      /** Resuelve cuando termina una carga de perfil posterior a `after`. */
      const nextProfileLoad = (after: number): Promise<number> =>
        firstValueFrom(
          toObservable(store.profileLoads, { injector }).pipe(
            filter((loads) => loads > after),
            take(1),
          ),
        );

      /**
       * Inicia sesión y espera a que el perfil esté cargado.
       * @returns `true` si la sesión queda autenticada.
       */
      const login = async (email: string, password: string): Promise<boolean> => {
        patchState(store, { error: null });
        const loadsBefore = store.profileLoads();
        try {
          await provider.signIn(email.trim(), password);
        } catch (error) {
          patchState(store, { error: toApiError(error).message });
          return false;
        }
        // El proveedor notifica la sesión y se carga el perfil: esperamos a que termine
        await nextProfileLoad(loadsBefore);
        return store.status() === 'authenticated';
      };

      return {
        /** Observable que emite una vez la sesión está resuelta (lo usan los guards). */
        whenReady(): Observable<AuthStatus> {
          return toObservable(store.status, { injector }).pipe(
            filter((status) => status !== 'checking'),
            take(1),
          );
        },

        login,

        /** Registra una cuenta (rol usuario estándar) e inicia sesión. */
        async register(input: RegisterInput): Promise<boolean> {
          patchState(store, { error: null });
          try {
            await firstValueFrom(users.register(input));
          } catch (error) {
            patchState(store, { error: toApiError(error).message });
            return false;
          }
          return login(input.email, input.password);
        },

        /** Cierra la sesión. */
        async logout(): Promise<void> {
          await provider.signOut();
          patchState(store, { status: 'anonymous', profile: null, error: null });
        },

        /** Sustituye el perfil (p. ej. tras editar el nombre). */
        setProfile(profile: UserProfile): void {
          patchState(store, { profile });
        },

        /** Limpia el último error mostrado. */
        clearError(): void {
          patchState(store, { error: null });
        },

        /** Carga el perfil de la API para el usuario autenticado. */
        _loadProfile(user: AuthUser | null): Observable<void> {
          if (!user) {
            patchState(store, { status: 'anonymous', profile: null });
            return of(undefined);
          }
          patchState(store, { status: 'checking' });
          return users.me().pipe(
            tap((profile) =>
              patchState(store, {
                status: 'authenticated',
                profile,
                error: null,
                profileLoads: store.profileLoads() + 1,
              }),
            ),
            map(() => undefined),
            catchError((error: unknown) => {
              const apiError = toApiError(error);
              void provider.signOut();
              patchState(store, {
                status: 'anonymous',
                profile: null,
                profileLoads: store.profileLoads() + 1,
                error:
                  apiError.status === 404
                    ? 'Tu cuenta no tiene un perfil asociado. Contacta con un administrador.'
                    : apiError.message,
              });
              return of(undefined);
            }),
          );
        },
      };
    },
  ),
  withHooks({
    /** Escucha los cambios de sesión del proveedor y carga el perfil asociado. */
    onInit(store, provider = inject(AuthProvider), destroyRef = inject(DestroyRef)) {
      provider.user$
        .pipe(
          switchMap((user) => store._loadProfile(user)),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    },
  }),
);
