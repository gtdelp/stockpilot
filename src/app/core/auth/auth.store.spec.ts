import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { UserProfile } from '../models';
import { UsersService } from '../services/users.service';
import { AuthProvider, AuthUser } from './auth-provider';
import { AuthStore } from './auth.store';

const profile: UserProfile = {
  id: 'u1',
  email: 'ana@empresa.es',
  fullName: 'Ana Pruebas',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
};

function setup(options: { meError?: { status: number; message: string } } = {}) {
  const user$ = new BehaviorSubject<AuthUser | null>(null);
  const provider = {
    user$,
    signIn: vi.fn(async (email: string, password: string) => {
      if (password !== 'Correcta1') {
        throw new Error('Correo o contraseña incorrectos.');
      }
      user$.next({ uid: 'u1', email });
    }),
    signOut: vi.fn(async () => user$.next(null)),
    getIdToken: vi.fn(async () => 'token'),
  };
  const users = {
    me: vi.fn(() =>
      options.meError ? throwError(() => ({ ...options.meError, code: 'X' })) : of(profile),
    ),
    register: vi.fn(() => of(profile)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthProvider, useValue: provider },
      { provide: UsersService, useValue: users },
    ],
  });
  return { store: TestBed.inject(AuthStore), provider, users };
}

describe('AuthStore', () => {
  it('queda anónimo cuando no hay sesión', () => {
    const { store } = setup();
    expect(store.status()).toBe('anonymous');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('inicia sesión y carga el perfil con su rol', async () => {
    const { store } = setup();
    expect(await store.login('ana@empresa.es', 'Correcta1')).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.isAdmin()).toBe(true);
    expect(store.homeUrl()).toBe('/panel');
  });

  it('muestra el error de credenciales', async () => {
    const { store } = setup();
    expect(await store.login('ana@empresa.es', 'mal')).toBe(false);
    expect(store.error()).toBe('Correo o contraseña incorrectos.');
  });

  it('cierra la sesión si la cuenta no tiene perfil', async () => {
    const { store, provider } = setup({ meError: { status: 404, message: 'No' } });
    expect(await store.login('ana@empresa.es', 'Correcta1')).toBe(false);
    expect(store.error()).toContain('no tiene un perfil');
    expect(provider.signOut).toHaveBeenCalled();
  });

  it('cierra sesión', async () => {
    const { store } = setup();
    await store.login('ana@empresa.es', 'Correcta1');
    await store.logout();
    expect(store.status()).toBe('anonymous');
    expect(store.profile()).toBeNull();
  });
});
