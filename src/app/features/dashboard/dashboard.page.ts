import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import {
  Subject,
  Subscription,
  combineLatest,
  debounceTime,
  map,
  startWith,
  catchError,
  of,
} from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import {
  ActivityEvent,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  OrderStatus,
  SeriesPoint,
  StatsFilter,
} from '../../core/models';
import { RealtimeProvider } from '../../core/realtime/realtime-provider';
import { CatalogService } from '../../core/services/catalog.service';
import { ReportService } from '../../core/services/report.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { toIsoDate } from '../../core/utils/csv';
import { formatCurrency, formatNumber } from '../../core/utils/format';
import {
  ChartCardComponent,
  ChartSelection,
} from '../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ExportMenuComponent } from '../../shared/components/export-menu/export-menu.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { HelpService } from '../help/help.service';
import { ActivityFeedComponent } from './activity-feed.component';
import { DashboardStore } from './dashboard.store';

/** Rango por defecto: los últimos 12 meses completos hasta hoy. */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 11, 1)),
    to: toIsoDate(today),
  };
}

/**
 * Cuadro de mando del Administrador: KPIs, gráficos interactivos, filtros en
 * tiempo real y feed de actividad (Firestore). Los datos SQL se cargan en
 * paralelo y se recargan solos cuando llegan pedidos nuevos.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    FormsModule,
    IonContent,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    PageHeaderComponent,
    KpiCardComponent,
    ChartCardComponent,
    ExportMenuComponent,
    EmptyStateComponent,
    ActivityFeedComponent,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  host: { class: 'sp-page-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit, OnDestroy {
  protected readonly store = inject(DashboardStore);
  protected readonly theme = inject(ThemeService);
  private readonly realtime = inject(RealtimeProvider);
  private readonly reports = inject(ReportService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  protected readonly help = inject(HelpService);

  // --- Filtros (enlazados en ambos sentidos con [(ngModel)]) ---
  protected readonly from = signal(defaultRange().from);
  protected readonly to = signal(defaultRange().to);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly status = signal<OrderStatus | null>(null);

  /** Filtro consolidado y validado. */
  protected readonly filter = computed<StatsFilter>(() => {
    const from = this.from() || defaultRange().from;
    const to = this.to() || defaultRange().to;
    return {
      from: from <= to ? from : to,
      to: from <= to ? to : from,
      categoryId: this.categoryId(),
      status: this.status(),
    };
  });

  /** `true` si hay algún filtro distinto del predeterminado. */
  protected readonly hasFilters = computed(() => {
    const range = defaultRange();
    return (
      this.from() !== range.from ||
      this.to() !== range.to ||
      this.categoryId() !== null ||
      this.status() !== null
    );
  });

  protected readonly categories = toSignal(
    inject(CatalogService)
      .categories()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly statuses = ORDER_STATUSES.map((value) => ({
    value,
    label: ORDER_STATUS_LABELS[value],
  }));

  // --- Tiempo real ---
  protected readonly activity = signal<ActivityEvent[]>([]);
  protected readonly activityLoading = signal(true);
  protected readonly realtimeConnected = signal(true);
  protected readonly exporting = signal(false);

  private readonly refresh$ = new Subject<void>();
  private activitySubscription: Subscription | null = null;
  private lastEventId: string | null = null;

  /** Datos de la página: atajos a las series del store. */
  protected readonly kpis = computed(() => this.store.data()?.kpis ?? null);
  protected readonly salesByMonth = computed(() => this.store.data()?.salesByMonth ?? []);
  protected readonly stockByCategory = computed(() => this.store.data()?.stockByCategory ?? []);
  protected readonly topProducts = computed(() => this.store.data()?.topProducts ?? []);
  protected readonly ordersByStatus = computed(() => this.store.data()?.ordersByStatus ?? []);

  constructor() {
    // Filtros + recargas por tiempo real → una sola petición combinada (forkJoin en el servicio)
    const filter$ = toObservable(this.filter).pipe(debounceTime(250));
    const trigger$ = combineLatest([filter$, this.refresh$.pipe(startWith(undefined))]).pipe(
      map(([filter]) => filter),
    );
    this.store.load(trigger$);
  }

  /** Abre la suscripción al feed de actividad en tiempo real. */
  ngOnInit(): void {
    this.activitySubscription = this.realtime.activity$(20).subscribe({
      next: (events) => {
        const newest = events[0];
        // Un evento de pedido nuevo recalcula los indicadores automáticamente
        if (
          this.lastEventId &&
          newest &&
          newest.id !== this.lastEventId &&
          newest.type.startsWith('order')
        ) {
          this.refresh$.next();
        }
        this.lastEventId = newest?.id ?? null;
        this.activity.set(events);
        this.activityLoading.set(false);
        this.realtimeConnected.set(true);
      },
      error: () => {
        this.activityLoading.set(false);
        this.realtimeConnected.set(false);
      },
    });
  }

  /** Cierra el listener de Firestore para evitar fugas de memoria. */
  ngOnDestroy(): void {
    this.activitySubscription?.unsubscribe();
    this.activitySubscription = null;
  }

  /** Reintenta la carga tras un error. */
  protected retry(): void {
    this.refresh$.next();
  }

  /** Restablece los filtros por defecto. */
  protected resetFilters(): void {
    const range = defaultRange();
    this.from.set(range.from);
    this.to.set(range.to);
    this.categoryId.set(null);
    this.status.set(null);
  }

  /** Filtra por categoría al pulsar el gráfico (o quita el filtro si ya estaba). */
  protected selectCategory(selection: ChartSelection): void {
    const id = Number(selection.point.key);
    this.categoryId.set(this.categoryId() === id ? null : id);
  }

  /** Filtra por estado al pulsar el gráfico (o quita el filtro si ya estaba). */
  protected selectStatus(selection: ChartSelection): void {
    const status = selection.point.key as OrderStatus;
    this.status.set(this.status() === status ? null : status);
  }

  /** Atajo desde el KPI de pedidos pendientes. */
  protected togglePending(): void {
    this.status.set(this.status() === 'pending' ? null : 'pending');
  }

  /** Exporta las ventas mensuales a CSV. */
  protected exportCsv(): void {
    const file = this.reports.exportCsv<SeriesPoint>({
      entity: 'cuadro-de-mando-ventas',
      columns: [
        { header: 'Mes', value: (row) => row.label },
        { header: 'Ventas (EUR)', value: (row) => row.value, align: 'right' },
      ],
      rows: this.salesByMonth(),
    });
    void this.toast.success(`Descargado ${file}`);
  }

  /** Exporta un informe PDF con KPIs y ventas mensuales. */
  protected async exportPdf(): Promise<void> {
    const kpis = this.kpis();
    this.exporting.set(true);
    try {
      const file = await this.reports.exportPdf<SeriesPoint>({
        title: 'Informe del cuadro de mando',
        entity: 'cuadro-de-mando',
        author: this.auth.profile()?.fullName,
        filters: this.describeFilters(),
        summary: kpis
          ? [
              `Ventas: ${formatCurrency(kpis.revenue)}`,
              `Pedidos: ${formatNumber(kpis.orders)}`,
              `Ticket medio: ${formatCurrency(kpis.avgTicket)}`,
              `Pendientes: ${formatNumber(kpis.pendingOrders)}`,
              `Stock bajo: ${formatNumber(kpis.lowStock)}`,
            ]
          : [],
        columns: [
          { header: 'Mes', value: (row) => row.label },
          { header: 'Ventas', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: this.salesByMonth(),
        totals: [
          'Total',
          formatCurrency(this.salesByMonth().reduce((sum, row) => sum + row.value, 0)),
        ],
      });
      void this.toast.success(`Descargado ${file}`);
    } catch {
      void this.toast.error('No se ha podido generar el PDF.');
    } finally {
      this.exporting.set(false);
    }
  }

  /** Nombre de la categoría filtrada. */
  protected categoryName(id: number | null): string {
    return this.categories().find((category) => category.id === id)?.name ?? '';
  }

  private describeFilters(): string[] {
    const filter = this.filter();
    const parts = [`Desde ${filter.from} hasta ${filter.to}`];
    if (filter.categoryId) {
      parts.push(`Categoría: ${this.categoryName(filter.categoryId)}`);
    }
    if (filter.status) {
      parts.push(`Estado: ${ORDER_STATUS_LABELS[filter.status]}`);
    }
    return parts;
  }
}
