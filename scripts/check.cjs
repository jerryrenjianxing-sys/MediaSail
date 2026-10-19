'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const lock = require('../runtime-lock.json');
const python = process.env.MEDIASAIL_PYTHON || path.join(root, 'build/runtime-business/python', `cpython-${lock.python}-windows-x86_64-none/python.exe`);
const frontend = path.join(root, 'vendor/easel/web/frontend');
function requireFile(file, message) {
  if (!fs.existsSync(file)) throw new Error(message + '\nMissing: ' + file);
}
function run(label, executable, args, cwd = root) {
  console.log('\nCHECK: ' + label);
  const result = cp.spawnSync(executable, args, { cwd, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1', PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(label + ' failed (exit ' + result.status + ')');
}
try {
  requireFile(python, 'Prepare the locked business Python dependencies first, or set MEDIASAIL_PYTHON.');
  const tsc = path.join(frontend, 'node_modules/typescript/bin/tsc');
  const vite = path.join(frontend, 'node_modules/vite/bin/vite.js');
  requireFile(tsc, 'Prepare the pinned frontend and run npm ci in vendor/easel/web/frontend first.');
  requireFile(vite, 'Frontend dependencies are incomplete; run npm ci in vendor/easel/web/frontend.');
  run('pinned upstream patch replay', process.execPath, ['scripts/verify-source-patch.cjs']);
  run('Node behavior checks', process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).sort().map(name => 'tests/' + name)]);
  run('Python behavior checks', python, ['-X', 'utf8', '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v']);
  run('frontend types', process.execPath, [tsc, '-b'], frontend);
  run('frontend build', process.execPath, [vite, 'build'], frontend);
  run('published interface reference', python, ['-X', 'utf8', '-B', 'scripts/export-agent-api.py', '--check']);
  console.log('\nSource checks passed. Packaged application and real installation checks are separate.');
} catch (error) {
  console.error('\nSource checks failed: ' + error.message);
  process.exitCode = 1;
}
