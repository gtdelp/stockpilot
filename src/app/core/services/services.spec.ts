import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { ProductsService } from './products.service';
import { ReportService } from './report.service';
import { StatsService } from './stats.service';
import { UsersService } from './users.service';

describe('servicios de datos (Model)', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('ProductsService envía filtros y comprueba SKU', async () => {
    const products = TestBed.inject(ProductsService);
    void firstValueFrom(products.list({ categoryId: 3, lowStock: true }));
    backend.expectOne('/api/products?categoryId=3&lowStock=true').flush([]);
    const available = firstValueFrom(products.isSkuAvailable('ELE-0001', 7));
    backend
      .expectOne('/api/products/sku-available?sku=ELE-0001&excludeId=7')
      .flush({ available: false });
    expect(await available).toBe(false);
    void firstValueFrom(products.update(7, {} as never));
    expect(backend.expectOne('/api/products/7').request.method).toBe('PATCH');
  });

  it('OrdersService filtra y cambia estados', () => {
    const orders = TestBed.inject(OrdersService);
    void firstValueFrom(orders.list({ status: 'pending', from: '2026-01-01', to: null }));
    backend.expectOne('/api/orders?status=pending&from=2026-01-01').flush([]);
    void firstValueFrom(orders.updateStatus(4, 'shipped'));
    const request = backend.expectOne('/api/orders/4/status');
    expect(request.request.body).toEqual({ status: 'shipped' });
    request.flush({});
  });

  it('StatsService lanza las cinco consultas en paralelo (forkJoin)', async () => {
    const stats = TestBed.inject(StatsService);
    const result = firstValueFrom(
      stats.dashboard({ from: '2026-01-01', to: '2026-06-30', categoryId: null, status: null }),
    );
    const requests = backend.match((request) => request.url.startsWith('/api/stats/'));
    expect(requests).toHaveLength(5);
    requests.forEach((request) =>
      request.flush(request.request.url.endsWith('kpis') ? { revenue: 1 } : []),
    );
    expect(await result).toMatchObject({ kpis: { revenue: 1 }, salesByMonth: [] });
  });

  it('UsersService y CatalogService usan los endpoints correctos', async () => {
    const users = TestBed.inject(UsersService);
    const catalog = TestBed.inject(CatalogService);
    const available = firstValueFrom(users.isEmailAvailable('ana@empresa.es'));
    backend.expectOne('/api/users/email-available?email=ana@empresa.es').flush({ available: true });
    expect(await available).toBe(true);
    void firstValueFrom(catalog.saveCategory({ name: 'Hogar', description: null }));
    expect(backend.expectOne('/api/categories').request.method).toBe('POST');
    void firstValueFrom(
      catalog.saveSupplier({ name: 'Uno', email: 'a@b.es', phone: null, city: null }, 2),
    );
    expect(backend.expectOne('/api/suppliers/2').request.method).toBe('PATCH');
  });

  it('ReportService descarga un CSV con BOM UTF-8', async () => {
    const reports = TestBed.inject(ReportService);
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const name = reports.exportCsv({
      entity: 'productos',
      columns: [{ header: 'Nombre', value: (row: { name: string }) => row.name }],
      rows: [{ name: 'Folios' }],
    });
    expect(name).toMatch(/^stockpilot_productos_\d{4}-\d{2}-\d{2}\.csv$/);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(
      await blobs[0]?.arrayBuffer(),
    );
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.slice(1)).toBe('Nombre\r\nFolios');
  });
});
