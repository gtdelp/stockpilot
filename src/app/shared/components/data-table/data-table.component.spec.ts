import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent, TableColumn } from './data-table.component';

interface Row {
  id: number;
  name: string;
  price: number;
}

const rows: Row[] = Array.from({ length: 23 }, (_, index) => ({
  id: index + 1,
  name: index % 2 ? `Monitor ${index + 1}` : `Teclado ${index + 1}`,
  price: 100 - index,
}));

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Producto', value: (row) => row.name, sortable: true, primary: true },
  { key: 'price', header: 'Precio', value: (row) => row.price, type: 'currency', sortable: true },
];

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent<Row>>;
  let component: DataTableComponent<Row>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(DataTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('caption', 'Productos');
    fixture.componentRef.setInput('rowKey', (row: Row) => row.id);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('clickable', true);
    await fixture.whenStable();
  });

  it('pagina los resultados', () => {
    expect(component.paged()).toHaveLength(10);
    expect(component.pageCount()).toBe(3);
    expect(component.rangeLabel()).toBe('1–10 de 23');
    component.goTo(3);
    expect(component.paged()).toHaveLength(3);
    component.goTo(99);
    expect(component.page()).toBe(3);
  });

  it('filtra con el texto de búsqueda (sin tildes ni mayúsculas)', async () => {
    fixture.componentRef.setInput('search', 'MONITOR');
    await fixture.whenStable();
    expect(component.sorted().every((row) => row.name.startsWith('Monitor'))).toBe(true);
    expect(component.page()).toBe(1);
  });

  it('ordena ascendente, descendente y sin orden', () => {
    const price = columns[1] as TableColumn<Row>;
    component.toggleSort(price);
    expect(component.sorted()[0]?.price).toBe(78);
    expect(component.ariaSort(price)).toBe('ascending');
    component.toggleSort(price);
    expect(component.sorted()[0]?.price).toBe(100);
    expect(component.ariaSort(price)).toBe('descending');
    component.toggleSort(price);
    expect(component.sort()).toBeNull();
  });

  it('emite el debounce de búsqueda hacia el modelo bidireccional', async () => {
    vi.useFakeTimers();
    const values: string[] = [];
    component.search.subscribe((value) => values.push(value));
    component.onSearchInput({ target: { value: 'tec' } } as unknown as Event);
    component.onSearchInput({ target: { value: 'tecl' } } as unknown as Event);
    vi.advanceTimersByTime(350);
    vi.useRealTimers();
    expect(values).toEqual(['tecl']);
  });

  it('emite rowClick, rowAction y selectionChange', () => {
    const clicked: Row[] = [];
    const selected: Row[][] = [];
    const actions: string[] = [];
    component.rowClick.subscribe((row) => clicked.push(row));
    component.selectionChange.subscribe((value) => selected.push(value));
    component.rowAction.subscribe((event) => actions.push(`${event.action}:${event.row.id}`));

    component.activate(rows[0] as Row);
    component.toggleRow(rows[1] as Row);
    component.runAction(
      new Event('click'),
      { id: 'edit', label: 'Editar', icon: 'create-outline' },
      rows[2] as Row,
    );

    expect(clicked[0]?.id).toBe(1);
    expect(selected[0]?.map((row) => row.id)).toEqual([2]);
    expect(actions).toEqual(['edit:3']);
  });

  it('renderiza una tabla semántica con caption y aria-sort', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('caption')?.textContent).toContain('Productos');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(element.querySelector('th[aria-sort]')?.getAttribute('aria-sort')).toBe('none');
  });
});
