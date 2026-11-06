import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildSite, normalizeBase } from '../scripts/build-site.mjs';
import { initialOrbSettings, initialScrollSettings, initialGallerySettings } from '../orb-config.js';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = String.raw`/^\/settings\/?$/`;
const settings = { version: 1, orb: { ...initialOrbSettings, size: 440, matte: 70 }, scroll: { ...initialScrollSettings }, gallery: { ...initialGallerySettings, edgeFade: 100 } };

async function fixture(t) {
  const parent = path.join(project, '.qa');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'build-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': `<script>document.documentElement.dataset.page = ${route}.test(location.pathname) ? 'settings' : 'home';</script>
      <link href="/styles.css" rel="stylesheet"><link href="/vendor/orbloom/orb.css" rel="stylesheet">
      <script type="module" src="/app.js"></script><script type="module" src="/orb-settings.js"></script>
      <script type="module">if (new URLSearchParams(location.search).has('perf')) import('/assets/performance-probe.js');</script>
      <a href="/">Home</a><a href="/settings">Settings</a><img src="/assets/photo.jpg">
      <video data-src="/assets/dream.mp4" poster="/assets/photo.jpg"></video>`,
    'app.js': `import { dreams } from './assets/catalog.js';\nimport './navigation.js';\nconst unchanged = '/';\n// The local server announces file edits so the preview stays current.\nconst reloadStream = new EventSource('/__reload');\nreloadStream.addEventListener('reload', () => window.location.reload());\n`,
    'navigation.js': `const pageAtLocation = () => ${route}.test(location.pathname) ? 'settings' : 'home';\nconst href = '/settings';`,
    'orb-settings.js': "import { siteDefaults } from './assets/site-defaults.js';\nimport { orbVariantIds } from '/vendor/orbloom/presets.js';",
    'styles.css': ".image { background: url('/assets/photo.jpg'); mask: url(/assets/mask.svg); filter: url(#glass); }",
    'assets/catalog.js': 'export const dreams = [{ src: "/assets/dream.mp4", poster: "/assets/photo.jpg" }];\nconst retention = value => fetch(`/assets/retention-${value}.svg`);',
    'assets/photo.jpg': 'image fixture',
    'assets/dream.mp4': 'video fixture',
    'assets/mask.svg': '<svg xmlns="http://www.w3.org/2000/svg"><g filter="url(#blur)"/></svg>',
    'assets/retention-7.svg': '<svg/>',
    'assets/retention-14.svg': '<svg/>',
    'assets/retention-30.svg': '<svg/>',
    'assets/site-defaults.js': 'export const siteDefaults = { stale: true };',
    'assets/performance-probe.js': 'must not be deployed',
    'node_modules/orbloom/src/orb.css': '.orb { color: white; }',
    'node_modules/orbloom/src/index.js': "export { orbVariantIds } from './presets.js';\nconst separator = '/';",
    'node_modules/orbloom/LICENSE': 'license fixture',
    'site-settings.json': JSON.stringify(settings),
    'server.mjs': 'must not be deployed',
    'private-notes.txt': 'must not be deployed',
    '.git/config': 'must not be deployed',
  };
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  }
  await copyFile(path.join(project, 'orb-config.js'), path.join(root, 'orb-config.js'));
  await copyFile(path.join(project, 'node_modules/orbloom/src/presets.js'), path.join(root, 'node_modules/orbloom/src/presets.js'));
  await writeFile(path.join(root, 'node_modules/orbloom/package.json'), '{"type":"module"}');
  return { root, files };
}

test('static base accepts Pages metadata and rejects non-path or traversal values', () => {
  assert.equal(normalizeBase('/somnia'), '/somnia/');
  assert.equal(normalizeBase('/somnia/'), '/somnia/');
  assert.equal(normalizeBase(''), '/');
  assert.equal(normalizeBase('/'), '/');
  for (const invalid of ['somnia', '//host/', '/../../', '/a/../b', '/a/./b', '/somnia?foo', '/somnia#foo', 'https://example.com/']) {
    assert.throws(() => normalizeBase(invalid));
  }
});

