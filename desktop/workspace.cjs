const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const seed = p => /^(profiles|assets|outputs)\//.test(p) || p === '.env' || p === 'cookies.json' || /\/config\//.test(p);
function safe(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep) || path.isAbsolute(relative)) throw new Error('Invalid manifest path');
  return target;
}
async function atomic(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file + '.desktop-tmp', bytes);
  await fs.rename(file + '.desktop-tmp', file);
}
async function read(file) { try { return await fs.readFile(file); } catch (e) { if(e.code === 'ENOENT') return null; throw e; } }
async function syncWorkspace(payload, data) {
  const manifest = JSON.parse(await fs.readFile(path.join(payload, 'manifest.json'), 'utf8'));
  const work = path.join(data, 'workspace');
  // Empty writable directories must not depend on Git placeholders: the
  // installer intentionally filters those non-runtime files out.
  for (const name of ['assets', 'outputs', 'profiles']) {
    await fs.mkdir(path.join(work, name), { recursive: true });
  }
  const oldBytes = await read(path.join(data, 'installed-manifest.json'));
  const old = oldBytes ? JSON.parse(oldBytes) : { files: {} };
  for (const [name, hash] of Object.entries(manifest.files)) {
    const dest = safe(work, name);
    const current = await read(dest);
    if (current && (seed(name) || digest(current) === hash)) continue;
    const source = await fs.readFile(safe(path.join(payload, 'easel'), name));
    if (digest(source) !== hash) throw new Error(`安装文件校验失败：${name}`);
    if (current && digest(current) !== old.files[name]) {
      await atomic(safe(path.join(data, 'upgrade-backups', manifest.version), name), current);
    }
    await atomic(dest, source);
  }
  for (const [name, hash] of Object.entries(old.files)) {
    if (manifest.files[name] || seed(name)) continue;
    const dest = safe(work, name), bytes = await read(dest);
    if (bytes && digest(bytes) === hash) await fs.unlink(dest);
  }
  await atomic(path.join(data, 'installed-manifest.json'), JSON.stringify(manifest));
  return work;
}
module.exports = { syncWorkspace, safe, digest, atomic };
