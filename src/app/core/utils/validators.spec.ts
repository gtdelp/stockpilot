import { FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom, isObservable, of, Observable } from 'rxjs';
import { ValidationErrors } from '@angular/forms';
import { AppValidators } from './validators';

describe('AppValidators', () => {
  it('valida contraseñas robustas indicando lo que falta', () => {
    expect(
      AppValidators.strongPassword(new FormControl('Segura123', { nonNullable: true })),
    ).toBeNull();
    expect(AppValidators.strongPassword(new FormControl('abc', { nonNullable: true }))).toEqual({
      strongPassword: { missing: ['8 caracteres', 'una mayúscula', 'un número'] },
    });
  });

  it('valida correos con dominio', () => {
    expect(
      AppValidators.email(new FormControl('ana@empresa.es', { nonNullable: true })),
    ).toBeNull();
    expect(AppValidators.email(new FormControl('ana@empresa', { nonNullable: true }))).toEqual({
      email: true,
    });
  });

  it('valida el formato de SKU', () => {
    expect(AppValidators.sku(new FormControl('ELE-0001', { nonNullable: true }))).toBeNull();
    expect(AppValidators.sku(new FormControl('ele-1', { nonNullable: true }))).toEqual({
      sku: true,
    });
  });

  it('valida números positivos y enteros no negativos', () => {
    expect(AppValidators.positive(new FormControl(0))).toEqual({ positive: true });
    expect(AppValidators.positive(new FormControl(0.5))).toBeNull();
    expect(AppValidators.nonNegativeInteger(new FormControl(2.5))).toEqual({
      nonNegativeInteger: true,
    });
    expect(AppValidators.nonNegativeInteger(new FormControl(0))).toBeNull();
  });

  it('marca la confirmación cuando las contraseñas no coinciden', () => {
    const group = new FormGroup(
      { password: new FormControl('Segura123'), confirm: new FormControl('Otra1234') },
      { validators: AppValidators.matchFields('password', 'confirm') },
    );
    expect(group.controls.confirm.hasError('mismatch')).toBe(true);
    group.controls.confirm.setValue('Segura123');
    expect(group.controls.confirm.hasError('mismatch')).toBe(false);
  });

  describe('availability (validación asíncrona)', () => {
    const run = (validatorResult: unknown): Promise<ValidationErrors | null> =>
      isObservable(validatorResult)
        ? firstValueFrom(validatorResult as Observable<ValidationErrors | null>)
        : Promise.resolve(validatorResult as ValidationErrors | null);

    it('devuelve el error cuando el valor ya existe', async () => {
      const validator = AppValidators.availability(() => of(false), 'emailTaken', 0);
      expect(await run(validator(new FormControl('ana@empresa.es')))).toEqual({ emailTaken: true });
    });

    it('no consulta la API para valores vacíos o iguales al original', async () => {
      const check = vi.fn(() => of(false));
      const validator = AppValidators.availability(check, 'skuTaken', 0, 'ELE-0001');
      expect(await run(validator(new FormControl('')))).toBeNull();
      expect(await run(validator(new FormControl('ELE-0001')))).toBeNull();
      expect(check).not.toHaveBeenCalled();
    });

    it('no bloquea el formulario si la comprobación falla', async () => {
      const validator = AppValidators.availability(
        () => new Observable<boolean>((subscriber) => subscriber.error(new Error('red'))),
        'emailTaken',
        0,
      );
      expect(await run(validator(new FormControl('ana@empresa.es')))).toBeNull();
    });
  });
});
