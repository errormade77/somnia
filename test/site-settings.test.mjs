import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createOrbTheme, orbVariantIds, orbVariantDefinitions } from 'orbloom';
import { createSomniaServer } from '../server.mjs';
import { initialOrbSettings, initialScrollSettings, initialGallerySettings, validateSiteSettings, presetSettings } from '../orb-config.js';

const baseline = () => ({ version: 1, orb: { ...initialOrbSettings }, scroll: { ...initialScrollSettings }, gallery: { ...initialGallerySettings } });
async function listen(settingsPath, options = {}) {
  const app = createSomniaServer({ settingsPath, liveReload: false, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'somnia-settings-'));
  const path = join(directory, 'site-settings.json');
  await writeFile(path, JSON.stringify(baseline()));
  const app = await listen(path, options);
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  return { ...app, path };
}
const put = (url, settings, headers = {}) => fetch(`${url}/api/site-settings`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: url, ...headers }, body: JSON.stringify(settings),
});

test('every upstream preset produces valid visual-only settings and an Orbloom theme', () => {
  for (const id of orbVariantIds) {
    const orb = { ...initialOrbSettings, ...presetSettings(id, orbVariantDefinitions[id]) };
    assert.doesNotThrow(() => validateSiteSettings({ version: 1, orb }, orbVariantIds), id);
    assert.doesNotThrow(() => createOrbTheme({
      preset: id, seed: orb.seed,
      colors: { base: orb.base, interior: orb.interior, accents: [orb.accent1, orb.accent2, orb.accent3] },
      appearance: { intensity: orb.intensity, glass: orb.glass, detail: orb.detail, glow: orb.glow },
      motion: { speed: orb.speed, drift: orb.drift },
    }), id);
  }
});

test('saved values become defaults on disk and for a fresh server instance', async t => {
  const app = await fixture(t);
  const changed = baseline();
  changed.scroll = { enabled: false, speed: 1.6, smoothness: .32 };
  changed.gallery = { edgeBlur: 18, edgeFade: 84, matte: 62 };
  Object.assign(changed.orb, { size: 300, accent1: '#abcdef', intensity: 1.27, motion: 'off', ambientFloat: false, animationSpeed: 2.25, dotSize: 135, matte: 65 });
  const response = await put(app.url, changed);
  assert.equal(response.status, 200);
  const expected = validateSiteSettings(changed, orbVariantIds);
  assert.deepEqual(await response.json(), expected);
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), expected);
  const fresh = await listen(app.path);
  try {
    const loaded = await fetch(`${fresh.url}/api/site-settings`);
    assert.deepEqual(await loaded.json(), expected);
  } finally { await fresh.close(); }
});

test('legacy defaults gain preview controls without losing saved appearance', async t => {
  const app = await fixture(t);
  const legacy = baseline();
  delete legacy.scroll;
  delete legacy.gallery;
  delete legacy.orb.animationSpeed;
  delete legacy.orb.dotSize;
  delete legacy.orb.matte;
  Object.assign(legacy.orb, { size: 440, glass: .88, ambientFloat: false });
  await writeFile(app.path, JSON.stringify(legacy));
  const response = await fetch(`${app.url}/api/site-settings`);
  assert.equal(response.status, 200);
  const loaded = await response.json();
  assert.deepEqual(loaded.scroll, initialScrollSettings);
  assert.deepEqual(loaded.gallery, initialGallerySettings);
  assert.deepEqual(loaded.orb, { ...legacy.orb, animationSpeed: 1, dotSize: 100, matte: 0 });
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), legacy);
  const missingRequired = structuredClone(legacy);
  delete missingRequired.orb.glass;
  assert.throws(() => validateSiteSettings(missingRequired, orbVariantIds));
});

