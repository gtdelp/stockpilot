// Genera src/environments/environment.ts a partir de variables de entorno.
// El archivo generado está en .gitignore: así ninguna clave queda en el repositorio.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Carga un .env local si existe (sin dependencias externas)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const env = process.env;
const production = process.argv.includes('--prod');
const forceDemo = env.DEMO_MODE === 'true';
const hasFirebase = Boolean(env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID);
const demoMode = forceDemo || !hasFirebase;

const firebase = demoMode
  ? null
  : {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: env.FIREBASE_APP_ID,
    };

const content = `// Archivo generado por scripts/set-env.mjs. No editar ni versionar.
import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = ${JSON.stringify(
  { production, demoMode, apiUrl: '/api', firebase },
  null,
  2,
)};
`;

writeFileSync('src/environments/environment.ts', content);
process.stdout.write(`[set-env] production=${production} demoMode=${demoMode}\n`);
