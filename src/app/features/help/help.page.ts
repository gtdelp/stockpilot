import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonAccordion } from '@ionic/angular/ion-accordion';
import { IonAccordionGroup } from '@ionic/angular/ion-accordion-group';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../core/auth/auth.store';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HELP_TOPICS } from './help-content';

/**
 * Manual de usuario integrado: temas filtrados por rol y buscador.
 */
@Component({
  selector: 'app-help-page',
  imports: [
    FormsModule,
    IonContent,
    IonSearchbar,
    IonAccordionGroup,
    IonAccordion,
    IonItem,
    IonLabel,
    IonIcon,
    PageHeaderComponent,
  ],
  templateUrl: './help.page.html',
  styleUrls: ['./help-topic.scss', './help.page.scss'],
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  private readonly auth = inject(AuthStore);

  /** Texto de búsqueda (two-way binding). */
  protected readonly query = signal('');
  /** Tema abierto por defecto (fragmento de la URL). */
  protected readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  /** Temas visibles para el rol actual y la búsqueda. */
  protected readonly topics = computed(() => {
    const role = this.auth.role();
    const term = normalize(this.query());
    return HELP_TOPICS.filter((topic) => role && topic.roles.includes(role)).filter((topic) => {
      if (!term) {
        return true;
      }
      const haystack = [
        topic.title,
        topic.summary,
        ...topic.sections.flatMap((section) => [
          section.heading,
          section.text ?? '',
          ...(section.steps ?? []),
        ]),
      ].join(' ');
      return normalize(haystack).includes(term);
    });
  });
}

/** Normaliza texto para buscar sin tildes ni mayúsculas. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
