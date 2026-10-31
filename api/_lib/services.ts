/** Usuario verificado a partir del token JWT. */
export interface VerifiedToken {
  uid: string;
  email: string;
}

/** Verifica tokens de sesión y gestiona cuentas en el proveedor de identidad. */
export interface IdentityService {
  /** Verifica la firma y caducidad del token JWT. */
  verifyToken(token: string): Promise<VerifiedToken>;
  /** Crea una cuenta y devuelve su UID. */
  createAccount(email: string, password: string, displayName: string): Promise<string>;
  /** Elimina una cuenta (compensación si falla el alta en la base de datos). */
  deleteAccount(uid: string): Promise<void>;
  /**
   * Replica el rol como *custom claim* del token para que las reglas de
   * seguridad de Firestore puedan comprobarlo (la fuente de verdad sigue siendo PostgreSQL).
   */
  setRole(uid: string, role: 'admin' | 'user'): Promise<void>;
}

/** Tipos de evento del feed de actividad. */
export type ActivityType =
  'order_created' | 'order_status' | 'low_stock' | 'product_updated' | 'user_created';

/** Publica eventos en tiempo real (Firestore). */
export interface RealtimeService {
  publishActivity(type: ActivityType, message: string, actorName: string): Promise<void>;
  notify(uid: string, title: string, body: string): Promise<void>;
}
