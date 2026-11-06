import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createSomniaServer } from '../server.mjs';
import { dreams, atlas } from '../assets/dreams/catalog.js';

test('video responses support Safari probes, seeking, suffix ranges and HEAD', async t => {
  const app = createSomniaServer({ liveReload: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const data = await readFile(new URL(`..${dreams[0].src}`, import.meta.url));
  for (const [range, start, end] of [
    ['bytes=0-1', 0, 1], ['bytes=100-199', 100, 199],
    ['bytes=-32', data.length - 32, data.length - 1],
    [`bytes=${data.length - 16}-`, data.length - 16, data.length - 1],
    [`bytes=${data.length - 16}-${data.length + 100}`, data.length - 16, data.length - 1],
  ]) {
    const response = await fetch(url + dreams[0].src, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${data.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), data.subarray(start, end + 1));
  }
  for (const range of [`bytes=${data.length}-`, 'bytes=100-50', 'bytes=-0']) {
    const response = await fetch(url + dreams[0].src, { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${data.length}`);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
  const head = await fetch(url + dreams[0].src, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), data.length);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const etag = head.headers.get('etag');
  assert.ok(etag);
  const cached = await fetch(url + dreams[0].src, { headers: { 'If-None-Match': etag } });
  assert.equal(cached.status, 304);
  assert.equal((await cached.arrayBuffer()).byteLength, 0);
  const weakCached = await fetch(url + dreams[0].src, { headers: { 'If-None-Match': 'W/' + etag } });
  assert.equal(weakCached.status, 304);
  const seek = await fetch(url + dreams[0].src, { headers: { Range: 'bytes=100-199', 'If-Range': etag } });
  assert.equal(seek.status, 206);
  assert.deepEqual(Buffer.from(await seek.arrayBuffer()), data.subarray(100, 200));
  const stale = await fetch(url + dreams[0].src, { headers: { Range: 'bytes=100-199', 'If-Range': '"outdated"' } });
  assert.equal(stale.status, 200);
  assert.equal((await stale.arrayBuffer()).byteLength, data.length);
  for (const path of ['/assets/sphere-gallery/atlas-blur.js', '/assets/sphere-gallery/appearance.js', '/assets/sphere-gallery/gallery.js', '/assets/sphere-gallery/three.js', '/assets/sphere-gallery/gsap.js', '/dream-sphere-geometry.js', '/dream-media.js', '/dream-grid-layout.js', '/assets/orb-displacement.png', '/assets/home-avatar-small.png', '/assets/dreams/catalog.js', atlas.src, atlas.poster, ...dreams.flatMap(dream => [dream.src, dream.poster])]) {
    const response = await fetch(url + path, { method: 'HEAD' });
    assert.equal(response.status, 200, path);
    assert.ok(Number(response.headers.get('content-length')) > 0, path);
  }
});
