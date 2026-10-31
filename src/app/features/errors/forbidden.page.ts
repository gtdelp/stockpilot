import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { AuthStore } from '../../core/auth/auth.store';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/**
 * Página 403: el usuario no tiene el rol necesario para la ruta solicitada.
 */
@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, IonContent, IonButton, IonIcon, EmptyStateComponent],
  template: `
    <ion-content>
      <div class="sp-page">
        <h1 class="visually-hidden">Acceso denegado</h1>
        <div class="sp-card">
          <app-empty-state
            icon="lock-closed-outline"
            title="Acceso denegado (403)"
            message="Tu rol no tiene permisos para ver esta sección. Si crees que es un error, contacta con un administrador."
          >
            <ion-button [routerLink]="auth.homeUrl()">
              <ion-icon slot="start" name="home-outline" aria-hidden="true"></ion-icon>
              Volver al inicio
            </ion-button>
          </app-empty-state>
        </div>
      </div>
    </ion-content>
  `,
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {
  protected readonly auth = inject(AuthStore);
}
