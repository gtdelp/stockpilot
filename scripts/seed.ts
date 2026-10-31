/**
 * Carga datos sintéticos en PostgreSQL (Neon) y Firestore, y crea las cuentas
 * de prueba en Firebase Auth.
 *
 * Uso:  npm run seed            (añade el esquema si falta y recarga los datos)
 *
 * Variables (en .env, nunca en el repositorio):
 *   DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_BASE64,
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL, SEED_USER_PASSWORD
 *
 * Todos los datos son ficticios: nombres generados con Faker y correos en el
 * dominio reservado example.com. No se usa ningún dato personal real.
 */
import { faker } from '@faker-js/faker/locale/es';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { createNeonDb } from '../api/_lib/db.js';
import { generateDemoData } from '../src/app/core/demo/demo-data.js';
import { insertDataset } from './seed-data.js';

loadDotEnv();

const required = [
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_BASE64',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'SEED_USER_EMAIL',
  'SEED_USER_PASSWORD',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  process.stderr.write(`Faltan variables de entorno: ${missing.join(', ')}\n`);
  process.exit(1);
}
const env = process.env as Record<string, string>;

async function main(): Promise<void> {
  const credentials = JSON.parse(
    Buffer.from(env['FIREBASE_SERVICE_ACCOUNT_BASE64'], 'base64').toString('utf8'),
  );
  const app = initializeApp({ credential: cert(credentials) });
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const db = await createNeonDb(env['DATABASE_URL']);

  log('Aplicando esquema…');
  for (const statement of readFileSync('db/schema.sql', 'utf8').split(/;\s*$/m)) {
    const sql = statement.replace(/--.*$/gm, '').trim();
    if (sql) {
      await db.query(sql);
    }
  }

  log('Creando cuentas de prueba en Firebase Auth…');
  const adminUid = await upsertAccount(
    auth,
    env['SEED_ADMIN_EMAIL'],
    env['SEED_ADMIN_PASSWORD'],
    'Administración Demo',
    'admin',
  );
  const userUid = await upsertAccount(
    auth,
    env['SEED_USER_EMAIL'],
    env['SEED_USER_PASSWORD'],
    'Lucía Romero',
    'user',
  );

  const data = generateDemoData(2026, new Date());
  faker.seed(2026);

  // Clientes sintéticos (solo existen en la base de datos, no pueden iniciar sesión)
  const userIds = new Map<string, string>([
    ['demo-admin', adminUid],
    ['demo-user', userUid],
  ]);
  const customers = data.users
    .filter((user) => user.id.startsWith('demo-customer'))
    .map((user, index) => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const id = `seed-customer-${index + 1}`;
      userIds.set(user.id, id);
      return {
        id,
        fullName: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
      };
    });

  log('Recargando datos relacionales…');
  await db.transaction((tx) =>
    insertDataset(tx, data, {
      admin: { id: adminUid, email: env['SEED_ADMIN_EMAIL'], fullName: 'Administración Demo' },
      user: { id: userUid, email: env['SEED_USER_EMAIL'], fullName: 'Lucía Romero' },
      customers,
      userIds,
      phone: () => faker.phone.number({ style: 'national' }),
    }),
  );

  log('Reiniciando el feed de actividad en Firestore…');
  const existing = await firestore.collection('activity').listDocuments();
  await Promise.all(existing.map((doc) => doc.delete()));
  const customerNames = new Map(
    customers.map((customer, index) => [`demo-customer-${index + 1}`, customer.fullName]),
  );
  for (const order of data.orders.slice(-6)) {
    await firestore.collection('activity').add({
      type: 'order_created',
      message: `Nuevo pedido #${order.id} por ${order.total.toFixed(2).replace('.', ',')} €`,
      actorName: customerNames.get(order.userId) ?? 'Lucía Romero',
      createdAt: Timestamp.fromDate(new Date(order.createdAt)),
    });
  }

  await db.close();
  log(
    `Listo: ${data.products.length} productos, ${data.orders.length} pedidos, ${customers.length + 2} usuarios. ` +
      'Las credenciales de prueba son las de tu .env.',
  );
}

/** Crea la cuenta o actualiza su contraseña, y replica el rol como custom claim. */
async function upsertAccount(
  auth: ReturnType<typeof getAuth>,
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'user',
): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName });
    uid = existing.uid;
  } catch {
    uid = (await auth.createUser({ email, password, displayName })).uid;
  }
  await auth.setCustomUserClaims(uid, { role });
  return uid;
}

function loadDotEnv(): void {
  if (!existsSync('.env')) {
    return;
  }
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1] as string] === undefined) {
      process.env[match[1] as string] = (match[2] as string).replace(/^["']|["']$/g, '');
    }
  }
}

function log(message: string): void {
  process.stdout.write(`[seed] ${message}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`[seed] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