test('adding gallery defaults preserves every existing orb and scroll preference', () => {
  const legacy = baseline();
  delete legacy.gallery;
  Object.assign(legacy.orb, { size: 440, matte: 50, animationSpeed: 1.35, dotSize: 70, ambientFloat: false });
  legacy.scroll = { enabled: true, speed: 1.4, smoothness: .12 };
  const previous = structuredClone(legacy);
  const migrated = validateSiteSettings(legacy, orbVariantIds);
  assert.deepEqual(migrated.orb, previous.orb);
  assert.deepEqual(migrated.scroll, previous.scroll);
  assert.deepEqual(migrated.gallery, { edgeBlur: 32, edgeFade: 70, matte: 0 });
  assert.deepEqual(legacy, previous);
  migrated.gallery.edgeBlur = 99;
  assert.equal(initialGallerySettings.edgeBlur, 32);
});

test('gallery boundaries and numeric precision validate without changing the other sections', () => {
  for (const gallery of [{ edgeBlur: 0, edgeFade: 100, matte: 100 }, { edgeBlur: 100, edgeFade: 0, matte: 0 }, { edgeBlur: 32.5, edgeFade: 70.25, matte: .5 }]) {
    const settings = { ...baseline(), gallery };
    const validated = validateSiteSettings(settings, orbVariantIds);
    assert.deepEqual(validated, settings);
    assert.notEqual(validated.gallery, gallery);
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => validateSiteSettings({ ...baseline(), gallery: { ...initialGallerySettings, edgeBlur: value } }, orbVariantIds), RangeError);
  }
});

test('invalid values, voice fields, and cross-origin writes preserve the previous defaults', async t => {
  const app = await fixture(t);
  for (const patch of [{ size: 0 }, { glass: 5 }, { matte: -1 }, { matte: 101 }, { matte: null }, { matte: '50' }, { animationSpeed: 0 }, { animationSpeed: 4 }, { animationSpeed: null }, { dotSize: 49 }, { dotSize: 201 }, { dotSize: '100' }, { base: 'red' }, { motion: 'thinking' }, { state: 'thinking' }, { audioResponse: {} }, { preset: 'unknown' }, { ambientFloat: 'true' }]) {
    const response = await put(app.url, { version: 1, orb: { ...initialOrbSettings, ...patch } });
    assert.equal(response.status, 400, JSON.stringify(patch));
    await response.json();
  }
  assert.equal((await put(app.url, baseline(), { Origin: 'https://example.com' })).status, 403);
  assert.equal((await put(app.url, baseline(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), baseline());
});

test('LAN access is opt-in, accepts only the configured host, and retains same-origin writes', async t => {
  const local = await fixture(t);
  const localPort = new URL(local.url).port;
  const blocked = await fetch(local.url, { headers: { Host: `192.168.0.12:${localPort}` } });
  assert.equal(blocked.status, 403);
  await blocked.text();

  const lan = await fixture(t, { lanHosts: ['192.168.0.12'] });
  const port = new URL(lan.url).port;
  const host = `192.168.0.12:${port}`;
  for (const allowed of [host, `127.0.0.1:${port}`, `localhost:${port}`]) {
    const response = await fetch(lan.url, { headers: { Host: allowed } });
    assert.equal(response.status, 200, allowed);
    await response.text();
  }
  for (const rejected of [`example.com:${port}`, `192.168.0.13:${port}`, `192.168.0.12.example.com:${port}`]) {
    const response = await fetch(lan.url, { headers: { Host: rejected } });
    assert.equal(response.status, 403, rejected);
    await response.text();
  }

  const saved = baseline();
  saved.gallery.matte = 38;
  const acknowledged = await put(lan.url, saved, { Host: host, Origin: `http://${host}` });
  assert.equal(acknowledged.status, 200);
  await acknowledged.json();
  assert.deepEqual(JSON.parse(await readFile(lan.path, 'utf8')), saved);

  const attempted = { ...saved, gallery: { ...saved.gallery, matte: 92 } };
  for (const headers of [
    { Host: host, Origin: 'https://example.com' },
    { Host: host, Origin: `http://192.168.0.13:${port}` },
    { Host: host, Origin: 'http://192.168.0.12:1' },
    { Host: host, Origin: `http://${host}`, 'Sec-Fetch-Site': 'cross-site' },
  ]) {
    const response = await put(lan.url, attempted, headers);
    assert.equal(response.status, 403, JSON.stringify(headers));
    await response.json();
  }
  assert.deepEqual(JSON.parse(await readFile(lan.path, 'utf8')), saved);
  assert.deepEqual(JSON.parse(await readFile(local.path, 'utf8')), baseline());
});

test('overlapping saves remain complete JSON and the last acknowledged update wins', async t => {
  const app = await fixture(t);
  const responses = await Promise.all([0.4, 0.8, 1.1, 1.5].map(glow => put(app.url, { version: 1, orb: { ...initialOrbSettings, glow } })));
  for (const response of responses) { assert.equal(response.status, 200); await response.json(); }
  const final = { ...baseline(), orb: { ...initialOrbSettings, glow: 1.85 } };
  assert.equal((await put(app.url, final)).status, 200);
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), final);
});

