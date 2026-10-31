import { Injectable } from '@angular/core';
import type { Auth } from 'firebase/auth';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { loadFirebaseApp } from '../firebase/firebase-app';
import { AuthProvider, AuthUser, authErrorMessage } from './auth-provider';

/**
 * Proveedor de identidad basado en Firebase Authentication.
 * El SDK se carga bajo demanda con import dinámico.
 */
@Injectable()
export class FirebaseAuthProvider extends AuthProvider {
  private readonly authPromise: Promise<Auth> = this.init();

  /** Sesión actual; se comparte entre suscriptores y se libera al cerrar la app. */
  readonly user$: Observable<AuthUser | null> = new Observable<AuthUser | null>((subscriber) => {
    let unsubscribe: (() => void) | undefined;
    let closed = false;
    void Promise.all([this.authPromise, import('firebase/auth')]).then(
      ([auth, { onAuthStateChanged }]) => {
        if (closed) {
          return;
        }
        unsubscribe = onAuthStateChanged(
          auth,
          (user) => subscriber.next(user ? { uid: user.uid, email: user.email ?? '' } : null),
          (error) => subscriber.error(error),
        );
      },
    );
    return () => {
      closed = true;
      unsubscribe?.();
    };
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  /** @inheritdoc */
  async signIn(email: string, password: string): Promise<void> {
    const [auth, { signInWithEmailAndPassword }] = await Promise.all([
      this.authPromise,
      import('firebase/auth'),
    ]);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(authErrorMessage(code));
    }
  }

  /** @inheritdoc */
  async signOut(): Promise<void> {
    const [auth, { signOut }] = await Promise.all([this.authPromise, import('firebase/auth')]);
    await signOut(auth);
  }

  /** @inheritdoc */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    const auth = await this.authPromise;
    return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
  }

  /** Crea la instancia de Auth con persistencia local (la sesión sobrevive a recargas). */
  private async init(): Promise<Auth> {
    if (!environment.firebase) {
      throw new Error('Firebase no está configurado.');
    }
    const app = await loadFirebaseApp(environment.firebase);
    const { initializeAuth, browserLocalPersistence } = await import('firebase/auth');
    return initializeAuth(app, { persistence: browserLocalPersistence });
  }
}
