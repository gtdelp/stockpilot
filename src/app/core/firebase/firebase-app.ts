import type { FirebaseApp } from 'firebase/app';
import { FirebaseWebConfig } from '../../../environments/environment.model';

/** Instancia única de Firebase (inicialización diferida). */
let appPromise: Promise<FirebaseApp> | null = null;

/**
 * Inicializa Firebase de forma diferida (import dinámico) para no penalizar
 * la carga inicial. Devuelve siempre la misma instancia.
 */
export function loadFirebaseApp(config: FirebaseWebConfig): Promise<FirebaseApp> {
  appPromise ??= import('firebase/app').then(
    ({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(config),
  );
  return appPromise;
}
