import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';

/**
 * Diálogo de confirmación accesible (foco atrapado y cierre con Esc gracias a `ion-modal`).
 * Devuelve `role: 'confirm'` o `'cancel'` al cerrarse.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [IonButton, IonIcon],
  template: `
    <div class="modal modal--compact">
      <div
        class="dialog modal__body"
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <span
          class="dialog__icon"
          [class.dialog__icon--danger]="tone() === 'danger'"
          aria-hidden="true"
        >
          <ion-icon
            [name]="tone() === 'danger' ? 'warning-outline' : 'help-circle-outline'"
          ></ion-icon>
        </span>
        <h2 id="confirm-title">{{ title() }}</h2>
        <p id="confirm-message">{{ message() }}</p>
        <div class="sp-actions">
          <ion-button fill="outline" color="medium" (click)="close(false)">{{
            cancelText()
          }}</ion-button>
          <ion-button [color]="tone() === 'danger' ? 'danger' : 'primary'" (click)="close(true)">
            {{ confirmText() }}
          </ion-button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: flex;
      flex-direction: column;
      gap: var(--sp-space-3);
      padding: var(--sp-space-2);
    }
    .dialog__icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--sp-primary-soft);
      color: var(--sp-primary-soft-text);
      font-size: 24px;
    }
    .dialog__icon--danger {
      background: var(--sp-danger-soft);
      color: var(--sp-danger);
    }
    h2 {
      font-size: var(--sp-text-lg);
      font-weight: 600;
    }
    p {
      margin: 0;
      color: var(--sp-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  private readonly modalCtrl = inject(ModalController);

  /** Título del diálogo. */
  readonly title = input.required<string>();
  /** Mensaje explicativo. */
  readonly message = input.required<string>();
  /** Texto del botón de confirmación. */
  readonly confirmText = input('Confirmar');
  /** Texto del botón de cancelación. */
  readonly cancelText = input('Cancelar');
  /** Variante: `danger` para acciones destructivas. */
  readonly tone = input<'default' | 'danger'>('default');

  /** Cierra el diálogo con el resultado indicado. */
  close(confirmed: boolean): Promise<boolean> {
    return this.modalCtrl.dismiss(confirmed, confirmed ? 'confirm' : 'cancel');
  }
}
