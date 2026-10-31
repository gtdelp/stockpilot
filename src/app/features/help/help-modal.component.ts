import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import { HelpTopic } from './help-content';

/**
 * Ayuda contextual de una pantalla, mostrada en un diálogo accesible.
 */
@Component({
  selector: 'app-help-modal',
  imports: [IonButton, IonIcon],
  template: `
    <div class="modal">
      <header class="modal__header">
        <h2 id="help-modal-title">
          <ion-icon [name]="topic().icon" aria-hidden="true"></ion-icon>
          Ayuda: {{ topic().title }}
        </h2>
        <ion-button fill="clear" color="medium" (click)="close()" aria-label="Cerrar ayuda">
          <ion-icon slot="icon-only" name="close-outline" aria-hidden="true"></ion-icon>
        </ion-button>
      </header>
      <div class="modal__body help" role="document" aria-labelledby="help-modal-title">
        <p class="help__summary">{{ topic().summary }}</p>
        @for (section of topic().sections; track section.heading) {
          <section>
            <h3>{{ section.heading }}</h3>
            @if (section.text) {
              <p>{{ section.text }}</p>
            }
            @if (section.steps) {
              <ol>
                @for (step of section.steps; track step) {
                  <li>{{ step }}</li>
                }
              </ol>
            }
          </section>
        }
      </div>
      <footer class="modal__footer">
        <ion-button fill="clear" (click)="openManual()">Ver toda la ayuda</ion-button>
        <ion-button (click)="close()">Entendido</ion-button>
      </footer>
    </div>
  `,
  styleUrl: './help-topic.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  /** Tema a mostrar. */
  readonly topic = input.required<HelpTopic>();

  /** Cierra el diálogo. */
  close(): Promise<boolean> {
    return this.modalCtrl.dismiss();
  }

  /** Abre el manual completo en la página de ayuda. */
  async openManual(): Promise<void> {
    await this.modalCtrl.dismiss();
    await this.router.navigate(['/ayuda'], { fragment: this.topic().id });
  }
}
