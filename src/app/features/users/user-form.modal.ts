import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonRadio } from '@ionic/angular/ion-radio';
import { IonRadioGroup } from '@ionic/angular/ion-radio-group';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { map } from 'rxjs';
import { CreateUserInput, ROLE_LABELS, Role, toApiError } from '../../core/models';
import { UsersService } from '../../core/services/users.service';
import { focusFirstInvalid } from '../../core/utils/forms';
import { AppValidators } from '../../core/utils/validators';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';

/**
 * Alta de usuario por un administrador con validación asíncrona del correo.
 */
@Component({
  selector: 'app-user-form-modal',
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonInputPasswordToggle,
    IonRadioGroup,
    IonRadio,
    IonButton,
    IonIcon,
    IonSpinner,
    FieldErrorComponent,
  ],
  templateUrl: './user-form.modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly users = inject(UsersService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Función de guardado (la aporta la vista padre). */
  readonly onSave = input.required<(value: CreateUserInput) => Promise<unknown>>();

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly roles: { value: Role; label: string; description: string }[] = [
    {
      value: 'user',
      label: ROLE_LABELS.user,
      description: 'Consulta el catálogo y gestiona sus pedidos.',
    },
    {
      value: 'admin',
      label: ROLE_LABELS.admin,
      description: 'Acceso completo: inventario, pedidos, usuarios y panel.',
    },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      email: [
        '',
        {
          validators: [Validators.required, AppValidators.email],
          asyncValidators: [
            AppValidators.availability((email) => this.users.isEmailAvailable(email), 'emailTaken'),
          ],
        },
      ],
      password: ['', [Validators.required, AppValidators.strongPassword]],
      confirmPassword: ['', [Validators.required]],
      role: ['user' as Role, [Validators.required]],
    },
    { validators: [AppValidators.matchFields('password', 'confirmPassword')] },
  );

  protected readonly pending = toSignal(
    this.form.statusChanges.pipe(map((status) => status === 'PENDING')),
    {
      initialValue: false,
    },
  );

  /** Cierra sin guardar. */
  protected cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Valida y crea el usuario. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.saving.set(true);
    this.serverError.set(null);
    const { fullName, email, password, role } = this.form.getRawValue();
    try {
      await this.onSave()({ fullName: fullName.trim(), email: email.trim(), password, role });
      await this.modalCtrl.dismiss(true, 'save');
    } catch (error) {
      this.serverError.set(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
