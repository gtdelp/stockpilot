import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Observable, map, startWith, switchMap } from 'rxjs';

/** Mensajes por defecto en español para cada clave de error. */
const DEFAULT_MESSAGES: Record<string, (error: unknown) => string> = {
  required: () => 'Este campo es obligatorio.',
  email: () => 'Introduce un correo electrónico válido.',
  minlength: (error) =>
    `Debe tener al menos ${(error as { requiredLength: number }).requiredLength} caracteres.`,
  maxlength: (error) =>
    `No puede superar ${(error as { requiredLength: number }).requiredLength} caracteres.`,
  min: (error) => `El valor mínimo es ${(error as { min: number }).min}.`,
  max: (error) => `El valor máximo es ${(error as { max: number }).max}.`,
  strongPassword: (error) =>
    `La contraseña necesita: ${(error as { missing: string[] }).missing.join(', ')}.`,
  mismatch: () => 'Las contraseñas no coinciden.',
  positive: () => 'Debe ser mayor que 0.',
  nonNegativeInteger: () => 'Debe ser un número entero igual o mayor que 0.',
  sku: () => 'Formato de SKU: 3–4 letras mayúsculas, guion y 4–6 dígitos (p. ej. ELE-0001).',
  emailTaken: () => 'Ya existe una cuenta con este correo.',
  skuTaken: () => 'Ya existe un producto con este SKU.',
  stock: (error) => `Solo hay ${(error as { available: number }).available} unidades disponibles.`,
};

/**
 * Muestra el primer error de un control cuando ha sido tocado o modificado.
 * Se enlaza al campo mediante `aria-describedby` usando el mismo `id`.
 */
@Component({
  selector: 'app-field-error',
  template: `
    <p class="field-message" [id]="id()" aria-live="polite">
      @if (pending()) {
        <span class="field-message__pending">Comprobando…</span>
      } @else if (message()) {
        <span class="field-message__error">{{ message() }}</span>
      } @else if (hint()) {
        <span class="field-message__hint">{{ hint() }}</span>
      }
    </p>
  `,
  styleUrl: './field-error.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldErrorComponent {
  /** Control a observar. */
  readonly control = input.required<AbstractControl>();
  /** Id del mensaje (referenciado por `aria-describedby`). */
  readonly id = input.required<string>();
  /** Texto de ayuda cuando no hay error. */
  readonly hint = input<string>('');
  /** Mensajes personalizados por clave de error. */
  readonly messages = input<Record<string, string>>({});

  /** Estado del control como señal (se recalcula con cada cambio de valor o estado). */
  private readonly state = toSignal(toObservable(this.control).pipe(switchMap(controlState)), {
    initialValue: null,
  });

  /** `true` mientras se ejecuta una validación asíncrona. */
  readonly pending = computed(() => this.state()?.status === 'PENDING');

  /** Mensaje del primer error visible. */
  readonly message = computed(() => {
    const state = this.state();
    if (!state || !state.errors || !(state.touched || state.dirty)) {
      return '';
    }
    const [key, value] = Object.entries(state.errors)[0] as [string, unknown];
    return this.messages()[key] ?? DEFAULT_MESSAGES[key]?.(value) ?? 'Valor no válido.';
  });
}

/** Instantánea del estado de un control. */
interface ControlState {
  /** Estado. */
  status: string;
  /** Errores de validación actuales. */
  errors: ValidationErrors | null;
  /** `true` si el control ha perdido el foco alguna vez. */
  touched: boolean;
  /** `true` si el usuario ha modificado el valor. */
  dirty: boolean;
}

/** Convierte los eventos de un control en un flujo de estados. */
function controlState(control: AbstractControl): Observable<ControlState> {
  return control.events.pipe(
    startWith(null),
    map(() => ({
      status: control.status,
      errors: control.errors,
      touched: control.touched,
      dirty: control.dirty,
    })),
  );
}
