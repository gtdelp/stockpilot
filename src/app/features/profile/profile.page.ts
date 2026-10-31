import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ROLE_LABELS, toApiError } from '../../core/models';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { formatDate, initials } from '../../core/utils/format';
import { focusFirstInvalid } from '../../core/utils/forms';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';

/**
 * Perfil del usuario: datos de la cuenta, edición del nombre y preferencias.
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonToggle,
    PageHeaderComponent,
    FieldErrorComponent,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnInit {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  protected readonly help = inject(HelpService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly saving = signal(false);
  protected readonly initials = computed(() => initials(this.auth.profile()?.fullName ?? ''));
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly since = computed(() => {
    const profile = this.auth.profile();
    return profile ? formatDate(profile.createdAt) : '';
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
  });

  /** Rellena el formulario con el nombre actual. */
  ngOnInit(): void {
    this.form.setValue({ fullName: this.auth.profile()?.fullName ?? '' });
  }

  /** Guarda el nombre. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.saving.set(true);
    try {
      const profile = await firstValueFrom(
        this.users.updateMe(this.form.getRawValue().fullName.trim()),
      );
      this.auth.setProfile(profile);
      this.form.markAsPristine();
      void this.toast.success('Perfil actualizado.');
    } catch (error) {
      void this.toast.error(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
