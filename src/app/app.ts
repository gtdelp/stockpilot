import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular/ion-app';
import { ThemeService } from './core/services/theme.service';

/**
 * Componente raíz. El `RouterOutlet` de Angular muestra una sola página en el
 * DOM a la vez (mejor para lectores de pantalla que la pila de páginas de Ionic).
 */
@Component({
  selector: 'app-root',
  imports: [IonApp, RouterOutlet],
  template: `
    <ion-app>
      <a class="skip-link" href="#contenido">Saltar al contenido</a>
      <router-outlet />
    </ion-app>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** Inicializa el tema (claro/oscuro) desde el arranque. */
  protected readonly theme = inject(ThemeService);
}
