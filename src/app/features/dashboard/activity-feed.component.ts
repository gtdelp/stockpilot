import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ActivityEvent, ActivityType } from '../../core/models';
import { formatRelative } from '../../core/utils/format';

/** Icono asociado a cada tipo de evento. */
const ICONS: Record<ActivityType, string> = {
  order_created: 'cart-outline',
  order_status: 'swap-horizontal-outline',
  low_stock: 'warning-outline',
  product_updated: 'create-outline',
  user_created: 'person-add-outline',
};

/**
 * Lista de eventos en tiempo real (Firestore). Presentacional: recibe los eventos por input.
 */
@Component({
  selector: 'app-activity-feed',
  imports: [IonIcon, IonSkeletonText],
  template: `
    <section class="feed sp-card" aria-labelledby="feed-title">
      <header class="feed__header">
        <h2 id="feed-title" class="feed__title">Actividad en tiempo real</h2>
        <span class="feed__live" [class.feed__live--off]="!connected()">
          <span class="feed__dot" aria-hidden="true"></span>
          {{ connected() ? 'En directo' : 'Sin conexión' }}
        </span>
      </header>
      @if (loading()) {
        @for (row of [1, 2, 3, 4]; track row) {
          <ion-skeleton-text [animated]="true" class="feed__skeleton"></ion-skeleton-text>
        }
      } @else if (!events().length) {
        <p class="feed__empty">Todavía no hay actividad.</p>
      } @else {
        <ol class="feed__list" aria-live="polite" aria-relevant="additions">
          @for (event of events(); track event.id) {
            <li class="feed__item">
              <span
                class="feed__icon"
                [class]="'feed__icon feed__icon--' + event.type"
                aria-hidden="true"
              >
                <ion-icon [name]="icon(event.type)"></ion-icon>
              </span>
              <span class="feed__body">
                <span class="feed__message">{{ event.message }}</span>
                <span class="feed__meta"
                  >{{ event.actorName }} ·
                  <time [attr.datetime]="event.createdAt">{{
                    relative(event.createdAt)
                  }}</time></span
                >
              </span>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styleUrl: './activity-feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFeedComponent {
  /** Eventos a mostrar. */
  readonly events = input<ActivityEvent[]>([]);
  /** Muestra el esqueleto de carga. */
  readonly loading = input(false);
  /** Estado de la conexión en tiempo real. */
  readonly connected = input(true);

  /** Icono por tipo de evento. */
  icon(type: ActivityType): string {
    return ICONS[type] ?? 'ellipse-outline';
  }

  /** Tiempo relativo. */
  relative(iso: string): string {
    return formatRelative(iso);
  }
}
