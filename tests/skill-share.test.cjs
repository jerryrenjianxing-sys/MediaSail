'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { fileURLToPath } = require('node:url');
const { createSkillShareHandler } = require('../desktop/skill-share.cjs');
async function fixture(t) {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'MediaSail 复制 # % '));
  const server = http.createServer((request, response) => { assert.equal(request.url, '/api/platform-skill?format=connect'); response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.end('# MediaSail\n本机接入说明'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port, main = { mainFrame: { url: origin + '/' } }, writes = [];
  const clipboard = { write: async items => writes.push(items) };
  class ClipboardItem { constructor(items) { this.items = items; } }
  const handler = createSkillShareHandler({ main: () => main, localOrigin: () => origin, data: () => data, available: () => true, clipboard, ClipboardItem });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(path.dirname(data), path.resolve(os.tmpdir())); await fs.rm(data, { recursive: true, force: true }); });
  return { data, main, origin, server, writes, clipboard, handler, event: { sender: main, senderFrame: main.mainFrame } };
}
test('copying a named Skill produces a persistent UTF-8 file attachment with no competing text representation', async t => {
  const f = await fixture(t), result = await f.handler(f.event, '运营 # % 接入.md');
  assert.deepEqual(result, { ok: true, data: { fileName: '运营 # % 接入.md' } });
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].length, 1);
  const formats = f.writes[0][0].items; assert.deepEqual(Object.keys(formats), ['text/uri-list']);
  const file = fileURLToPath(formats['text/uri-list'].trim());
  assert.equal(path.basename(file), '运营 # % 接入.md');
  assert.ok(file.startsWith(path.join(f.data, 'cache/agent-share') + path.sep));
  assert.equal(await fs.readFile(file, 'utf8'), '# MediaSail\n本机接入说明');
});
test('file copying refuses paths, executable names and invalid Windows names before changing the clipboard', async t => {
  const f = await fixture(t);
  for (const name of ['../escape.md','C:\\private.md','file:///secret.md','x.txt','x.MD','CON.md','LPT1.md','a/b.md','x:stream.md','x\0.md','.md','..md','x.md ',{},null]) {
    assert.equal((await f.handler(f.event, name)).ok, false, String(name));
  }
  assert.equal(f.writes.length, 0);
});
test('repeat copying keeps independent snapshots and a failed clipboard write does not report success', async t => {
  const f = await fixture(t);
  await f.handler(f.event, 'MediaSail 接入.md'); await f.handler(f.event, 'MediaSail 接入.md');
  const files = f.writes.map(items => fileURLToPath(items[0].items['text/uri-list'].trim()));
  assert.notEqual(files[0], files[1]); for (const file of files) assert.equal(await fs.readFile(file, 'utf8'), '# MediaSail\n本机接入说明');
  f.clipboard.write = async () => { throw Error('clipboard locked'); };
  const failure = await f.handler(f.event, '再次复制.md'); assert.equal(failure.ok, false); assert.match(failure.error, /clipboard locked/);
});
test('linked cache directories cannot redirect an attachment outside the current library', async t => {
  const f = await fixture(t), outside = path.join(f.data, 'outside'); await fs.mkdir(outside);
  await fs.symlink(outside, path.join(f.data, 'cache'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await f.handler(f.event, '接入.md')).ok, false); assert.equal(f.writes.length, 0);
  assert.deepEqual(await fs.readdir(outside), []);
});
test('copying stops when the service becomes unavailable while reading the card, and can retry afterwards', async t => {
  const f = await fixture(t); let available = true, release;
  f.server.removeAllListeners('request'); f.server.on('request', (_req, res) => { release = () => res.end('# delayed card'); });
  const handler = createSkillShareHandler({ main: () => f.main, localOrigin: () => f.origin, data: () => f.data, available: () => available, clipboard: f.clipboard, ClipboardItem: class { constructor(items) { this.items = items; } } });
  const pending = handler(f.event, '接入.md'); while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  available = false; release(); assert.equal((await pending).ok, false); assert.equal(f.writes.length, 0);
  available = true; const retry = handler(f.event, '接入.md'); await new Promise(resolve => setTimeout(resolve, 20)); release(); assert.equal((await retry).ok, true);
});
test('duplicate copies are refused while the first is pending, then become usable again', async t => {
  const f = await fixture(t), releases = [];
  f.server.removeAllListeners('request'); f.server.on('request', (_req, res) => { releases.push(() => res.end('# delayed card')); });
  const pending = f.handler(f.event, '接入.md'); while (!releases.length) await new Promise(resolve => setTimeout(resolve, 5));
  const duplicate = await Promise.race([f.handler(f.event, '接入.md'), new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))]);
  for (const release of releases) release(); assert.equal((await pending).ok, true); assert.equal(duplicate.ok, false);
});
test('foreign pages, subframes and unavailable service cannot copy, and HTTP or disk failures leave no success', async t => {
  const f = await fixture(t);
  for (const url of ['https://example.com/', f.origin + '/?remote=1', f.origin + '/assets/index.html', 'file:///app/startup.html']) {
    f.main.mainFrame.url = url; assert.equal((await f.handler(f.event, '接入.md')).ok, false);
  }
  f.main.mainFrame.url = f.origin + '/';
  assert.equal((await f.handler({ sender: f.main, senderFrame: { url: f.main.mainFrame.url } }, '接入.md')).ok, false);
  f.server.removeAllListeners('request'); f.server.on('request', (_req, res) => { res.writeHead(503); res.end('unavailable'); });
  assert.equal((await f.handler(f.event, '接入.md')).ok, false);
  f.server.removeAllListeners('request'); f.server.on('request', (_req, res) => res.end('# retry'));
  await fs.writeFile(path.join(f.data, 'cache'), 'not a directory');
  assert.equal((await f.handler(f.event, '接入.md')).ok, false); assert.equal(f.writes.length, 0);
});