for (const base of ['/somnia/', '/']) {
  test(`static build resolves all assets, modules and direct settings URLs at ${base}`, async t => {
    const { root, files } = await fixture(t);
    const { output } = await buildSite({ root, base });
    const html = await readFile(path.join(output, 'index.html'), 'utf8');
    assert.equal(await readFile(path.join(output, 'settings/index.html'), 'utf8'), html);
    assert.ok(html.includes(`href="${base}settings/"`));
    assert.ok(html.includes(`href="${base}"`));
    assert.ok(html.includes(`src="${base}app.js"`));
    assert.ok(!html.includes('performance-probe'));
    const boot = html.match(/<script>(.*?)<\/script>/s)[1];
    const navigation = await readFile(path.join(output, 'navigation.js'), 'utf8');
    for (const pathname of [base, `${base}settings`, `${base}settings/`, `${base}settings/index.html`, `${base}settings-extra`]) {
      const expected = [base, `${base}settings-extra`].includes(pathname) ? 'home' : 'settings';
      const context = { document: { documentElement: { dataset: {} } }, location: { pathname } };
      vm.runInNewContext(boot, context);
      assert.equal(context.document.documentElement.dataset.page, expected, pathname);
      assert.equal(vm.runInNewContext(`${navigation}\npageAtLocation();`, { location: { pathname } }), expected, pathname);
    }
    const app = await readFile(path.join(output, 'app.js'), 'utf8');
    assert.ok(!app.includes('EventSource'));
    assert.ok(app.includes("const unchanged = '/';"));
    assert.ok((await readFile(path.join(output, 'styles.css'), 'utf8')).includes(`url(${base}assets/mask.svg)`));
    assert.ok((await readFile(path.join(output, 'assets/catalog.js'), 'utf8')).includes(`${base}assets/retention-\${value}.svg`));
    assert.equal(await readFile(path.join(output, 'vendor/orbloom/LICENSE'), 'utf8'), 'license fixture');
    assert.ok((await readdir(output)).includes('.nojekyll'));
    assert.ok(!(await readdir(output)).includes('server.mjs'));
    assert.ok(!(await readdir(output)).includes('private-notes.txt'));
    assert.ok(!(await readdir(output)).includes('.git'));
    assert.ok(!(await readdir(output)).includes('site-settings.json'));
    assert.ok(!(await readdir(path.join(output, 'assets'))).includes('performance-probe.js'));
    const defaultsModule = await readFile(path.join(output, 'assets/site-defaults.js'), 'utf8');
    const baked = JSON.parse(defaultsModule.match(/export const siteDefaults = (.*);/s)[1]);
    assert.deepEqual(baked, settings, 'all selected values are baked from JSON, never stale module values');
    assert.equal(await readFile(path.join(root, 'app.js'), 'utf8'), files['app.js'], 'source dev behavior is unchanged');
    assert.equal(await readFile(path.join(root, 'assets/site-defaults.js'), 'utf8'), files['assets/site-defaults.js'], 'generated defaults only change in artifact');
  });
}

test('failed builds retain the previous artifact and reject local APIs or missing resources', async t => {
  const { root } = await fixture(t);
  const { output } = await buildSite({ root });
  const original = await readFile(path.join(output, 'app.js'), 'utf8');
  await writeFile(path.join(root, 'app.js'), "fetch('/api/site-settings');");
  await assert.rejects(buildSite({ root }), /local-server endpoint/);
  assert.equal(await readFile(path.join(output, 'app.js'), 'utf8'), original);
  await writeFile(path.join(root, 'app.js'), "const image = '/assets/missing.png';");
  await assert.rejects(buildSite({ root }), /missing local resource/);
  assert.equal(await readFile(path.join(output, 'app.js'), 'utf8'), original);
  await writeFile(path.join(root, 'app.js'), '');
  await writeFile(path.join(root, 'site-settings.json'), JSON.stringify({ ...settings, gallery: { ...settings.gallery, matte: 101 } }));
  await assert.rejects(buildSite({ root }), /диапазона/);
  assert.equal(await readFile(path.join(output, 'app.js'), 'utf8'), original);
});

test('build refuses to overwrite source directories or an unrelated output directory', async t => {
  const { root } = await fixture(t);
  for (const outDir of ['.', '..', '../elsewhere', 'assets', 'node_modules', 'scripts', 'test']) {
    await assert.rejects(buildSite({ root, outDir }), /separate direct child/);
  }
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist/keep.txt'), 'keep');
  await assert.rejects(buildSite({ root }), /not a generated Somnia artifact/);
  assert.equal(await readFile(path.join(root, 'dist/keep.txt'), 'utf8'), 'keep');
});
