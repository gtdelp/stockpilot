import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { Role } from '../models';
import { authGuard, guestGuard, roleGuard } from './auth.guards';

function setup(state: { authenticated: boolean; role: Role | null }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthStore,
        useValue: {
          whenReady: () => of('authenticated'),
          isAuthenticated: signal(state.authenticated),
          role: signal(state.role),
          homeUrl: signal(state.role === 'admin' ? '/panel' : '/productos'),
        },
      },
    ],
  });
  return TestBed.inject(Router);
}

async function run(guard: typeof authGuard, route: Route = {}, segments: UrlSegment[] = []) {
  const result = TestBed.runInInjectionContext(() =>
    guard(route, segments, {} as Parameters<typeof authGuard>[2]),
  ) as Observable<boolean | UrlTree>;
  return firstValueFrom(result);
}

describe('guards de rutas', () => {
  it('authGuard redirige al login conservando la URL', async () => {
    const router = setup({ authenticated: false, role: null });
    const result = await run(authGuard, {}, [new UrlSegment('pedidos', {})]);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?redirect=%2Fpedidos');
  });

  it('authGuard deja pasar con sesión', async () => {
    setup({ authenticated: true, role: 'user' });
    expect(await run(authGuard)).toBe(true);
  });

  it('roleGuard envía a 403 si el rol no está permitido', async () => {
    const router = setup({ authenticated: true, role: 'user' });
    const result = await run(roleGuard, { data: { roles: ['admin'] } });
    expect(router.serializeUrl(result as UrlTree)).toBe('/403');
  });

  it('roleGuard permite al administrador', async () => {
    setup({ authenticated: true, role: 'admin' });
    expect(await run(roleGuard, { data: { roles: ['admin'] } })).toBe(true);
  });

  it('guestGuard lleva al inicio del rol si ya hay sesión', async () => {
    const router = setup({ authenticated: true, role: 'admin' });
    const result = await run(guestGuard);
    expect(router.serializeUrl(result as UrlTree)).toBe('/panel');
  });
});
