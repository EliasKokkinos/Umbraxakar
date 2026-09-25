// Serves the built Chaos Engine for game night. No dependencies: plain Node.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist', 'chaos-engine', 'browser');
const PORT = Number(process.argv[2] ?? 4200);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/** Resolves a request path inside ROOT, or null if it tries to escape. */
function inside(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(ROOT, decoded));
  return target === ROOT || target.startsWith(ROOT + sep) ? target : null;
}

async function file(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const target = inside(req.url ?? '/');
  if (!target) {
    res.writeHead(403).end();
    return;
  }
  // /dm and /table are app routes: anything without a file behind it gets the app shell.
  const path = (await file(target)) ?? (extname(target) ? null : join(ROOT, 'index.html'));
  if (!path) {
    res.writeHead(404).end('Not found');
    return;
  }
  const body = await readFile(path);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    // Data and the shell are always fresh; hashed bundles can be cached.
    'Cache-Control': /-[A-Z0-9]{8}\.(js|css)$/.test(path) ? 'max-age=31536000, immutable' : 'no-cache',
  });
  res.end(body);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use: the Chaos Engine may already be running.`);
    process.exit(2);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`The Chaos Engine is running at http://localhost:${PORT}/dm`);
  console.log('Close this window to stop it.');
});
