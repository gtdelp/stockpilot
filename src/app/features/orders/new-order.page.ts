import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { catchError, firstValueFrom, map, of, startWith } from 'rxjs';
import { Product, toApiError } from '../../core/models';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { ToastService } from '../../core/services/toast.service';
import { focusFirstInvalid } from '../../core/utils/forms';
import { formatCurrency } from '../../core/utils/format';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';

/** Línea del formulario de pedido. */
type OrderLineForm = FormGroup<{
  productId: FormControl<number | null>;
  quantity: FormControl<number>;
}>;

/**
 * Creación de pedidos con un `FormArray` de líneas, validación de stock
 * por línea, detección de productos duplicados y total calculado en vivo.
 */
@Component({
  selector: 'app-new-order-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonSkeletonText,
    IonSpinner,
    PageHeaderComponent,
    FieldErrorComponent,
  ],
  templateUrl: './new-order.page.html',
  styleUrl: './new-order.page.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrderPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly ordersApi = inject(OrdersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly help = inject(HelpService);

  /** Productos disponibles (activos y con stock). */
  protected readonly products = toSignal(
    inject(ProductsService)
      .list()
      .pipe(
        map((items) => items.filter((product) => product.active && product.stock > 0)),
        catchError(() => of([] as Product[])),
      ),
  );
  protected readonly loadingProducts = computed(() => this.products() === undefined);
  private readonly productMap = computed(
    () => new Map((this.products() ?? []).map((product) => [product.id, product])),
  );

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    lines: this.fb.array<OrderLineForm>([], [Validators.required, uniqueProducts]),
    notes: this.fb.control('', [Validators.maxLength(300)]),
  });

  /** Valor del formulario como señal para calcular el total en vivo. */
  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  /** Importe total del pedido. */
  protected readonly total = computed(() => {
    const lines = this.value().lines ?? [];
    const products = this.productMap();
    return lines.reduce((sum, line) => {
      const product = line.productId ? products.get(line.productId) : undefined;
      return sum + (product ? product.price * (Number(line.quantity) || 0) : 0);
    }, 0);
  });

  /** Unidades totales. */
  protected readonly units = computed(() =>
    (this.value().lines ?? []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
  );

  constructor() {
    this.addLine();
  }

  /** Acceso tipado al array de líneas. */
  protected get lines(): FormArray<OrderLineForm> {
    return this.form.controls.lines;
  }

  /** Añade una línea vacía. */
  protected addLine(): void {
    this.lines.push(
      this.fb.group(
        {
          productId: this.fb.control<number | null>(null, Validators.required),
          quantity: this.fb.control(1, [
            Validators.required,
            Validators.min(1),
            AppIntegerValidator,
          ]),
        },
        { validators: [this.stockValidator()] },
      ),
    );
  }

  /** Elimina una línea. */
  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  /** Producto seleccionado en una línea. */
  protected productOf(index: number): Product | undefined {
    const id = this.value().lines?.[index]?.productId;
    return id ? this.productMap().get(id) : undefined;
  }

  /** Subtotal de una línea. */
  protected subtotal(index: number): string {
    const product = this.productOf(index);
    const quantity = Number(this.value().lines?.[index]?.quantity) || 0;
    return formatCurrency(product ? product.price * quantity : 0);
  }

  /** Formatea importes. */
  protected currency(value: number): string {
    return formatCurrency(value);
  }

  /** Envía el pedido. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host);
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    const value = this.form.getRawValue();
    try {
      const order = await firstValueFrom(
        this.ordersApi.create({
          items: value.lines.map((line) => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity),
          })),
          notes: value.notes.trim() || null,
        }),
      );
      void this.toast.success(`Pedido #${order.id} creado correctamente.`);
      await this.router.navigate(['/pedidos']);
    } catch (error) {
      this.serverError.set(toApiError(error).message);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Validador de grupo: la cantidad no puede superar el stock del producto elegido. */
  private stockValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const productId = group.get('productId')?.value as number | null;
      const quantityControl = group.get('quantity');
      const product = productId ? this.productMap().get(productId) : undefined;
      if (!quantityControl || !product) {
        return null;
      }
      const errors = { ...(quantityControl.errors ?? {}) };
      delete errors['stock'];
      if (Number(quantityControl.value) > product.stock) {
        quantityControl.setErrors(
          { ...errors, stock: { available: product.stock } },
          { emitEvent: true },
        );
      } else {
        quantityControl.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: true });
      }
      return null;
    };
  }
}

/** Cantidad entera. */
function AppIntegerValidator(control: AbstractControl<number>): ValidationErrors | null {
  return control.value === null || Number.isInteger(Number(control.value))
    ? null
    : { nonNegativeInteger: true };
}

/** Validador del array: un producto no puede repetirse en varias líneas. */
function uniqueProducts(control: AbstractControl): ValidationErrors | null {
  const ids = (control.value as { productId: number | null }[])
    .map((line) => line.productId)
    .filter(Boolean);
  return new Set(ids).size === ids.length ? null : { duplicate: true };
}
