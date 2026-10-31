import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { SeriesPoint } from '../../../core/models';
import { formatCurrency, formatNumber } from '../../../core/utils/format';

// Registro selectivo de Chart.js (tree-shaking: solo lo que se usa)
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

/** Tipos de gráfico soportados. */
export type ChartKind = 'line' | 'bar' | 'doughnut';

/** Punto seleccionado por el usuario. */
export interface ChartSelection {
  /** Posición del elemento en la serie. */
  index: number;
  /** Punto de datos seleccionado. */
  point: SeriesPoint;
}

/**
 * Tarjeta con un gráfico de Chart.js, agnóstica respecto a la vista:
 * recibe los datos por inputs y emite `segmentSelected` al pulsar una barra
 * o sector. Incluye una alternativa accesible en forma de tabla.
 */
@Component({
  selector: 'app-chart-card',
  imports: [IonButton, IonIcon, IonSkeletonText],
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartCardComponent implements OnDestroy {
  /** Título visible de la tarjeta. */
  readonly title = input.required<string>();
  /** Descripción breve (también se usa en la etiqueta accesible). */
  readonly description = input('');
  /** Tipo de gráfico. */
  readonly type = input<ChartKind>('bar');
  /** Serie de datos. */
  readonly data = input<SeriesPoint[]>([]);
  /** Nombre de la serie (leyenda/tooltip). */
  readonly seriesLabel = input('Valor');
  /** Formato de los valores. */
  readonly valueFormat = input<'currency' | 'number'>('number');
  /** Muestra un esqueleto de carga. */
  readonly loading = input(false);
  /** Barras horizontales (útil para etiquetas largas). */
  readonly horizontal = input(false);
  /** Clave del punto resaltado (filtro activo). */
  readonly activeKey = input<string | number | null>(null);
  /** Indica si los puntos son pulsables. */
  readonly interactive = input(false);
  /** Modo oscuro: obliga a recalcular los colores desde los tokens CSS. */
  readonly dark = input(false);
  /** Se emite al pulsar un punto (si `interactive`). */
  readonly segmentSelected = output<ChartSelection>();

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;
  private chartType: ChartKind | null = null;

  /** `true` cuando el puntero está sobre un elemento pulsable. */
  readonly pointer = signal(false);

  /** Muestra la tabla alternativa. */
  readonly showTable = signal(false);

  /** Id único para relacionar la tabla con el botón. */
  readonly tableId = `chart-table-${Math.random().toString(36).slice(2, 9)}`;

  /** Resumen textual para lectores de pantalla. */
  readonly summary = computed(() => {
    const points = this.data();
    if (!points.length) {
      return `${this.title()}: sin datos.`;
    }
    const max = points.reduce((best, point) => (point.value > best.value ? point : best));
    return `${this.title()}. ${this.description()} ${points.length} valores. Máximo: ${max.label}, ${this.format(max.value)}.`;
  });

  constructor() {
    // Crea o actualiza el gráfico cuando cambian los datos, el tipo o el tema
    afterRenderEffect(() => {
      const canvas = this.canvas()?.nativeElement;
      const config = this.buildConfig();
      if (!canvas) {
        return;
      }
      if (this.chart && this.chartType === this.type()) {
        this.chart.data = config.data;
        this.chart.options = config.options ?? {};
        this.chart.update();
      } else {
        this.chart?.destroy();
        this.chart = new Chart(canvas, config);
        this.chartType = this.type();
      }
    });
  }

  /** Libera el gráfico (evita fugas de memoria y listeners huérfanos). */
  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.chartType = null;
  }

  /** Alterna la vista de tabla accesible. */
  toggleTable(): void {
    this.showTable.update((value) => !value);
  }

  /** Formatea un valor según `valueFormat`. */
  format(value: number): string {
    return this.valueFormat() === 'currency' ? formatCurrency(value) : formatNumber(value);
  }

  private buildConfig(): ChartConfiguration {
    const points = this.data();
    const type = this.type();
    const activeKey = this.activeKey();
    this.dark();
    const palette = readPalette();
    const textColor = cssVar('--sp-text-muted', '#475569');
    const gridColor = cssVar('--sp-chart-grid', '#e2e8f0');
    const colors = points.map((point, index) => {
      const base = palette[index % palette.length] as string;
      return activeKey !== null && point.key !== activeKey ? withAlpha(base, 0.35) : base;
    });
    const isDoughnut = type === 'doughnut';

    return {
      type,
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: this.seriesLabel(),
            data: points.map((point) => point.value),
            backgroundColor: type === 'line' ? withAlpha(palette[0] as string, 0.12) : colors,
            borderColor:
              type === 'line' ? palette[0] : isDoughnut ? cssVar('--sp-surface', '#fff') : colors,
            borderWidth: type === 'line' ? 2.5 : isDoughnut ? 2 : 0,
            borderRadius: type === 'bar' ? 6 : 0,
            fill: type === 'line',
            tension: 0.35,
            pointRadius: type === 'line' ? 3 : 0,
            pointHoverRadius: 6,
            maxBarThickness: 42,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal() ? 'y' : 'x',
        animation: prefersReducedMotion() ? false : { duration: 400 },
        layout: { padding: 4 },
        onClick: (_event, elements) => {
          const first = elements[0];
          const point = first ? points[first.index] : undefined;
          if (this.interactive() && first && point) {
            this.segmentSelected.emit({ index: first.index, point });
          }
        },
        onHover: (_event, elements) => this.pointer.set(this.interactive() && elements.length > 0),
        plugins: {
          legend: {
            display: isDoughnut,
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 12,
              boxHeight: 12,
              padding: 14,
              font: { family: 'Inter', size: 12 },
            },
          },
          tooltip: {
            callbacks: { label: (context) => ` ${this.format(Number(context.raw))}` },
          },
        },
        scales: isDoughnut
          ? {}
          : {
              x: {
                grid: { display: this.horizontal(), color: gridColor },
                border: { display: false },
                ticks: {
                  color: textColor,
                  font: { family: 'Inter', size: 11 },
                  autoSkip: points.length > 12,
                  maxRotation: 0,
                  ...(this.horizontal()
                    ? { callback: (value: string | number) => this.compact(Number(value)) }
                    : {}),
                },
              },
              y: {
                grid: { display: !this.horizontal(), color: gridColor },
                border: { display: false },
                beginAtZero: true,
                ticks: {
                  color: textColor,
                  font: { family: 'Inter', size: 11 },
                  callback: this.horizontal()
                    ? function (this: { getLabelForValue: (value: number) => string }, value) {
                        const label = this.getLabelForValue(Number(value));
                        return label.length > 22 ? `${label.slice(0, 21)}…` : label;
                      }
                    : (value) => this.compact(Number(value)),
                },
              },
            },
      },
    } as ChartConfiguration;
  }

  private compact(value: number): string {
    const formatted = new Intl.NumberFormat('es-ES', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return this.valueFormat() === 'currency' ? `${formatted} €` : formatted;
  }
}

/** Lee un token CSS del documento (con valor por defecto). */
function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') {
    return fallback;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Paleta de gráficos según el tema activo. */
function readPalette(): string[] {
  const fallback = ['#4338ca', '#0e7490', '#b45309', '#be185d', '#15803d', '#6d28d9'];
  return fallback.map((color, index) => cssVar(`--sp-chart-${index + 1}`, color));
}

/** Convierte un color hexadecimal a `rgba` con transparencia. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return hex;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** `true` si el usuario prefiere reducir animaciones. */
function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
