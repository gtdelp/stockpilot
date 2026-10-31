import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { AuthStore } from '../../../core/auth/auth.store';
import { UsersService } from '../../../core/services/users.service';
import { focusFirstInvalid } from '../../../core/utils/forms';
import { AppValidators } from '../../../core/utils/validators';
import { FieldErrorComponent } from '../../../shared/components/field-error/field-error.component';

/**
 * Registro de cuenta con validación asíncrona del correo contra la API.
 */
@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonIcon,
    IonSpinner,
    FieldErrorComponent,
  ],
  templateUrl: './register.page.html',
  styleUrl: '../auth-layout.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  protected readonly auth = inject(AuthStore);
  private readonly users = inject(UsersService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Envío en curso. */
  protected readonly submitting = signal(false);

  /** Formulario tipado con validadores síncronos, asíncronos y de grupo. */
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
    },
    { validators: [AppValidators.matchFields('password', 'confirmPassword')] },
  );

  /** `true` mientras se comprueba el correo (validación asíncrona). */
  protected readonly pending = toSignal(
    this.form.statusChanges.pipe(map((status) => status === 'PENDING')),
    {
      initialValue: false,
    },
  );

  /** Envía el registro. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.submitting.set(true);
    const { fullName, email, password } = this.form.getRawValue();
    const ok = await this.auth.register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });
    this.submitting.set(false);
    if (ok) {
      await this.router.navigateByUrl(this.auth.homeUrl());
    }
  }
}
