import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  relativeChange,
} from '../../../core/utils/format';

/** Formato del valor del indicador. */
export type KpiFormat = 'currency' | 'number' | 'percent';

/**
 * Tarjeta de indicador clave (KPI) con tendencia respecto al periodo anterior.
 * Si es `selectable` se comporta como un botón y emite `selected`.
 */
@Component({
  selector: 'app-kpi-card',
  imports: [NgTemplateOutlet, IonIcon, IonSkeletonText],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  /** Nombre del indicador. */
  readonly label = input.required<string>();
  /** Valor actual. */
  readonly value = input.required<number>();
  /** Valor del periodo anterior (para calcular la tendencia). */
  readonly previous = input<number | null>(null);
  /** Formato de presentación. */
  readonly format = input<KpiFormat>('number');
  /** Icono de Ionicons. */
  readonly icon = input('stats-chart-outline');
  /** Texto secundario (p. ej. "vs. periodo anterior"). */
  readonly caption = input('');
  /** Si `true`, una subida es negativa (p. ej. stock bajo). */
  readonly invertTrend = input(false);
  /** Muestra un esqueleto de carga. */
  readonly loading = input(false);
  /** Hace la tarjeta pulsable. */
  readonly selectable = input(false);
  /** Resalta la tarjeta como filtro activo. */
  readonly active = input(false);
  /** Se emite al pulsar una tarjeta seleccionable. */
  readonly selected = output<void>();

  /** Valor formateado. */
  readonly displayValue = computed(() => formatValue(this.value(), this.format()));

  /** Variación relativa respecto al periodo anterior. */
  readonly change = computed(() => {
    const previous = this.previous();
    return previous === null ? null : relativeChange(this.value(), previous);
  });

  /** Tendencia visual: positiva, negativa o neutra. */
  readonly trend = computed<'up' | 'down' | 'flat'>(() => {
    const change = this.change();
    if (change === null || Math.abs(change) < 0.005) {
      return 'flat';
    }
    return change > 0 ? 'up' : 'down';
  });

  /** `true` si la tendencia es buena para el negocio. */
  readonly trendIsGood = computed(() => (this.trend() === 'up') !== this.invertTrend());

  /** Texto de tendencia legible (también para lectores de pantalla). */
  readonly trendText = computed(() => {
    const change = this.change();
    if (change === null) {
      return '';
    }
    const sign = change > 0 ? '+' : '';
    return `${sign}${formatPercent(change)}`;
  });

  /** Descripción completa para lectores de pantalla. */
  readonly ariaLabel = computed(() => {
    const trend = this.trendText() ? `, variación ${this.trendText()} ${this.caption()}` : '';
    return `${this.label()}: ${this.displayValue()}${trend}`;
  });
}

/** Formatea el valor según el tipo de indicador. */
function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    default:
      return formatNumber(value);
  }
}
