import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';

/**
 * Estado vacío o de error con icono, título, mensaje y acción opcional proyectada.
 */
@Component({
  selector: 'app-empty-state',
  imports: [IonIcon],
  template: `
    <div
      class="empty"
      [class.empty--error]="tone() === 'error'"
      [attr.role]="tone() === 'error' ? 'alert' : null"
    >
      <span class="empty__icon" aria-hidden="true"><ion-icon [name]="icon()"></ion-icon></span>
      <p class="empty__title">{{ title() }}</p>
      @if (message()) {
        <p class="empty__message">{{ message() }}</p>
      }
      <div class="empty__action"><ng-content /></div>
    </div>
  `,
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  /** Título principal. */
  readonly title = input.required<string>();
  /** Mensaje secundario. */
  readonly message = input<string>('');
  /** Nombre del icono de Ionicons. */
  readonly icon = input<string>('file-tray-outline');
  /** Variante visual. */
  readonly tone = input<'neutral' | 'error'>('neutral');
}
