import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import { HELP_TOPICS, HelpTopic, HelpTopicId } from './help-content';

/**
 * Ayuda contextual: abre el tema correspondiente a la pantalla actual en un diálogo.
 */
@Injectable({ providedIn: 'root' })
export class HelpService {
  private readonly modals = inject(ModalController);

  /** Devuelve un tema por su identificador. */
  topic(id: HelpTopicId): HelpTopic | undefined {
    return HELP_TOPICS.find((topic) => topic.id === id);
  }

  /** Abre la ayuda contextual de un tema. */
  async open(id: HelpTopicId): Promise<void> {
    const topic = this.topic(id);
    if (!topic) {
      return;
    }
    const { HelpModalComponent } = await import('./help-modal.component');
    const modal = await this.modals.create({
      component: HelpModalComponent,
      componentProps: { topic },
      cssClass: 'sp-modal',
    });
    await modal.present();
  }
}
