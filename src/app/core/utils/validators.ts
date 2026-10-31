import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

/** Expresión de correo razonable (más estricta que la de Angular). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validadores síncronos y asíncronos reutilizables de StockPilot.
 */
export class AppValidators {
  /** Correo electrónico con dominio y extensión. */
  static email(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();
    if (!value) {
      return null;
    }
    return EMAIL_PATTERN.test(value) ? null : { email: true };
  }

  /**
   * Contraseña robusta: mínimo 8 caracteres, mayúscula, minúscula y número.
   * Devuelve qué requisitos faltan para mostrarlos al usuario.
   */
  static strongPassword(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value ?? '';
    if (!value) {
      return null;
    }
    const missing: string[] = [];
    if (value.length < 8) {
      missing.push('8 caracteres');
    }
    if (!/[A-Z]/.test(value)) {
      missing.push('una mayúscula');
    }
    if (!/[a-z]/.test(value)) {
      missing.push('una minúscula');
    }
    if (!/\d/.test(value)) {
      missing.push('un número');
    }
    return missing.length ? { strongPassword: { missing } } : null;
  }

  /** Validador de grupo: dos campos deben coincidir (p. ej. contraseña y confirmación). */
  static matchFields(field: string, confirmField: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const confirm = group.get(confirmField);
      if (!confirm) {
        return null;
      }
      const mismatch = group.get(field)?.value !== confirm.value && Boolean(confirm.value);
      const otherErrors = { ...(confirm.errors ?? {}) };
      delete otherErrors['mismatch'];
      if (mismatch) {
        confirm.setErrors({ ...otherErrors, mismatch: true });
      } else {
        confirm.setErrors(Object.keys(otherErrors).length ? otherErrors : null);
      }
      return null;
    };
  }

  /** Número estrictamente mayor que cero. */
  static positive(control: AbstractControl<number | null>): ValidationErrors | null {
    const value = control.value;
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    return Number(value) > 0 ? null : { positive: true };
  }

  /** Número entero mayor o igual que cero. */
  static nonNegativeInteger(control: AbstractControl<number | null>): ValidationErrors | null {
    const value = control.value;
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    return Number.isInteger(Number(value)) && Number(value) >= 0
      ? null
      : { nonNegativeInteger: true };
  }

  /** Código SKU: 3–4 letras, guion y 4–6 dígitos (p. ej. ELE-0001). */
  static sku(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();
    if (!value) {
      return null;
    }
    return /^[A-Z]{3,4}-\d{4,6}$/.test(value) ? null : { sku: true };
  }

  /**
   * Fábrica de validadores asíncronos de disponibilidad (correo, SKU...).
   * Espera `debounceMs` antes de consultar; como Angular cancela la suscripción
   * anterior con cada cambio, `timer` + `switchMap` descarta las peticiones obsoletas.
   *
   * @param check Función que consulta la API y devuelve si el valor está libre.
   * @param errorKey Clave del error cuando el valor ya existe.
   * @param initialValue Valor original (en edición) que no debe marcarse como duplicado.
   */
  static availability(
    check: (value: string) => Observable<boolean>,
    errorKey: string,
    debounceMs = 400,
    initialValue?: string,
  ): AsyncValidatorFn {
    return (control: AbstractControl<string>): Observable<ValidationErrors | null> => {
      const value = control.value?.trim();
      if (
        !value ||
        control.hasError('email') ||
        control.hasError('sku') ||
        value === initialValue
      ) {
        return of(null);
      }
      return timer(debounceMs).pipe(
        switchMap(() => check(value)),
        map((available) => (available ? null : { [errorKey]: true })),
        // Si la comprobación falla no bloqueamos el formulario: el servidor validará de nuevo
        catchError(() => of(null)),
      );
    };
  }
}
