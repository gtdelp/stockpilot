// Servidor estático SPA mínimo (E2E y Lighthouse en local): node scripts/serve-spa.mjs <carpeta> <puerto>
// Comprime con Brotli/Gzip como haría el CDN de producción (Vercel).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = process.argv[2] ?? 'www/browser';
const port = Number(process.argv[3] ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt']);
// Caché de respuestas comprimidas (calidad media: comprimir al máximo bloquearía el servidor)
const cache = new Map();
function compress(file, body, encoding) {
  const key = `${encoding}:${file}:${body.length}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      encoding === 'br'
        ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
        : gzipSync(body, { level: 6 }),
    );
  }
  return cache.get(key);
}

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(root, url));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      file = join(file, 'index.html');
    }
  } catch {
    file = join(root, 'index.html');
  }
  try {
    let body = await readFile(file);
    const ext = extname(file);
    const headers = {
      'Content-Type': types[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    };
    const accept = String(req.headers['accept-encoding'] ?? '');
    if (compressible.has(ext)) {
      if (accept.includes('br')) {
        body = compress(file, body, 'br');
        headers['Content-Encoding'] = 'br';
      } else if (accept.includes('gzip')) {
        body = compress(file, body, 'gzip');
        headers['Content-Encoding'] = 'gzip';
      }
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(port, () => process.stdout.write(`Sirviendo ${root} en http://localhost:${port}\n`));
