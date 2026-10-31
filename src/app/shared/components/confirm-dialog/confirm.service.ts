import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import { ConfirmDialogComponent } from './confirm-dialog.component';

/** Opciones del diálogo de confirmación. */
export interface ConfirmOptions {
  /** Título. */
  title: string;
  /** Mensaje legible. */
  message: string;
  /** Texto del botón de confirmación. */
  confirmText?: string;
  /** Texto del botón de cancelación. */
  cancelText?: string;
  /** Variante visual. */
  tone?: 'default' | 'danger';
}

/**
 * Abre el {@link ConfirmDialogComponent} y resuelve `true` si el usuario confirma.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modals = inject(ModalController);

  /** Pide confirmación al usuario. */
  async ask(options: ConfirmOptions): Promise<boolean> {
    const modal = await this.modals.create({
      component: ConfirmDialogComponent,
      componentProps: { ...options },
      cssClass: ['sp-modal', 'sp-modal--compact'],
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    return role === 'confirm';
  }
}
