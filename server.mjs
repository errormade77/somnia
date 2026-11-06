import { createServer } from 'node:http';
import { readFile, stat, writeFile, rename, rm } from 'node:fs/promises';
import { watch, createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { orbVariantIds } from 'orbloom';
import { validateSiteSettings } from './orb-config.js';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const publicFiles = new Set(['/index.html', '/styles.css', '/app.js', '/orb-settings.js', '/orb-config.js', '/navigation.js', '/sphere-flight.js', '/device-preview.js', '/device-preview.css', '/gesture-preview.js', '/dream-media.js', '/dream-storage-sphere.js', '/dream-grid-layout.js', '/dream-sphere.js', '/dream-sphere.css', '/dream-sphere-geometry.js', '/style-preview.js', '/saving-preview.js', '/home-preview.js', '/orb-refraction.js', '/settings-geometry.js', '/smooth-scroll.js', '/hover-glow.js']);
const vendorFiles = new Set(['index.js', 'controller.js', 'customization.js', 'presets.js', 'motion.js', 'orb-engine.js', 'shaders.js', 'audio.js', 'audio-calibration.js', 'orb.css']);

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new RangeError('Слишком большой запрос.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createSomniaServer({ settingsPath = resolve(root, 'site-settings.json'), liveReload = true, lanHosts = [] } = {}) {
  const clients = new Set();
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', ...lanHosts]);
  let writeQueue = Promise.resolve();

  function persistSettings(settings) {
    const operation = writeQueue.then(async () => {
      const temporary = `${settingsPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { flag: 'wx' });
        await rename(temporary, settingsPath);
      } finally {
        await rm(temporary, { force: true });
      }
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  const server = createServer(async (request, response) => {
    try {
      const origin = new URL(`http://${request.headers.host}`);
      if (!allowedHosts.has(origin.hostname)) {
        json(response, 403, { error: 'Адрес сервера не разрешён.' });
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
      if (pathname === '/api/site-settings') {
        if (request.method === 'GET') {
          await writeQueue;
          const settings = validateSiteSettings(JSON.parse(await readFile(settingsPath, 'utf8')), orbVariantIds);
          json(response, 200, settings);
          return;
        }
        if (request.method === 'PUT') {
          if ((request.headers.origin && request.headers.origin !== origin.origin) || request.headers['sec-fetch-site'] === 'cross-site') {
            json(response, 403, { error: 'Сохранение разрешено только с этой страницы.' });
            return;
          }
          if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
            json(response, 415, { error: 'Требуется JSON.' });
            return;
          }
          const settings = validateSiteSettings(await readJson(request), orbVariantIds);
          await persistSettings(settings);
          json(response, 200, settings);
          return;
        }
        response.writeHead(405, { Allow: 'GET, PUT' }).end();
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      if (pathname === '/__reload' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        response.write(': connected\n\n');
        clients.add(response);
        request.on('close', () => clients.delete(response));
        return;
      }
      const route = ['/', '/settings', '/settings/'].includes(pathname) ? '/index.html' : pathname;
      let path;
      if (route.startsWith('/vendor/orbloom/')) {
        const filename = route.slice('/vendor/orbloom/'.length);
        if (vendorFiles.has(filename)) path = resolve(root, 'node_modules/orbloom/src', filename);
      } else if (publicFiles.has(route) || route.startsWith('/assets/')) {
        const resolved = resolve(root, `.${route}`);
        if (resolved.startsWith(root + sep) && !route.split('/').some(part => part.startsWith('.'))) path = resolved;
      }
      const file = path ? await stat(path) : null;
      if (!file?.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      // Revalidate local assets without retransferring fonts, media and scripts.
      // Keep no-cache so saved edits still appear immediately during development.
      const etag = '"' + file.size.toString(16) + '-' + Math.trunc(file.mtimeMs * 1000).toString(16) + '"';
      const modified = file.mtime.toUTCString();
      const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'ETag': etag, 'Last-Modified': modified, 'X-Content-Type-Options': 'nosniff' };
      const noneMatch = request.headers['if-none-match'];
      const notModified = noneMatch
        ? noneMatch.split(',').some(value => value.trim().replace(/^W\//, '') === etag || value.trim() === '*')
        : request.headers['if-modified-since'] && Date.parse(modified) <= Date.parse(request.headers['if-modified-since']);
      if (notModified) { response.writeHead(304, headers).end(); return; }
      let start = 0;
      let end = file.size - 1;
      let status = 200;
      // Browser video decoders request small byte ranges, including Safari's initial 0–1 probe.
      // Cached video seeking may carry If-Range; only use its range when it matches.
      const ifRange = request.headers['if-range'];
      const rangeMatches = !ifRange || ifRange === etag || (Date.parse(modified) <= Date.parse(ifRange));
      const range = request.method === 'GET' && rangeMatches && /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || '');
      if (range && (range[1] || range[2])) {
        start = range[1] ? Number(range[1]) : Math.max(0, file.size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) {
          response.writeHead(416, { ...headers, 'Content-Range': `bytes */${file.size}`, 'Content-Length': 0 }).end();
          return;
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`;
      }
      response.writeHead(status, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
      if (request.method === 'HEAD' || file.size === 0) { response.end(); return; }
      const stream = createReadStream(path, { start, end });
      response.on('close', () => stream.destroy());
      stream.on('error', error => response.destroy(error));
      stream.pipe(response);
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : error instanceof TypeError || error instanceof RangeError || error instanceof SyntaxError || error instanceof URIError ? 400 : 500;
      json(response, status, { error: status === 500 ? 'Не удалось сохранить настройки. Повторите попытку.' : error.message });
    }
  });

  let debounce;
  const watcher = liveReload ? watch(root, (event, name) => {
    // The saved configuration changes live and must not trigger a page reload.
    if (!publicFiles.has(`/${name}`)) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => { for (const client of clients) client.write('event: reload\ndata: updated\n\n'); }, 100);
  }) : null;
  const heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 20000);
  heartbeat.unref();
  server.on('close', () => { watcher?.close(); clearInterval(heartbeat); clearTimeout(debounce); });
  return {
    server,
    async close() {
      watcher?.close();
      clearInterval(heartbeat);
      clearTimeout(debounce);
      for (const client of clients) client.end();
      await writeQueue;
      await new Promise((done, reject) => {
        server.close(error => error ? reject(error) : done());
        server.closeIdleConnections?.();
      });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lan = process.argv.includes('--lan');
  const lanHosts = lan ? [...new Set(Object.values(networkInterfaces()).flat()
    .filter(entry => entry && !entry.internal && entry.family === 'IPv4'
      && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address))
    .map(entry => entry.address))] : [];
  if (lan && !lanHosts.length) throw new Error('Не найден IPv4-адрес локальной сети.');
  const app = createSomniaServer({ lanHosts });
  const host = lan ? '0.0.0.0' : '127.0.0.1';
  const port = Number(process.env.PORT || 5173);
  app.server.on('error', error => { console.error(error.message); process.exit(1); });
  app.server.listen(port, host, () => {
    console.log(`Somnia is running at http://127.0.0.1:${port}`);
    for (const address of lanHosts) console.log(`Local network: http://${address}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { app.close().catch(console.error); });
}
