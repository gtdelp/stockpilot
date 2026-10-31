import { ElementRef } from '@angular/core';

/** Elemento enfocable (los componentes Ionic exponen `setFocus`). */
interface FocusableField extends HTMLElement {
  /** Método de Ionic para enfocar el campo. */
  setFocus?: () => Promise<void>;
}

/**
 * Lleva el foco al primer campo inválido de un formulario tras un envío
 * fallido, para que usuarios de teclado y lector de pantalla lleguen al error.
 */
export function focusFirstInvalid(host: ElementRef<HTMLElement>): void {
  const field = host.nativeElement.querySelector<FocusableField>(
    '[formcontrolname].ng-invalid, [formControlName].ng-invalid, input.ng-invalid, select.ng-invalid',
  );
  if (!field) {
    return;
  }
  if (typeof field.setFocus === 'function') {
    void field.setFocus();
  } else {
    field.focus();
  }
}
