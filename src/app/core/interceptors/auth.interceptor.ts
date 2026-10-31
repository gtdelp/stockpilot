import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthProvider } from '../auth/auth-provider';

/**
 * Adjunta el token JWT de la sesión a las peticiones a la API.
 * Si la API responde 401 renueva el token una vez y repite la petición.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const provider = inject(AuthProvider);
  const withToken = (request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return from(provider.getIdToken()).pipe(
    switchMap((token) =>
      next(withToken(req, token)).pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401 && token) {
            return from(provider.getIdToken(true)).pipe(
              switchMap((fresh) => next(withToken(req, fresh))),
            );
          }
          return throwError(() => error);
        }),
      ),
    ),
  );
};
