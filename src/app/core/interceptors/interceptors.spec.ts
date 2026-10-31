import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthProvider } from '../auth/auth-provider';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../services/toast.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { silentContext } from './http-context';

describe('interceptores HTTP', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const toast = { error: vi.fn(() => Promise.resolve()) };
  const logout = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    toast.error.mockClear();
    logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthProvider, useValue: { getIdToken: () => Promise.resolve('jwt-123') } },
        { provide: ToastService, useValue: toast },
        { provide: AuthStore, useValue: { logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adjunta el token JWT a las peticiones de la API', async () => {
    const promise = firstValueFrom(http.get('/api/products'));
    await Promise.resolve();
    const request = backend.expectOne('/api/products');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    request.flush([]);
    expect(await promise).toEqual([]);
  });

  it('no toca peticiones externas', () => {
    void firstValueFrom(http.get('https://example.com/data'));
    const request = backend.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('normaliza errores y muestra un aviso', async () => {
    const promise = firstValueFrom(http.post('/api/orders', {}));
    await Promise.resolve();
    backend
      .expectOne('/api/orders')
      .flush(
        { code: 'VALIDATION', message: 'Datos no válidos.' },
        { status: 400, statusText: 'Bad' },
      );
    await expect(promise).rejects.toEqual({
      status: 400,
      code: 'VALIDATION',
      message: 'Datos no válidos.',
    });
    expect(toast.error).toHaveBeenCalledWith('Datos no válidos.');
  });

  it('no muestra aviso en peticiones silenciosas', async () => {
    const promise = firstValueFrom(http.post('/api/orders', {}, { context: silentContext() }));
    await Promise.resolve();
    backend
      .expectOne('/api/orders')
      .flush({ code: 'X', message: 'Error' }, { status: 409, statusText: 'Conflict' });
    await expect(promise).rejects.toMatchObject({ status: 409 });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('navega a la página 403 ante un acceso prohibido', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const promise = firstValueFrom(http.delete('/api/products/1'));
    await Promise.resolve();
    backend
      .expectOne('/api/products/1')
      .flush({ code: 'FORBIDDEN', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toMatchObject({ status: 403 });
    expect(navigate).toHaveBeenCalledWith(['/403']);
  });
});
