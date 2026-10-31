import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  // Último recurso: si el arranque falla, se muestra un mensaje en lugar de una pantalla en blanco
  const root = document.querySelector('app-root');
  if (root) {
    root.textContent = 'No se ha podido iniciar la aplicación. Recarga la página.';
  }
  reportError(error);
});
