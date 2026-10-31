import { Injectable, inject } from '@angular/core';
import { Observable, merge, tap, interval, ignoreElements } from 'rxjs';
import { ActivityEvent, AppNotification } from '../models';
import { RealtimeProvider } from '../realtime/realtime-provider';
import { DemoDb } from './demo-db';

/** Intervalo de la actividad simulada de "otros usuarios". */
const SIMULATION_MS = 45_000;

/**
 * Tiempo real del modo demostración: emite los cambios de la base de datos en
 * memoria y simula actividad externa mientras haya suscriptores.
 */
@Injectable()
export class DemoRealtimeProvider extends RealtimeProvider {
  private readonly db = inject(DemoDb);

  /** @inheritdoc */
  activity$(max: number): Observable<ActivityEvent[]> {
    const simulation = interval(SIMULATION_MS).pipe(
      tap(() => this.db.simulateExternalActivity()),
      ignoreElements(),
    );
    return merge(this.db.activity$(max), simulation);
  }

  /** @inheritdoc */
  notifications$(uid: string): Observable<AppNotification[]> {
    return this.db.notifications$(uid);
  }

  /** @inheritdoc */
  async markAsRead(uid: string, id: string): Promise<void> {
    this.db.markNotificationRead(uid, id);
  }
}
