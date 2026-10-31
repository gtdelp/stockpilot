import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { formatCurrency, formatDate, formatNumber } from '../../../core/utils/format';

/** Tipo de dato de una columna (define formato y alineación). */
export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'badge';

/** Variante visual de una etiqueta. */
export type BadgeVariant =
  'pending' | 'processing' | 'shipped' | 'cancelled' | 'neutral' | 'primary';

/** Definición de una columna de la tabla. */
export interface TableColumn<T> {
  /** Identificador único de la columna. */
  key: string;
  /** Texto de la cabecera. */
  header: string;
  /** Valor bruto usado para ordenar, buscar y mostrar. */
  value: (row: T) => string | number | boolean | null | undefined;
  /** Tipo de dato. */
  type?: ColumnType;
  /** Permite ordenar por esta columna. */
  sortable?: boolean;
  /** Etiqueta para columnas `badge`. */
  badge?: (row: T) => { label: string; variant: BadgeVariant } | null;
  /** Oculta la columna en la vista de tarjetas (móvil). */
  hideOnMobile?: boolean;
  /** Se usa como título de la tarjeta en móvil. */
  primary?: boolean;
}

/** Acción disponible en cada fila. */
export interface TableAction<T> {
  /** Identificador único. */
  id: string;
  /** Texto visible. */
  label: string;
  /** Nombre del icono de Ionicons. */
  icon: string;
  /** Color de Ionic del botón. */
  color?: 'primary' | 'danger' | 'medium';
  /** Muestra la acción solo para determinadas filas. */
  visible?: (row: T) => boolean;
}

/** Criterio de ordenación. */
export interface SortState {
  /** Clave de la columna o del punto. */
  key: string;
  /** Sentido de la ordenación. */
  direction: 'asc' | 'desc';
}

/** Evento de acción sobre una fila. */
export interface RowActionEvent<T> {
  /** Identificador de la acción. */
  action: string;
  /** Fila afectada. */
  row: T;
}

/**
 * Tabla de datos avanzada, genérica y agnóstica respecto a la vista.
 *
 * - Búsqueda con *debounce* y enlace bidireccional `[(search)]`.
 * - Ordenación por columnas, paginación y selección múltiple.
 * - Acciones por fila, esqueleto de carga y estado vacío.
 * - Accesible: `<table>` semántica con `caption`, `scope` y `aria-sort`;
 *   filas operables con teclado; resultados anunciados con `aria-live`.
 * - Mobile-first: en pantallas estrechas se muestra como lista de tarjetas.
 *
 * Recibe datos por `input()` y notifica las interacciones mediante `output()`.
 *
 * @example
 * <app-data-table [rows]="products()" [columns]="columns" caption="Productos"
 *   [(search)]="query" (rowClick)="open($event)" (rowAction)="onAction($event)" />
 */
