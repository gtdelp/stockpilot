import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/toast-controller';

/**
 * Avisos breves y accesibles (los toasts de Ionic se anuncian a lectores de pantalla).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly controller = inject(ToastController);

  /** Muestra un aviso de éxito. */
  success(message: string): Promise<void> {
    return this.show(message, 'success', 'checkmark-circle-outline');
  }

  /** Muestra un aviso de error. */
  error(message: string): Promise<void> {
    return this.show(message, 'danger', 'alert-circle-outline', 5000);
  }

  /** Muestra un aviso informativo. */
  info(message: string): Promise<void> {
    return this.show(message, 'medium', 'information-circle-outline');
  }

  private async show(message: string, color: string, icon: string, duration = 3200): Promise<void> {
    const toast = await this.controller.create({
      message,
      color,
      icon,
      duration,
      position: 'bottom',
      cssClass: 'sp-toast',
      swipeGesture: 'vertical',
      buttons: [
        {
          icon: 'close-outline',
          role: 'cancel',
          side: 'end',
          htmlAttributes: { 'aria-label': 'Cerrar aviso' },
        },
      ],
    });
    await toast.present();
  }
}
