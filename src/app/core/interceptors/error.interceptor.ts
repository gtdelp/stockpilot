import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';
import { ApiError } from '../models';
import { ToastService } from '../services/toast.service';
import { SILENT_ERRORS } from './http-context';

/** Reintentos automáticos de lecturas ante fallos de red o del servidor. */
const MAX_RETRIES = 2;

/**
 * Gestión centralizada de errores HTTP:
 * - Reintenta las peticiones GET ante errores de red/5xx con espera progresiva.
 * - 401 → cierra la sesión y lleva al login.
 * - 403 → página "Acceso denegado".
 * - Resto → aviso global (salvo peticiones marcadas como silenciosas).
 * Siempre propaga un {@link ApiError} homogéneo.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const injector = inject(Injector);
  const router = inject(Router);
  const toast = inject(ToastService);
  const silent = req.context.get(SILENT_ERRORS);

  return next(req).pipe(
    retry({
      count: req.method === 'GET' ? MAX_RETRIES : 0,
      delay: (error: unknown, attempt) =>
        error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)
          ? timer(400 * attempt)
          : throwError(() => error),
    }),
    catchError((error: unknown) => {
      const apiError = normalize(error);
      if (apiError.status === 401) {
        // Inyección diferida para evitar la dependencia circular AuthStore → HttpClient
        void injector
          .get(AuthStore)
          .logout()
          .then(() => router.navigate(['/login']));
      } else if (apiError.status === 403 && !silent) {
        void router.navigate(['/403']);
      } else if (!silent) {
        void toast.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};

/** Convierte cualquier error HTTP al formato {@link ApiError}. */
export function normalize(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiError> | null;
    if (error.status === 0) {
      return {
        status: 0,
        code: 'NETWORK',
        message: 'No hay conexión con el servidor. Inténtalo de nuevo.',
      };
    }
    return {
      status: error.status,
      code: body?.code ?? 'HTTP_ERROR',
      message:
        body?.message ??
        (error.status >= 500
          ? 'El servidor no está disponible en este momento.'
          : 'No se ha podido completar la operación.'),
    };
  }
  return { status: 0, code: 'UNKNOWN', message: 'Se ha producido un error inesperado.' };
}
