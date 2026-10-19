// An external PowerShell consumer uses only packaged discovery and Skill files.
'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json');
const run = path.join(os.homedir(), 'Documents', 'MediaSail 隔离验证', 'Agent 画像 ' + Date.now());
const bootstrap = path.join(run, '连接定位'), libraryRoot = path.join(run, '中文 空格资料库');
const executable = path.resolve(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe');
let app;
async function write(file, text) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text, 'utf8'); }
async function powershell(args) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], { windowsHide: true, timeout: 60000, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
    let stdout = '', stderr = ''; child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => stdout += value); child.stderr.on('data', value => stderr += value);
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(stdout) : reject(Error(stdout + '\n' + stderr)));
  });
}
(async () => {
  const layout = await require('../desktop/library.cjs').chooseLibrary({ bootstrapRoot: bootstrap, targetRoot: libraryRoot, installDirectory: path.dirname(executable) });
  await write(path.join(layout.workspace, 'profiles/合成画像/memory.md'), '# 原运营经验');
  try {
    const env = { ...process.env, EASEL_LIBRARY_BOOTSTRAP: bootstrap, LOCALAPPDATA: path.join(run, 'Local'), APPDATA: path.join(run, 'Roaming') };
    delete env.ELECTRON_RUN_AS_NODE; delete env.EASEL_DESKTOP_DATA;
    app = await electron.launch({ executablePath: executable, env });
    const page = await app.firstWindow(); await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
    const info = JSON.parse(await fs.readFile(path.join(bootstrap, 'agent-connection.json'), 'utf8'));
    const helper = path.join(info.skillDir, 'scripts/mediasail.ps1');
    const connected = JSON.parse(await powershell(['-File', helper, 'check', '--data-dir', bootstrap]));
    assert.equal(connected.connected, true); assert.equal(connected.serviceReady, true);
    const flat = await (await fetch(info.baseUrl + '/api/platform-skill?format=markdown')).text();
    assert.match(flat, /allow_implicit_invocation: false/); assert.match(flat, /revision_conflict/);
    const archive = await fetch(info.baseUrl + '/api/v1/skill'); assert.equal(archive.status, 200);
    const zip = path.join(run, 'skill.zip'); await fs.writeFile(zip, Buffer.from(await archive.arrayBuffer()));
    const listing = await powershell(['-File', helper, 'python', '-m', 'zipfile', '-l', zip, '--data-dir', bootstrap]);
    assert.match(listing, /mediasail\/SKILL.md/); assert.match(listing, /api-schema.json/);
    // Execute the shipped UTF-8 PowerShell example, without inventing another API client.
    const context = await fs.readFile(path.join(info.skillDir, 'references/context.md'), 'utf8');
    const snippet = context.match(/```powershell\s*([\s\S]*?)```/)[1];
    const script = path.join(run, '画像示例.ps1');
    await write(script, '\ufeff$ErrorActionPreference="Stop"\n[Console]::OutputEncoding=[Text.Encoding]::UTF8\n$info=Get-Content -LiteralPath $args[0] -Raw -Encoding UTF8 | ConvertFrom-Json\n' + snippet.replace("'测试画像'", "'合成画像'") + '\n');
    await powershell(['-File', script, path.join(bootstrap, 'agent-connection.json')]);
    const saved = await fs.readFile(path.join(info.profiles, '合成画像/memory.md'), 'utf8');
    assert.match(saved, /原运营经验/); assert.match(saved, /本次已核对的运营经验/);
    const output = path.join(info.outputs, 'Agent 成品'); await write(path.join(output, '报告.md'), '# 外部 Agent 成品');
    await powershell(['-File', helper, 'python', 'skills/shared/scripts/manifest.py', 'meta', '--topic', 'Agent 成品', '--title', '画像接入成品', '--category', 'analysis', '--kind', 'article', '--status', 'ready', '--deliverables', '报告.md', '--data-dir', bootstrap]);
    const projects = await (await fetch(info.baseUrl + '/api/outputs')).json();
    assert.equal(projects.find(project => project.name === 'Agent 成品').meta.category, 'analysis');
    const result = { passed: true, version: pkg.version, syntheticDataOnly: true, publications: 0, checks: ['live identity check via shipped helper', 'downloaded Skill package', 'explicit personal invocation metadata', 'shipped PowerShell revision example', 'manifest output visible in library'] };
    await write(path.join(root, 'docs/evidence/agent-profile-' + pkg.version + '.json'), JSON.stringify(result, null, 2));
    console.log('AGENT PROFILE PASSED');
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
