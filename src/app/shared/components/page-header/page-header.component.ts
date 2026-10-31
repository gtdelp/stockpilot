import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';

/** Miga de pan de la cabecera de página. */
export interface Breadcrumb {
  /** Texto visible. */
  label: string;
  /** Ruta; si se omite es la página actual. */
  link?: string;
}

/**
 * Cabecera común de página: migas de pan, título (único `h1`), subtítulo,
 * zona de acciones proyectada y botón de ayuda contextual.
 *
 * @example
 * <app-page-header title="Productos" [breadcrumbs]="crumbs" (helpRequested)="openHelp()">
 *   <ion-button>Nuevo</ion-button>
 * </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink, IonButton, IonIcon],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  /** Título de la página (se renderiza como `h1`). */
  readonly title = input.required<string>();
  /** Texto descriptivo bajo el título. */
  readonly subtitle = input<string>('');
  /** Migas de pan. */
  readonly breadcrumbs = input<Breadcrumb[]>([]);
  /** Muestra el botón de ayuda contextual. */
  readonly showHelp = input(true);
  /** Se emite al pulsar el botón de ayuda. */
  readonly helpRequested = output<void>();
}
