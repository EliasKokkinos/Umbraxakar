// Serves the built Chaos Engine, and (when DATA_DIR is set) keeps the game's data on disk.
// No dependencies: plain Node.
//
//   Local launcher:  node tools/serve.mjs 4200            (browser storage, as before)
//   Umbrel (Docker): APP_DIR=/app/browser DATA_DIR=/data HOST=0.0.0.0 PORT=7400 node serve.mjs
import { createServer } from 'node:http';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Largest request body accepted: a long campaign's autosave, or every portrait at once. */
export const MAX_BODY = 32 * 1024 * 1024;
export const MAX_SNAPSHOTS = 10;
const ID = /^[A-Za-z0-9-]{1,80}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** A tiny file store: atomic writes (temp file, then rename), one at a time. */
function dataStore(dir) {
  let queue = Promise.resolve();
  const path = (name) => join(dir, name);

  const read = async (name, fallback) => {
    try {
      return JSON.parse(await readFile(path(name), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return fallback;
      throw e;
    }
  };

  /** Runs fn after every earlier write, so read-modify-write never races. */
  const exclusive = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const write = async (name, value) => {
    await mkdir(dir, { recursive: true });
    const tmp = path(`${name}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, path(name));
  };

  return { read, write: (name, value) => exclusive(() => write(name, value)), exclusive, rawWrite: write };
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Not JSON');
  }
}

function send(res, status, value) {
  const text = value === undefined ? '' : JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

const isPortrait = (v) => typeof v === 'string' && v.startsWith('data:image/');

/** The storage API. Returns true when it handled the request. */
async function api(req, res, url, store) {
  const [, , resource, id] = url.pathname.split('/'); // "", "api", resource, id
  const method = req.method ?? 'GET';

  if (resource === 'health' && method === 'GET') return send(res, 200, { ok: true, storage: 'server' }), true;

  if (resource === 'autosave' && !id) {
    if (method === 'GET') {
      const save = await store.read('autosave.json', null);
      return save === null ? send(res, 404, { error: 'No autosave yet' }) : send(res, 200, save), true;
    }
    if (method === 'PUT') {
      const save = await body(req);
      if (save?.format !== 'chaos-engine-save') throw new HttpError(400, 'Not a Chaos Engine save');
      await store.write('autosave.json', save);
      return send(res, 204), true;
    }
  }

  if (resource === 'snapshots' && !id) {
    if (method === 'GET') return send(res, 200, await store.read('snapshots.json', [])), true;
    if (method === 'PUT') {
      const list = await body(req);
      if (!Array.isArray(list)) throw new HttpError(400, 'Expected a list');
      await store.write('snapshots.json', list.slice(0, MAX_SNAPSHOTS));
      return send(res, 204), true;
    }
  }

  if (resource === 'portraits') {
    if (!id && method === 'GET') return send(res, 200, await store.read('portraits.json', {})), true;
    if (!id && method === 'PUT') {
      const all = await body(req);
      if (!all || typeof all !== 'object' || Array.isArray(all)) throw new HttpError(400, 'Expected an object');
      for (const [k, v] of Object.entries(all)) if (!ID.test(k) || !isPortrait(v)) throw new HttpError(400, 'Bad portrait');
      await store.write('portraits.json', all);
      return send(res, 204), true;
    }
    if (id) {
      if (!ID.test(id)) throw new HttpError(400, 'Bad id');
      if (method === 'PUT') {
        const { dataUrl } = (await body(req)) ?? {};
        if (!isPortrait(dataUrl)) throw new HttpError(400, 'Not an image');
        await store.exclusive(async () => {
          const all = await store.read('portraits.json', {});
          await store.rawWrite('portraits.json', { ...all, [id]: dataUrl });
        });
        return send(res, 204), true;
      }
      if (method === 'DELETE') {
        await store.exclusive(async () => {
          const { [id]: _gone, ...rest } = await store.read('portraits.json', {});
          await store.rawWrite('portraits.json', rest);
        });
        return send(res, 204), true;
      }
    }
  }

  send(res, 404, { error: 'Unknown' });
  return true;
}

/** Resolves a request path inside root, or null if it tries to escape. */
function inside(root, urlPath) {
  const target = normalize(join(root, decodeURIComponent(urlPath)));
  return target === root || target.startsWith(root + sep) ? target : null;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export function createApp({ appDir, dataDir = null }) {
  const root = resolve(appDir);
  const store = dataDir ? dataStore(resolve(dataDir)) : null;

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://local');

      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        // Without a data directory there is no API: the app falls back to browser storage.
        if (!store) return send(res, 404, { error: 'No server storage' });
        await api(req, res, url, store);
        return;
      }

      const target = inside(root, url.pathname);
      if (!target) return void res.writeHead(403).end();
      // /dm and /table are app routes: anything without a file behind it gets the app shell.
      const path = (await isFile(target)) ? target : extname(target) ? null : join(root, 'index.html');
      if (!path) return void res.writeHead(404).end('Not found');

      res.writeHead(200, {
        'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
        // Data and the shell are always fresh; hashed bundles can be cached.
        'Cache-Control': /-[A-Z0-9]{8}\.(js|css)$/.test(path) ? 'max-age=31536000, immutable' : 'no-cache',
      });
      res.end(await readFile(path));
    } catch (e) {
      if (!res.headersSent) send(res, e instanceof HttpError ? e.status : 500, { error: e.message });
    }
  });
}

// ---------------------------------------------------------------- run as a program
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const appDir = process.env.APP_DIR ?? resolve(here, '..', 'dist', 'chaos-engine', 'browser');
  const dataDir = process.env.DATA_DIR ?? null;
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4200);
  const host = process.env.HOST ?? '127.0.0.1';

  const server = createApp({ appDir, dataDir });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use: the Chaos Engine may already be running.`);
      process.exit(2);
    }
    throw e;
  });
  server.listen(port, host, () => {
    console.log(`The Chaos Engine is running at http://localhost:${port}/dm`);
    console.log(dataDir ? `Game data is kept in ${resolve(dataDir)}` : 'Game data is kept in the browser.');
    console.log('Close this window to stop it.');
  });
}
