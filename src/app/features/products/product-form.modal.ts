import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { Category, Product, ProductInput, Supplier, toApiError } from '../../core/models';
import { ProductsService } from '../../core/services/products.service';
import { focusFirstInvalid } from '../../core/utils/forms';
import { AppValidators } from '../../core/utils/validators';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';

/**
 * Formulario de alta/edición de producto. Valida el SKU de forma asíncrona
 * contra la API y devuelve los datos al cerrar con `role: 'save'`.
 */
@Component({
  selector: 'app-product-form-modal',
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonIcon,
    IonSpinner,
    FieldErrorComponent,
  ],
  templateUrl: './product-form.modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly products = inject(ProductsService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Producto a editar (`null` para crear). */
  readonly product = input<Product | null>(null);
  /** Categorías disponibles. */
  readonly categories = input<Category[]>([]);
  /** Proveedores disponibles. */
  readonly suppliers = input<Supplier[]>([]);
  /** Función de guardado (la aporta la vista padre). */
  readonly onSave = input.required<(value: ProductInput, id?: number) => Promise<unknown>>();

  /** Guardado en curso. */
  protected readonly saving = signal(false);
  /** Error del servidor. */
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    sku: ['', [Validators.required, AppValidators.sku]],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    supplierId: [0, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, AppValidators.positive]],
    stock: [0, [Validators.required, AppValidators.nonNegativeInteger]],
    minStock: [5, [Validators.required, AppValidators.nonNegativeInteger]],
    active: [true],
  });

  /** Rellena el formulario en modo edición y configura la validación asíncrona del SKU. */
  ngOnInit(): void {
    const product = this.product();
    if (product) {
      this.form.patchValue(product);
    }
    this.form.controls.sku.addAsyncValidators(
      AppValidators.availability(
        (sku) => this.products.isSkuAvailable(sku, product?.id),
        'skuTaken',
        400,
        product?.sku,
      ),
    );
  }

  /** Normaliza el SKU a mayúsculas mientras se escribe. */
  protected upperSku(): void {
    const control = this.form.controls.sku;
    const upper = control.value.toUpperCase();
    if (upper !== control.value) {
      control.setValue(upper);
    }
  }

  /** Cierra sin guardar. */
  protected cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Valida y guarda. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.saving.set(true);
    this.serverError.set(null);
    const value = this.form.getRawValue();
    try {
      await this.onSave()(
        {
          ...value,
          price: Number(value.price),
          stock: Number(value.stock),
          minStock: Number(value.minStock),
        },
        this.product()?.id,
      );
      await this.modalCtrl.dismiss(true, 'save');
    } catch (error) {
      this.serverError.set(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
