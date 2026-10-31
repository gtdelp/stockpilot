import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';

/**
 * Grupo de botones de exportación (CSV y PDF). No conoce los datos:
 * solo notifica al componente padre qué formato se ha solicitado.
 */
@Component({
  selector: 'app-export-menu',
  imports: [IonButton, IonIcon, IonSpinner],
  template: `
    <div class="export" role="group" [attr.aria-label]="label()">
      <ion-button fill="outline" color="medium" [disabled]="disabled()" (click)="exportCsv.emit()">
        <ion-icon slot="start" name="document-text-outline" aria-hidden="true"></ion-icon>
        CSV
      </ion-button>
      <ion-button
        fill="outline"
        color="medium"
        [disabled]="disabled() || busy()"
        (click)="exportPdf.emit()"
      >
        @if (busy()) {
          <ion-spinner slot="start" name="crescent" aria-hidden="true"></ion-spinner>
        } @else {
          <ion-icon slot="start" name="document-outline" aria-hidden="true"></ion-icon>
        }
        PDF
      </ion-button>
    </div>
  `,
  styles: `
    .export {
      display: flex;
      gap: var(--sp-space-2);
    }
    ion-spinner {
      width: 18px;
      height: 18px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportMenuComponent {
  /** Etiqueta accesible del grupo. */
  readonly label = input('Exportar datos');
  /** Deshabilita la exportación (p. ej. sin datos). */
  readonly disabled = input(false);
  /** Muestra un indicador mientras se genera el PDF. */
  readonly busy = input(false);
  /** Solicitud de exportación a CSV. */
  readonly exportCsv = output<void>();
  /** Solicitud de exportación a PDF. */
  readonly exportPdf = output<void>();
}
