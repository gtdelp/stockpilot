import { Injectable } from '@angular/core';
import type { DocumentData, Firestore, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { loadFirebaseApp } from '../firebase/firebase-app';
import { ActivityEvent, ActivityType, AppNotification } from '../models';
import { RealtimeProvider } from './realtime-provider';

/**
 * Tiempo real con Cloud Firestore. Cada Observable abre un listener
 * `onSnapshot` y lo cierra al desuscribirse (sin fugas de memoria).
 */
@Injectable()
export class FirestoreRealtimeProvider extends RealtimeProvider {
  private firestorePromise: Promise<Firestore> | null = null;

  /** @inheritdoc */
  activity$(max: number): Observable<ActivityEvent[]> {
    return this.listen('activity', max, (doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data['type'] as ActivityType,
        message: String(data['message'] ?? ''),
        actorName: String(data['actorName'] ?? ''),
        createdAt: toIso(data['createdAt']),
      };
    });
  }

  /** @inheritdoc */
  notifications$(uid: string): Observable<AppNotification[]> {
    return this.listen(`notifications/${uid}/items`, 30, (doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: String(data['title'] ?? ''),
        body: String(data['body'] ?? ''),
        read: Boolean(data['read']),
        createdAt: toIso(data['createdAt']),
      };
    });
  }

  /** @inheritdoc */
  async markAsRead(uid: string, id: string): Promise<void> {
    const [db, { doc, updateDoc }] = await Promise.all([
      this.firestore(),
      import('firebase/firestore'),
    ]);
    await updateDoc(doc(db, `notifications/${uid}/items/${id}`), { read: true });
  }

  private listen<T>(
    path: string,
    max: number,
    mapper: (doc: QueryDocumentSnapshot<DocumentData>) => T,
  ): Observable<T[]> {
    return new Observable<T[]>((subscriber) => {
      let unsubscribe: (() => void) | undefined;
      let closed = false;
      void Promise.all([this.firestore(), import('firebase/firestore')])
        .then(([db, { collection, query, orderBy, limit, onSnapshot }]) => {
          if (closed) {
            return;
          }
          const ref = query(collection(db, path), orderBy('createdAt', 'desc'), limit(max));
          unsubscribe = onSnapshot(
            ref,
            (snapshot) => subscriber.next(snapshot.docs.map(mapper)),
            (error) => subscriber.error(error),
          );
        })
        .catch((error: unknown) => subscriber.error(error));
      // Teardown: cierra el listener de Firestore
      return () => {
        closed = true;
        unsubscribe?.();
      };
    });
  }

  private firestore(): Promise<Firestore> {
    if (!environment.firebase) {
      return Promise.reject(new Error('Firebase no está configurado.'));
    }
    const config = environment.firebase;
    this.firestorePromise ??= Promise.all([
      loadFirebaseApp(config),
      import('firebase/firestore'),
    ]).then(([app, { getFirestore }]) => getFirestore(app));
    return this.firestorePromise;
  }
}

/** Convierte un `Timestamp` de Firestore en fecha ISO. */
function toIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date().toISOString();
}
