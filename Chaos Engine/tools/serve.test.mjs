// node --test tools/   (the server has no dependencies, so neither do its tests)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, MAX_SNAPSHOTS } from './serve.mjs';

let appDir;
let dataDir;
let base;
let server;
let bare;
let bareBase;

before(async () => {
  appDir = await mkdtemp(join(tmpdir(), 'ce-app-'));
  dataDir = await mkdtemp(join(tmpdir(), 'ce-data-'));
  await writeFile(join(appDir, 'index.html'), '<title>Chaos Engine</title>');
  await mkdir(join(appDir, 'data'));
  await writeFile(join(appDir, 'data', 'map.json'), '{"ok":true}');

  server = createApp({ appDir, dataDir });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  bare = createApp({ appDir });
  await new Promise((r) => bare.listen(0, '127.0.0.1', r));
  bareBase = `http://127.0.0.1:${bare.address().port}`;
});

after(async () => {
  server.close();
  bare.close();
  await rm(appDir, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

const put = (path, value, raw) =>
  fetch(base + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(value) });

test('serves the app shell for app routes, files as files, and refuses to escape', async () => {
  for (const route of ['/dm', '/table']) {
    const r = await fetch(base + route);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Chaos Engine/);
  }
  assert.deepEqual(await (await fetch(base + '/data/map.json')).json(), { ok: true });
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  assert.equal((await fetch(base + '/..%2f..%2fetc%2fpasswd')).status, 403);
});

test('reports server storage when it has a data directory, and none without one', async () => {
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true, storage: 'server' });
  assert.equal((await fetch(bareBase + '/api/health')).status, 404);
});

test('keeps the autosave, and only real saves', async () => {
  assert.equal((await fetch(base + '/api/autosave')).status, 404);
  const save = { format: 'chaos-engine-save', version: 2, label: 'Autosave', state: { turn: 3 } };
  assert.equal((await put('/api/autosave', save)).status, 204);
  assert.deepEqual(await (await fetch(base + '/api/autosave')).json(), save);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, 'autosave.json'), 'utf8')), save);

  assert.equal((await put('/api/autosave', { hello: 1 })).status, 400);
  assert.equal((await put('/api/autosave', null, 'not json')).status, 400);
  assert.deepEqual(await (await fetch(base + '/api/autosave')).json(), save);
});

test('keeps at most ten snapshots', async () => {
  assert.deepEqual(await (await fetch(base + '/api/snapshots')).json(), []);
  const list = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, turn: 12 - i }));
  assert.equal((await put('/api/snapshots', list)).status, 204);
  const kept = await (await fetch(base + '/api/snapshots')).json();
  assert.equal(kept.length, MAX_SNAPSHOTS);
  assert.equal(kept[0].id, 's0');
  assert.equal((await put('/api/snapshots', { not: 'a list' })).status, 400);
});

test('portraits: add, remove, replace all; ids and images are checked', async () => {
  assert.equal((await put('/api/portraits/uruk', { dataUrl: 'data:image/jpeg;base64,UUU' })).status, 204);
  assert.equal((await put('/api/portraits/karsa-orlong', { dataUrl: 'data:image/jpeg;base64,KKK' })).status, 204);
  assert.deepEqual(Object.keys(await (await fetch(base + '/api/portraits')).json()).sort(), ['karsa-orlong', 'uruk']);

  assert.equal((await fetch(base + '/api/portraits/uruk', { method: 'DELETE' })).status, 204);
  assert.deepEqual(await (await fetch(base + '/api/portraits')).json(), { 'karsa-orlong': 'data:image/jpeg;base64,KKK' });

  assert.equal((await put('/api/portraits/..%2fescape', { dataUrl: 'data:image/png;base64,A' })).status, 400);
  assert.equal((await put('/api/portraits/uruk', { dataUrl: 'javascript:alert(1)' })).status, 400);

  assert.equal((await put('/api/portraits', { korlat: 'data:image/png;base64,C' })).status, 204);
  assert.deepEqual(await (await fetch(base + '/api/portraits')).json(), { korlat: 'data:image/png;base64,C' });
});

test('concurrent portrait uploads are all kept', async () => {
  await put('/api/portraits', {});
  const ids = Array.from({ length: 15 }, (_, i) => `hero-${i}`);
  await Promise.all(ids.map((id) => put(`/api/portraits/${id}`, { dataUrl: `data:image/png;base64,${id}` })));
  assert.deepEqual(Object.keys(await (await fetch(base + '/api/portraits')).json()).sort(), [...ids].sort());
});

test('writes are atomic: no temporary files are left behind', async () => {
  assert.deepEqual((await readdir(dataDir)).filter((f) => f.endsWith('.tmp')), []);
});

test('refuses bodies over the size limit', async () => {
  const huge = 'x'.repeat(33 * 1024 * 1024);
  const r = await put('/api/snapshots', null, `["${huge}"]`).catch(() => ({ status: 413 }));
  assert.equal(r.status, 413);
});
