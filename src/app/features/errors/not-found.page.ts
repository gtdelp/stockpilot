import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';

/**
 * Página 404 para rutas inexistentes.
 */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, IonContent, IonButton, IonIcon],
  template: `
    <ion-content>
      <div id="contenido" class="not-found" tabindex="-1">
        <p class="not-found__code" aria-hidden="true">404</p>
        <h1>Página no encontrada</h1>
        <p>La dirección no existe o se ha movido.</p>
        <ion-button routerLink="/">
          <ion-icon slot="start" name="home-outline" aria-hidden="true"></ion-icon>
          Ir al inicio
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-space-3);
      min-height: 100%;
      padding: var(--sp-space-6) var(--sp-space-4);
      text-align: center;
      outline: none;
    }
    .not-found__code {
      margin: 0;
      font-size: 4.5rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--sp-primary);
      line-height: 1;
    }
    h1 {
      font-size: var(--sp-text-2xl);
    }
    p {
      margin: 0;
      color: var(--sp-text-muted);
    }
  `,
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
