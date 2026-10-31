/** Rol de un usuario dentro de StockPilot. */
export type Role = 'admin' | 'user';

/** Perfil de usuario almacenado en PostgreSQL. */
export interface UserProfile {
  /** UID de Firebase Auth. */
  id: string;
  /** Correo electrónico único. */
  email: string;
  /** Nombre completo. */
  fullName: string;
  /** Rol asignado. */
  role: Role;
  /** Fecha de alta (ISO 8601). */
  createdAt: string;
}

/** Datos para registrar una cuenta propia (rol Usuario estándar). */
export interface RegisterInput {
  /** Nombre completo. */
  fullName: string;
  /** Correo electrónico. */
  email: string;
  /** Contraseña (solo se envía, nunca se almacena en el cliente). */
  password: string;
}

/** Datos para que un administrador dé de alta un usuario. */
export interface CreateUserInput extends RegisterInput {
  /** Rol asignado. */
  role: Role;
}

/** Etiquetas legibles de cada rol. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  user: 'Usuario estándar',
};
