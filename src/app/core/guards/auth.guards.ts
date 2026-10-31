import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment } from '@angular/router';
import { map } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { Role } from '../models';

/** Reconstruye la URL solicitada para volver tras el login. */
function requestedUrl(segments: UrlSegment[]): string {
  return '/' + segments.map((segment) => segment.path).join('/');
}

/**
 * Permite el acceso solo con sesión iniciada; si no, redirige al login
 * conservando la URL solicitada. Al usar `canMatch` el chunk diferido de la
 * ruta ni siquiera se descarga sin permiso.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.whenReady().pipe(
    map(() =>
      store.isAuthenticated()
        ? true
        : router.createUrlTree(['/login'], {
            queryParams: segments.length ? { redirect: requestedUrl(segments) } : {},
          }),
    ),
  );
};

/**
 * Restringe una ruta a los roles indicados en `data.roles`.
 * Si el rol no coincide redirige a la página 403.
 */
export const roleGuard: CanMatchFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const allowed = (route.data?.['roles'] as Role[] | undefined) ?? [];
  return store.whenReady().pipe(
    map(() => {
      const role = store.role();
      if (!role) {
        return router.createUrlTree(['/login']);
      }
      return allowed.length === 0 || allowed.includes(role) ? true : router.createUrlTree(['/403']);
    }),
  );
};

/** Impide entrar al login o registro con sesión ya iniciada. */
export const guestGuard: CanMatchFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store
    .whenReady()
    .pipe(map(() => (store.isAuthenticated() ? router.createUrlTree([store.homeUrl()]) : true)));
};
