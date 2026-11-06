import { copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = 'somnia-static-site';
const manifestName = 'build-manifest.json';
const originalSettingsRoute = String.raw`/^\/settings\/?$/`;
const textExtensions = new Set(['.html', '.css', '.js', '.svg']);

export function normalizeBase(value = '/somnia/') {
  if (value === '' || value === '/') return '/';
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+\/?$/.test(value)
    || value.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('Base must be an absolute URL path, for example /somnia/ or /.');
  }
  return `${value.replace(/\/$/, '')}/`;
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function settingsRoute(base) {
  return `new RegExp(${JSON.stringify(`^${escapeRegExp(base)}settings(?:/|/index\\.html)?$`)})`;
}

function hostedPath(value, base) {
  if (value === '/settings' || value === '/settings/') return `${base}settings/`;
  return `${base}${value.slice(1)}`;
}

function rootFilePattern(rootFiles) {
  return new RegExp(`(["'\x60])(/(?:${rootFiles.map(escapeRegExp).join('|')})(?:[?#][^"'\x60\\s]*)?)\\1`, 'g');
}

/** Only application URLs are rewritten; strings such as Three.js's "/" stay intact. */
export function transformSource(source, file, { base, rootFiles }) {
  let result = source;
  if (file === 'index.html' || file === 'navigation.js') {
    const occurrences = result.split(originalSettingsRoute).length - 1;
    if (occurrences !== 1) throw new Error(`${file}: expected one settings route; review the static route transform.`);
    result = result.replace(originalSettingsRoute, settingsRoute(base));
  }
  if (file === 'index.html') {
    result = result.replace(/[ \t]*<script type="module">if \(new URLSearchParams\(location.search\)\.has\('perf'\)\) import\('\/assets\/performance-probe\.js'\);<\/script>\r?\n?/, '');
  }
  if (file === 'app.js') {
    result = result.replace(/(?:\/\/ The local server announces file edits so the preview stays current\.\r?\n)?const reloadStream = new EventSource\('\/__reload'\);\r?\nreloadStream\.addEventListener\('reload', \(\) => window\.location\.reload\(\)\);\r?\n?/, '');
  }
  if (/\/api\/|__reload/.test(result)) {
    throw new Error(`${file}: local-server endpoint remains. Static pages must use assets/site-defaults.js without API writes or live reload.`);
  }
  result = result.replace(/(["'`])\/(assets|vendor)\//g, (_, quote, directory) => `${quote}${base}${directory}/`);
  result = result.replace(rootFilePattern(rootFiles), (_, quote, url) => `${quote}${hostedPath(url, base)}${quote}`);
  result = result.replace(/(["'`])(\/settings\/?)\1/g, (_, quote, url) => `${quote}${hostedPath(url, base)}${quote}`);
  result = result.replace(/(\bhref\s*=\s*)(["'])\/\2/g, (_, attribute, quote) => `${attribute}${quote}${base}${quote}`);
  result = result.replace(/(url\(\s*)\/(assets|vendor)\//g, (_, opening, directory) => `${opening}${base}${directory}/`);
  return result;
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported in the static artifact: ${relative}`);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

function localReferences(source, file, base) {
  const references = new Set();
  // HTML resources, links and lazy-loaded video URLs; SVG links are included too.
  for (const match of source.matchAll(/\b(?:src|href|poster|data-src)\s*=\s*(["'])([^"']+)\1/g)) references.add(match[2]);
  for (const match of source.matchAll(/url\(\s*(["']?)([^)"'\s]+)\1\s*\)/g)) references.add(match[2]);
  if (file.endsWith('.js') || file.endsWith('.html')) {
    for (const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)(["'])([^"']+)\1/g)) references.add(match[2]);
    // Catalog media, fetch(), generated images and dynamic retention assets.
    const absolute = new RegExp(`(["'\x60])(${escapeRegExp(base)}(?:assets/|vendor/|site-settings\\.json)[^"'\x60\\s]*)\\1`, 'g');
    for (const match of source.matchAll(absolute)) references.add(match[2]);
  }
  return [...references].filter(url => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url));
}

/** Validate the emitted module/resource graph, including direct /settings/ loads. */
export async function verifyArtifact(directory, base, files) {
  const known = new Set(files);
  const check = (url, file) => {
    if (url.includes('${')) {
      if (url === `${base}assets/retention-\${value}.svg`) {
        for (const value of [7, 14, 30]) check(url.replace('${value}', String(value)), file);
        return;
      }
      throw new Error(`${file}: unverified dynamic URL ${url}`);
    }
    const pathname = url.split(/[?#]/, 1)[0];
    let relative;
    if (pathname.startsWith('/')) {
      if (!pathname.startsWith(base)) throw new Error(`${file}: URL escapes the configured base: ${url}`);
      relative = pathname.slice(base.length);
    } else {
      relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), pathname));
    }
    if (relative === '' || relative.endsWith('/')) relative += 'index.html';
    if (!known.has(relative)) throw new Error(`${file}: missing local resource ${url} (expected ${relative})`);
  };
  for (const file of files) {
    if (!textExtensions.has(path.extname(file))) continue;
    const source = await readFile(path.join(directory, file), 'utf8');
    for (const url of localReferences(source, file, base)) check(url, file);
  }
}

async function validateOutput(root, outDir) {
  const output = path.resolve(root, outDir);
  const name = path.relative(root, output);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)
    || ['assets', 'node_modules', 'scripts', 'test', 'tests'].includes(name)) {
    throw new Error('Output must be a separate direct child of the project, for example dist or dist-root.');
  }
  let state;
  try { state = await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (state) {
    if (!state.isDirectory() || state.isSymbolicLink()) throw new Error(`Refusing to replace ${output}.`);
    const entries = await readdir(output);
    if (entries.length) {
      let manifest;
      try { manifest = JSON.parse(await readFile(path.join(output, manifestName), 'utf8')); } catch {}
      if (manifest?.generator !== generator) throw new Error(`Output is not a generated Somnia artifact: ${output}`);
    }
  }
  return output;
}

export async function buildSite({ root = projectRoot, base = '/somnia/', outDir = 'dist' } = {}) {
  base = normalizeBase(base);
  root = path.resolve(root);
  const output = await validateOutput(root, outDir);
  const entries = await readdir(root, { withFileTypes: true });
  const rootFiles = entries.filter(entry => entry.isFile() && /\.(?:js|css)$/.test(entry.name)).map(entry => entry.name).sort();
  const sourceFiles = ['index.html', ...rootFiles];
  const assets = await listFiles(path.join(root, 'assets'));
  const vendorRoot = path.join(root, 'node_modules/orbloom');
  let vendor;
  try { vendor = (await listFiles(path.join(vendorRoot, 'src'))).filter(file => /\.(?:js|css)$/.test(file)); }
  catch (error) { if (error.code === 'ENOENT') throw new Error('orbloom is missing. Run npm ci before building.'); throw error; }
  const [{ validateSiteSettings }, { orbVariantIds }] = await Promise.all([
    import(pathToFileURL(path.join(root, 'orb-config.js')).href),
    import(pathToFileURL(path.join(vendorRoot, 'src/presets.js')).href),
  ]);
  const defaults = validateSiteSettings(JSON.parse(await readFile(path.join(root, 'site-settings.json'), 'utf8')), orbVariantIds);
  const staging = await mkdtemp(path.join(root, '.site-build-'));
  const files = [];
  const copy = async (source, destination) => {
    const target = path.join(staging, destination);
    const state = await lstat(source);
    if (!state.isFile() || state.isSymbolicLink()) throw new Error(`Expected a regular file: ${source}`);
    await mkdir(path.dirname(target), { recursive: true });
    if (textExtensions.has(path.extname(destination))) {
      const content = transformSource(await readFile(source, 'utf8'), destination, { base, rootFiles: [...sourceFiles] });
      await writeFile(target, content);
    } else await copyFile(source, target);
    files.push(destination);
  };
  try {
    for (const file of sourceFiles) await copy(path.join(root, file), file);
    for (const file of assets) {
      if (!['site-defaults.js', 'performance-probe.js'].includes(file)) await copy(path.join(root, 'assets', file), `assets/${file}`);
    }
    await writeFile(path.join(staging, 'assets/site-defaults.js'), `// Generated from site-settings.json by scripts/build-site.mjs.\nexport const siteDefaults = ${JSON.stringify(defaults, null, 2)};\n`);
    files.push('assets/site-defaults.js');
    for (const file of vendor) await copy(path.join(vendorRoot, 'src', file), `vendor/orbloom/${file}`);
    await copy(path.join(vendorRoot, 'LICENSE'), 'vendor/orbloom/LICENSE');
    await mkdir(path.join(staging, 'settings'));
    await copyFile(path.join(staging, 'index.html'), path.join(staging, 'settings/index.html'));
    await writeFile(path.join(staging, '.nojekyll'), '');
    files.push('settings/index.html', '.nojekyll');
    await verifyArtifact(staging, base, files);
    await writeFile(path.join(staging, manifestName), `${JSON.stringify({ generator, base, files: files.sort() }, null, 2)}\n`);
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    return { output, base, fileCount: files.length + 1 };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  try {
    for (let i = 2; i < process.argv.length; i += 2) {
      const flag = process.argv[i];
      const value = process.argv[i + 1];
      if (!['--base', '--out-dir'].includes(flag) || value === undefined) throw new Error('Usage: node scripts/build-site.mjs [--base /somnia/] [--out-dir dist]');
      options[flag === '--base' ? 'base' : 'outDir'] = value;
    }
    const result = await buildSite(options);
    console.log(`Built ${result.fileCount} files in ${result.output} (base ${result.base}).`);
  } catch (error) {
    console.error(`Static build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
