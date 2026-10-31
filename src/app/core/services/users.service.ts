import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { silentContext } from '../interceptors/http-context';
import { AvailabilityResponse, CreateUserInput, RegisterInput, Role, UserProfile } from '../models';

/**
 * Acceso a la API REST de usuarios y perfiles (PostgreSQL).
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Perfil del usuario autenticado. */
  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/me`, { context: silentContext() });
  }

  /** Actualiza el nombre del usuario autenticado. */
  updateMe(fullName: string): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.baseUrl}/me`, { fullName });
  }

  /** Registra una cuenta nueva (rol Usuario estándar). */
  register(input: RegisterInput): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.baseUrl}/auth/register`, input, {
      context: silentContext(),
    });
  }

  /** Comprueba si un correo está libre (validación asíncrona). */
  isEmailAvailable(email: string): Observable<boolean> {
    return this.http
      .get<AvailabilityResponse>(`${this.baseUrl}/users/email-available`, {
        params: { email },
        context: silentContext(),
      })
      .pipe(map((response) => response.available));
  }

  /** Lista todos los usuarios (solo administradores). */
  list(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.baseUrl}/users`);
  }

  /** Da de alta un usuario (solo administradores). */
  create(input: CreateUserInput): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.baseUrl}/users`, input, {
      context: silentContext(),
    });
  }

  /** Cambia el rol de un usuario (solo administradores). */
  updateRole(id: string, role: Role): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, {
      role,
    });
  }
}
