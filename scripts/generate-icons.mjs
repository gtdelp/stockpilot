// Genera src/app/icons.ts con los iconos de Ionicons usados en el código.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (/\.(ts|html)$/.test(entry) && !path.endsWith('icons.ts')) {
      files.push(path);
    }
  }
};
walk('src');

const names = new Set();
for (const file of files) {
  for (const match of readFileSync(file, 'utf8').matchAll(
    /['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)*-outline)['"]/g,
  )) {
    names.add(match[1]);
  }
}
const sorted = [...names].sort();
const camel = (name) => name.replace(/-([a-z0-9])/g, (_m, char) => char.toUpperCase());
const content = `import { addIcons } from 'ionicons';
import {
  ${sorted.map(camel).join(',\n  ')},
} from 'ionicons/icons';

/**
 * Registra solo los iconos que usa la aplicación (tree-shaking de Ionicons).
 * Generado con \`npm run icons\` a partir de las plantillas.
 */
export function registerAppIcons(): void {
  addIcons({
${sorted.map((name) => `    '${name}': ${camel(name)},`).join('\n')}
  });
}
`;
writeFileSync('src/app/icons.ts', content);
process.stdout.write(`[icons] ${sorted.length} iconos registrados\n`);
