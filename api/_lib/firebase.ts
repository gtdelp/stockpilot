import type { App } from 'firebase-admin/app';
import { HttpError } from './http.js';
import type { ActivityType, IdentityService, RealtimeService, VerifiedToken } from './services.js';

let appPromise: Promise<App> | null = null;

/** Inicializa Firebase Admin con la cuenta de servicio (variable de entorno en base64). */
function adminApp(): Promise<App> {
  appPromise ??= (async () => {
    const encoded = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
    if (!encoded) {
      throw new HttpError(500, 'CONFIG', 'Falta la configuración del servidor (Firebase Admin).');
    }
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const existing = getApps()[0];
    if (existing) {
      return existing;
    }
    const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Record<
      string,
      string
    >;
    return initializeApp({ credential: cert(credentials) });
  })();
  return appPromise;
}

/** Identidad con Firebase Authentication (verificación de JWT y alta de cuentas). */
export const firebaseIdentity: IdentityService = {
  async verifyToken(token: string): Promise<VerifiedToken> {
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth(await adminApp()).verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email ?? '' };
  },
  async createAccount(email: string, password: string, displayName: string): Promise<string> {
    const { getAuth } = await import('firebase-admin/auth');
    try {
      const user = await getAuth(await adminApp()).createUser({ email, password, displayName });
      return user.uid;
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/email-already-exists') {
        throw new HttpError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  },
  async deleteAccount(uid: string): Promise<void> {
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth(await adminApp()).deleteUser(uid);
  },
  async setRole(uid: string, role: 'admin' | 'user'): Promise<void> {
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth(await adminApp()).setCustomUserClaims(uid, { role });
  },
};

/** Tiempo real con Cloud Firestore (escrituras solo desde el servidor). */
export const firestoreRealtime: RealtimeService = {
  async publishActivity(type: ActivityType, message: string, actorName: string): Promise<void> {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    await getFirestore(await adminApp())
      .collection('activity')
      .add({ type, message, actorName, createdAt: FieldValue.serverTimestamp() });
  },
  async notify(uid: string, title: string, body: string): Promise<void> {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    await getFirestore(await adminApp())
      .collection(`notifications/${uid}/items`)
      .add({ title, body, read: false, createdAt: FieldValue.serverTimestamp() });
  },
};
