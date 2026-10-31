import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthProvider, AuthUser } from '../auth/auth-provider';
import { DemoDb } from './demo-db';

/** Clave de `sessionStorage` donde se guarda la sesión de demostración. */
const SESSION_KEY = 'stockpilot.demo.session';

/**
 * Proveedor de identidad del modo demostración. No almacena contraseñas:
 * acepta cualquier contraseña de 8 o más caracteres para las cuentas existentes.
 * El token devuelto (`demo.<uid>`) solo lo entiende el backend simulado.
 */
@Injectable()
export class DemoAuthProvider extends AuthProvider {
  private readonly db = inject(DemoDb);
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.restore());

  /** @inheritdoc */
  readonly user$: Observable<AuthUser | null> = this.userSubject.asObservable();

  /** @inheritdoc */
  async signIn(email: string, password: string): Promise<void> {
    await delay(350);
    const user = this.db.findUserByEmail(email);
    if (!user || password.length < 8) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    const authUser = { uid: user.id, email: user.email };
    this.persist(authUser);
    this.userSubject.next(authUser);
  }

  /** @inheritdoc */
  async signOut(): Promise<void> {
    this.persist(null);
    this.userSubject.next(null);
  }

  /** @inheritdoc */
  async getIdToken(): Promise<string | null> {
    const user = this.userSubject.value;
    return user ? `demo.${user.uid}` : null;
  }

  private restore(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const parsed = raw ? (JSON.parse(raw) as AuthUser) : null;
      return parsed && this.db.findUserByEmail(parsed.email) ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(user: AuthUser | null): void {
    try {
      if (user) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Almacenamiento no disponible (modo privado): la sesión dura lo que la pestaña
    }
  }
}

/** Espera simulada (latencia de red). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
