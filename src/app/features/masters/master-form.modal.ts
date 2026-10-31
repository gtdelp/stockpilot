import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { ModalController } from '@ionic/angular/modal-controller';
import { Category, CategoryInput, Supplier, SupplierInput, toApiError } from '../../core/models';
import { focusFirstInvalid } from '../../core/utils/forms';
import { AppValidators } from '../../core/utils/validators';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';

/** Tipo de registro maestro. */
export type MasterKind = 'category' | 'supplier';

/**
 * Formulario reutilizable para categorías y proveedores.
 */
@Component({
  selector: 'app-master-form-modal',
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonTextarea,
    IonButton,
    IonIcon,
    IonSpinner,
    FieldErrorComponent,
  ],
  templateUrl: './master-form.modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MasterFormModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Tipo de registro. */
  readonly kind = input.required<MasterKind>();
  /** Registro a editar (`null` para crear). */
  readonly item = input<Category | Supplier | null>(null);
  /** Función de guardado (la aporta la vista padre). */
  readonly onSave =
    input.required<(value: CategoryInput | SupplierInput, id?: number) => Promise<unknown>>();

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly isSupplier = computed(() => this.kind() === 'supplier');
  protected readonly title = computed(() => {
    const noun = this.isSupplier() ? 'proveedor' : 'categoría';
    return this.item()
      ? `Editar ${noun}`
      : this.isSupplier()
        ? 'Nuevo proveedor'
        : 'Nueva categoría';
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(200)]],
    email: [''],
    phone: ['', [Validators.maxLength(20)]],
    city: ['', [Validators.maxLength(60)]],
  });

  /** Ajusta validadores según el tipo y rellena en modo edición. */
  ngOnInit(): void {
    if (this.isSupplier()) {
      this.form.controls.email.setValidators([Validators.required, AppValidators.email]);
    }
    const item = this.item();
    if (item) {
      this.form.patchValue({
        name: item.name,
        description: 'description' in item ? (item.description ?? '') : '',
        email: 'email' in item ? item.email : '',
        phone: 'phone' in item ? (item.phone ?? '') : '',
        city: 'city' in item ? (item.city ?? '') : '',
      });
    }
  }

  /** Cierra sin guardar. */
  protected cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Valida y guarda. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    const value = this.form.getRawValue();
    const payload: CategoryInput | SupplierInput = this.isSupplier()
      ? {
          name: value.name.trim(),
          email: value.email.trim(),
          phone: value.phone.trim() || null,
          city: value.city.trim() || null,
        }
      : { name: value.name.trim(), description: value.description.trim() || null };
    this.saving.set(true);
    this.serverError.set(null);
    try {
      await this.onSave()(payload, this.item()?.id);
      await this.modalCtrl.dismiss(true, 'save');
    } catch (error) {
      this.serverError.set(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
