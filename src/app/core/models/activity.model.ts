/** Tipos de evento del feed en tiempo real. */
export type ActivityType =
  'order_created' | 'order_status' | 'low_stock' | 'product_updated' | 'user_created';

/** Evento del feed de actividad (Firestore). */
export interface ActivityEvent {
  /** Identificador único. */
  id: string;
  /** Tipo de evento. */
  type: ActivityType;
  /** Mensaje legible. */
  message: string;
  /** Nombre de quien provocó el evento. */
  actorName: string;
  /** Fecha del evento (ISO 8601). */
  createdAt: string;
}

/** Notificación personal (Firestore). */
export interface AppNotification {
  /** Identificador único. */
  id: string;
  /** Título. */
  title: string;
  /** Texto o cuerpo del mensaje. */
  body: string;
  /** `true` si se ha leído. */
  read: boolean;
  /** Fecha de creación (ISO 8601). */
  createdAt: string;
}
