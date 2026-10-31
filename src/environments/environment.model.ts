/**
 * Configuración pública del cliente web de Firebase.
 */
export interface FirebaseWebConfig {
  /** Clave de API web (pública, restringida por dominio en la consola de Firebase). */
  apiKey: string;
  /** Dominio de autenticación. */
  authDomain: string;
  /** Identificador del proyecto. */
  projectId: string;
  /** Bucket de almacenamiento. */
  storageBucket: string;
  /** Identificador del emisor de mensajes. */
  messagingSenderId: string;
  /** Identificador de la aplicación web. */
  appId: string;
}

/**
 * Forma del archivo de entorno generado por `scripts/set-env.mjs`.
 */
export interface AppEnvironment {
  /** `true` en compilaciones de producción. */
  production: boolean;
  /**
   * `true` cuando no hay configuración de Firebase: la app usa un backend
   * simulado en memoria con datos sintéticos (desarrollo, E2E y Lighthouse CI).
   */
  demoMode: boolean;
  /** Prefijo de la API REST. */
  apiUrl: string;
  /** Configuración de Firebase o `null` en modo demostración. */
  firebase: FirebaseWebConfig | null;
}
