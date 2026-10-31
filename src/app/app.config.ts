import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import {
  ApplicationConfig,
  LOCALE_ID,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular/provide';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthProvider } from './core/auth/auth-provider';
import { FirebaseAuthProvider } from './core/auth/firebase-auth.provider';
import { DemoAuthProvider } from './core/demo/demo-auth.provider';
import { demoBackendInterceptor } from './core/demo/demo-backend.interceptor';
import { DemoRealtimeProvider } from './core/demo/demo-realtime.provider';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { FirestoreRealtimeProvider } from './core/realtime/firestore-realtime.provider';
import { RealtimeProvider } from './core/realtime/realtime-provider';
import { registerAppIcons } from './icons';

registerLocaleData(localeEs);
registerAppIcons();

/** Interceptores HTTP: token JWT → gestión de errores → (backend simulado en demo). */
const interceptors = environment.demoMode
  ? [authInterceptor, errorInterceptor, demoBackendInterceptor]
  : [authInterceptor, errorInterceptor];

/**
 * Configuración raíz de la aplicación (detección de cambios sin Zone.js).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ mode: 'md', useSetInputAPI: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors(interceptors)),
    { provide: LOCALE_ID, useValue: 'es-ES' },
    {
      provide: AuthProvider,
      useClass: environment.demoMode ? DemoAuthProvider : FirebaseAuthProvider,
    },
    {
      provide: RealtimeProvider,
      useClass: environment.demoMode ? DemoRealtimeProvider : FirestoreRealtimeProvider,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
