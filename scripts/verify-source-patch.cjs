'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'vendor/easel');
const pin = require('../runtime-lock.json').easel;
function run(executable, args, cwd, input) {
  return cp.execFileSync(executable, args, { cwd, input, windowsHide: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}
function files(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Unexpected source link: ' + relative);
    return entry.isDirectory() ? files(path.join(directory, entry.name), relative) : [relative];
  });
}
// Source archives already contain the curated snapshot, not the pristine Git fixture.
if (!fs.existsSync(path.join(source, '.git'))) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'upstream-files.json'), 'utf8'));
  assert.equal(snapshot.upstream, pin);
  const crypto = require('node:crypto');
  for (const [name, hash] of Object.entries(snapshot.files)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source, name))).digest('hex'), hash, name);
  }
  console.log('Verified distributed source snapshot; pristine patch replay is performed in repository CI.');
} else {
  assert.equal(run('git', ['rev-parse', 'HEAD'], source).trim(), pin, 'Unexpected upstream revision');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'MediaSail-patch-'));
  try {
    const replay = path.join(temporary, 'replay');
    fs.mkdirSync(replay);
    run('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', path.join(temporary, 'upstream.tar'), pin], source);
    run('tar', ['-xf', path.join(temporary, 'upstream.tar'), '-C', replay], root);
    for (const patch of fs.readdirSync(path.join(root, 'patches')).filter(name => name.endsWith('.patch')).sort()) {
      run('git', ['-c', 'core.autocrlf=false', 'apply', '--check', path.join(root, 'patches', patch)], replay);
      run('git', ['-c', 'core.autocrlf=false', 'apply', path.join(root, 'patches', patch)], replay);
    }
    const actual = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], source).split('\0').filter(Boolean).filter(name => fs.existsSync(path.join(source, name))).sort();
    const expected = files(replay).sort();
    assert.deepEqual(actual, expected, 'Source inventory differs from pristine patch replay; export the intended source patch.');
    run('git', ['init', '-q'], replay);
    run('git', ['config', 'core.autocrlf', 'false'], replay);
    // Compare Git's canonical bytes, honoring the working copy's actual text
    // filters; CRLF checkout policy is not an application source difference.
    const hashes = run('git', ['hash-object', '--stdin-paths'], source, actual.join('\n') + '\n').trim().split(/\r?\n/);
    const replayHashes = run('git', ['hash-object', '--stdin-paths'], replay, expected.join('\n') + '\n').trim().split(/\r?\n/);
    for (let index = 0; index < expected.length; index++) if (hashes[index] !== replayHashes[index]) throw new Error('Source patch is stale: ' + expected[index]);
    console.log('Pristine pinned patch replay matches ' + expected.length + ' canonical source files.');
  } finally {
    assert.equal(fs.realpathSync(path.dirname(temporary)), fs.realpathSync(os.tmpdir()), 'Unexpected cleanup root');
    assert.ok(path.basename(temporary).startsWith('MediaSail-patch-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
