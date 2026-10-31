import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth.store';
import { DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL } from '../../../core/demo/demo-data';
import { focusFirstInvalid } from '../../../core/utils/forms';
import { AppValidators } from '../../../core/utils/validators';
import { FieldErrorComponent } from '../../../shared/components/field-error/field-error.component';

/**
 * Inicio de sesión con formulario reactivo tipado.
 */
@Component({
  selector: 'app-login-page',
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
  templateUrl: './login.page.html',
  styleUrl: '../auth-layout.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** URL a la que volver tras iniciar sesión (query param `redirect`). */
  readonly redirect = input<string>();

  /** Modo demostración: muestra accesos rápidos. */
  protected readonly demoMode = environment.demoMode;
  /** Envío en curso. */
  protected readonly submitting = signal(false);

  /** Formulario tipado de acceso. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, AppValidators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Rellena el formulario con una cuenta de demostración. */
  protected fillDemo(role: 'admin' | 'user'): void {
    this.form.setValue({
      email: role === 'admin' ? DEMO_ADMIN_EMAIL : DEMO_USER_EMAIL,
      password: 'demostracion',
    });
    this.auth.clearError();
  }

  /** Envía el formulario. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    const ok = await this.auth.login(email, password);
    this.submitting.set(false);
    if (ok) {
      const target = this.redirect()?.startsWith('/') ? this.redirect() : this.auth.homeUrl();
      await this.router.navigateByUrl(target ?? '/');
    }
  }
}
