import { Observable } from 'rxjs';

/** Usuario autenticado según el proveedor de identidad. */
export interface AuthUser {
  /** UID del usuario en el proveedor de identidad. */
  uid: string;
  /** Correo electrónico. */
  email: string;
}

/**
 * Abstracción del proveedor de identidad. Permite usar Firebase Auth en
 * producción y un proveedor simulado en modo demostración/tests sin
 * cambiar el resto de la aplicación (inversión de dependencias).
 */
export abstract class AuthProvider {
  /** Emite el usuario actual al iniciar y cada vez que cambia la sesión. */
  abstract readonly user$: Observable<AuthUser | null>;

  /** Inicia sesión con correo y contraseña. */
  abstract signIn(email: string, password: string): Promise<void>;

  /** Cierra la sesión actual. */
  abstract signOut(): Promise<void>;

  /**
   * Devuelve el token JWT de la sesión (o `null` si no hay sesión).
   * @param forceRefresh Fuerza la renovación del token.
   */
  abstract getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

/** Traduce los códigos de error de Firebase Auth a mensajes en español. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'auth/network-request-failed':
      return 'No hay conexión. Revisa tu red e inténtalo de nuevo.';
    default:
      return 'No se ha podido iniciar sesión. Inténtalo de nuevo.';
  }
}
