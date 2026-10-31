import { Observable } from 'rxjs';
import { ActivityEvent, AppNotification } from '../models';

/**
 * Abstracción del origen de datos en tiempo real (NoSQL).
 * En producción se implementa con Firestore (`onSnapshot`).
 */
export abstract class RealtimeProvider {
  /**
   * Feed de actividad en tiempo real, del más reciente al más antiguo.
   * @param max Número máximo de eventos.
   */
  abstract activity$(max: number): Observable<ActivityEvent[]>;

  /** Notificaciones en tiempo real del usuario indicado. */
  abstract notifications$(uid: string): Observable<AppNotification[]>;

  /** Marca una notificación como leída. */
  abstract markAsRead(uid: string, id: string): Promise<void>;
}