@Component({
  selector: 'app-data-table',
  imports: [IonButton, IonIcon, IonSkeletonText],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /** Filas a mostrar. */
  readonly rows = input.required<readonly T[]>();
  /** Definición de columnas. */
  readonly columns = input.required<TableColumn<T>[]>();
  /** Título accesible de la tabla (`caption`). */
  readonly caption = input.required<string>();
  /** Clave única de cada fila (para `track` y selección). */
  readonly rowKey = input<(row: T) => string | number>((row) => JSON.stringify(row));
  /** Acciones por fila. */
  readonly actions = input<TableAction<T>[]>([]);
  /** Muestra el esqueleto de carga. */
  readonly loading = input(false);
  /** Muestra el buscador. */
  readonly searchable = input(true);
  /** Texto de ejemplo del buscador. */
  readonly searchPlaceholder = input('Buscar…');
  /** Habilita la selección múltiple. */
  readonly selectable = input(false);
  /** Filas por página. */
  readonly pageSize = input(10);
  /** Las filas son pulsables (emite `rowClick`). */
  readonly clickable = input(false);
  /** Título del estado vacío. */
  readonly emptyTitle = input('No hay datos');
  /** Mensaje del estado vacío. */
  readonly emptyMessage = input('Prueba a cambiar los filtros o la búsqueda.');
  /** Ordenación inicial. */
  readonly initialSort = input<SortState | null>(null);

  /** Texto de búsqueda (enlace bidireccional `[(search)]`, ya con debounce). */
  readonly search = model('');

  /** Fila pulsada o activada con Intro. */
  readonly rowClick = output<T>();
  /** Acción ejecutada sobre una fila. */
  readonly rowAction = output<RowActionEvent<T>>();
  /** Filas seleccionadas. */
  readonly selectionChange = output<T[]>();
  /** Cambio de ordenación. */
  readonly sortChange = output<SortState | null>();
  /** Cambio de página (base 1). */
  readonly pageChange = output<number>();
  /** Filas visibles tras búsqueda y ordenación (para exportar lo que se ve). */
  readonly viewChange = output<T[]>();

  /** Valor del campo mientras se escribe (antes del debounce). */
  readonly draft = signal('');
  /** Ordenación actual. */
  readonly sort = linkedSignal<SortState | null>(() => this.initialSort());
  /** Página actual (base 1). */
  readonly page = signal(1);
  /** Claves de las filas seleccionadas. */
  readonly selectedKeys = signal<ReadonlySet<string | number>>(new Set());

  /** Id único para asociar etiquetas. */
  readonly uid = `dt-${Math.random().toString(36).slice(2, 9)}`;

  private readonly search$ = new Subject<string>();
  private lastEmittedSearch = '';

  /** Filas filtradas por la búsqueda. */
  readonly filtered = computed(() => {
    const term = normalize(this.search());
    const rows = this.rows();
    if (!term) {
      return rows;
    }
    const columns = this.columns();
    return rows.filter((row) =>
      columns.some((column) =>
        normalize(String(column.badge?.(row)?.label ?? column.value(row) ?? '')).includes(term),
      ),
    );
  });

  /** Filas filtradas y ordenadas. */
  readonly sorted = computed(() => {
    const sort = this.sort();
    const rows = [...this.filtered()];
    const column = sort
      ? this.columns().find((candidate) => candidate.key === sort.key)
      : undefined;
    if (!sort || !column) {
      return rows;
    }
    const factor = sort.direction === 'asc' ? 1 : -1;
    return rows.sort((a, b) => compare(column.value(a), column.value(b)) * factor);
  });

  /** Número total de páginas. */
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sorted().length / this.pageSize())),
  );

  /** Filas de la página actual. */
  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  /** Rango mostrado ("1–10 de 120"). */
  readonly rangeLabel = computed(() => {
    const total = this.sorted().length;
    if (!total) {
      return '0 resultados';
    }
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, start + this.pageSize() - 1);
    return `${start}–${end} de ${formatNumber(total)}`;
  });

  /** Mensaje para lectores de pantalla tras buscar. */
  readonly announcement = computed(() =>
    this.loading() ? 'Cargando datos' : `${formatNumber(this.sorted().length)} resultados`,
  );

  /** Columna principal para la vista de tarjetas. */
  readonly primaryColumn = computed(
    () => this.columns().find((column) => column.primary) ?? this.columns()[0],
  );

  /** `true` si todas las filas de la página están seleccionadas. */
  readonly allPageSelected = computed(() => {
    const keys = this.selectedKeys();
    const page = this.paged();
    return page.length > 0 && page.every((row) => keys.has(this.rowKey()(row)));
  });

  /** Filas para el esqueleto de carga. */
  readonly skeletonRows = [1, 2, 3, 4, 5];

  constructor() {
    // Si el padre cambia `search` (p. ej. lo limpia), sincroniza el campo
    effect(() => {
      const value = this.search();
      if (value !== this.lastEmittedSearch) {
        this.lastEmittedSearch = value;
        this.draft.set(value);
      }
    });

    // Vuelve a la primera página si cambian los datos o la búsqueda
    effect(() => {
      this.filtered();
      this.page.set(1);
    });

    // Notifica al padre lo que se está viendo (para exportar)
    effect(() => this.viewChange.emit(this.sorted()));
  }

  /** Configura el debounce de la búsqueda (300 ms). */
  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.lastEmittedSearch = value;
        this.search.set(value);
      });
  }

  /** Gestiona la escritura en el buscador. */
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(value);
    this.search$.next(value);
  }

  /** Limpia la búsqueda. */
  clearSearch(): void {
    this.draft.set('');
    this.search$.next('');
  }

  /** Cambia la ordenación: ascendente → descendente → sin ordenar. */
  toggleSort(column: TableColumn<T>): void {
    if (!column.sortable) {
      return;
    }
    const current = this.sort();
    let next: SortState | null;
    if (current?.key !== column.key) {
      next = { key: column.key, direction: 'asc' };
    } else if (current.direction === 'asc') {
      next = { key: column.key, direction: 'desc' };
    } else {
      next = null;
    }
    this.sort.set(next);
    this.sortChange.emit(next);
  }

  /** Valor de `aria-sort` de una columna. */
  ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) {
      return null;
    }
    const sort = this.sort();
    if (sort?.key !== column.key) {
      return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  /** Va a una página concreta. */
  goTo(page: number): void {
    const target = Math.min(Math.max(1, page), this.pageCount());
    if (target !== this.page()) {
      this.page.set(target);
      this.pageChange.emit(target);
    }
  }

  /** Valor formateado de una celda. */
  display(column: TableColumn<T>, row: T): string {
    const value = column.value(row);
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    switch (column.type) {
      case 'currency':
        return formatCurrency(Number(value));
      case 'number':
        return formatNumber(Number(value));
      case 'date':
        return formatDate(String(value));
      default:
        return String(value);
    }
  }

  /** `true` si la columna es numérica (alineada a la derecha). */
  isNumeric(column: TableColumn<T>): boolean {
    return column.type === 'number' || column.type === 'currency';
  }

  /** Acciones visibles para una fila. */
  visibleActions(row: T): TableAction<T>[] {
    return this.actions().filter((action) => !action.visible || action.visible(row));
  }

  /** Activa una fila (clic o Intro). */
  activate(row: T): void {
    if (this.clickable()) {
      this.rowClick.emit(row);
    }
  }

  /** Ejecuta una acción sin propagar el clic a la fila. */
  runAction(event: Event, action: TableAction<T>, row: T): void {
    event.stopPropagation();
    this.rowAction.emit({ action: action.id, row });
  }

  /** `true` si la fila está seleccionada. */
  isSelected(row: T): boolean {
    return this.selectedKeys().has(this.rowKey()(row));
  }

  /** Selecciona o deselecciona una fila. */
  toggleRow(row: T): void {
    const key = this.rowKey()(row);
    const next = new Set(this.selectedKeys());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.updateSelection(next);
  }

  /** Selecciona o deselecciona todas las filas de la página. */
  togglePage(): void {
    const next = new Set(this.selectedKeys());
    const select = !this.allPageSelected();
    for (const row of this.paged()) {
      const key = this.rowKey()(row);
      if (select) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    this.updateSelection(next);
  }

  private updateSelection(keys: Set<string | number>): void {
    this.selectedKeys.set(keys);
    this.selectionChange.emit(this.rows().filter((row) => keys.has(this.rowKey()(row))));
  }
}

/** Normaliza texto para buscar sin tildes ni mayúsculas. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Comparación para ordenar (números, textos con orden natural y nulos al final). */
function compare(a: unknown, b: unknown): number {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return 1;
  }
  if (b === null || b === undefined) {
    return -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}