test('malformed scroll settings never overwrite saved defaults', async t => {
  const app = await fixture(t);
  for (const scroll of [null, [], {}, { ...initialScrollSettings, enabled: 'true' },
    { ...initialScrollSettings, speed: 0 }, { ...initialScrollSettings, speed: 2.1 },
    { ...initialScrollSettings, smoothness: .01 }, { ...initialScrollSettings, smoothness: .5 },
    { ...initialScrollSettings, smoothness: null }, { ...initialScrollSettings, extra: true }]) {
    const response = await put(app.url, { ...baseline(), scroll });
    assert.equal(response.status, 400, JSON.stringify(scroll));
    await response.json();
  }
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), baseline());
});

test('invalid or unknown gallery parameters never overwrite the saved site defaults', async t => {
  const app = await fixture(t);
  for (const gallery of [null, [], {}, 'gallery',
    { edgeBlur: 32, edgeFade: 70 },
    { ...initialGallerySettings, extra: true },
    ...Object.keys(initialGallerySettings).flatMap(key => [-1, 101, null, '50', true].map(value => ({ ...initialGallerySettings, [key]: value })))]) {
    const response = await put(app.url, { ...baseline(), gallery });
    assert.equal(response.status, 400, JSON.stringify(gallery));
    await response.json();
  }
  assert.throws(() => validateSiteSettings({ ...baseline(), unknownGallery: {} }, orbVariantIds), TypeError);
  assert.deepEqual(JSON.parse(await readFile(app.path, 'utf8')), baseline());
});

test('browser modules are served locally without exposing server code or project configuration', async t => {
  const app = await fixture(t);
  for (const path of ['/sphere-flight.js', '/assets/sphere-gallery/presentation.js', '/dream-sphere.js', '/dream-sphere.css', '/dream-sphere-geometry.js', '/hover-glow.js', '/assets/voice-glow/engine.js', '/smooth-scroll.js', '/device-preview.js', '/device-preview.css', '/gesture-preview.js', '/style-preview.js', '/saving-preview.js', '/home-preview.js', '/orb-refraction.js', '/settings-geometry.js', '/navigation.js', '/orb-settings.js', '/orb-config.js', '/vendor/orbloom/controller.js', '/vendor/orbloom/shaders.js', '/vendor/orbloom/orb.css']) {
    const response = await fetch(app.url + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 0);
  }
  for (const path of ['/server.mjs', '/site-settings.json', '/.git/config', '/vendor/orbloom/package.json', '/vendor/orbloom/../../server.mjs']) {
    assert.equal((await fetch(app.url + path)).status, 404, path);
  }
});

test('home and direct settings links serve the shared app, while unknown routes stay private', async t => {
  const app = await fixture(t);
  for (const path of ['/', '/settings', '/settings/']) {
    const response = await fetch(app.url + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.match(html, /id="home-view"/);
    assert.match(html, /id="settings-view"/);
    assert.equal((html.match(/id="device-orb"/g) || []).length, 1);
  }
  assert.equal((await fetch(app.url + '/unknown')).status, 404);
});
