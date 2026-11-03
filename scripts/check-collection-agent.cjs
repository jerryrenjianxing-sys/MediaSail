// Observe an independent Agent's synthetic result through the packaged app.
'use strict';
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
let app;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

(async () => {
  const host = JSON.parse(await fs.readFile(path.join(root, '.test-data/collection-agent-host.json'), 'utf8'));
  assert.ok(host.run.includes('MediaSail 隔离验证'));
  assert.ok(host.libraryRoot.startsWith(host.run + path.sep));
  const executable = path.resolve(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe');
  const env = { ...process.env, EASEL_LIBRARY_BOOTSTRAP: host.bootstrap,
    LOCALAPPDATA: path.join(host.run, 'Local'), APPDATA: path.join(host.run, 'Roaming') };
  delete env.EASEL_DESKTOP_DATA;
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath: executable, env, timeout: 60000 });
  const page = await app.firstWindow();
  await page.route('**/api/accounts/*/whoami*', route => route.fulfill({ json: { loggedIn: false, verificationStatus: 'unknown' } }));
  await page.route('**/api/trends*', route => route.fulfill({ json: { trends: [], updated: 0 } }));
  await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
  const info = JSON.parse(await fs.readFile(path.join(host.data, 'agent-connection.json'), 'utf8'));
  const identity = await (await fetch(info.baseUrl + '/api/agent-info')).json();
  assert.equal(identity.instanceId, info.instanceId);
  assert.equal(identity.version, pkg.version);
  const name = '抖音近期作品分析-20261103';
  const project = path.join(info.outputs, name);
  const metadata = JSON.parse(await fs.readFile(path.join(project, '.easel.json'), 'utf8'));
  assert.equal(metadata.profile, host.persona);
  assert.equal(metadata.category, 'analysis');
  assert.equal(metadata.status, 'ready');
  assert.deepEqual(metadata.deliverables, ['抖音近期作品分析.md']);
  const outputs = await (await fetch(info.baseUrl + '/api/outputs')).json();
  const visible = outputs.find(item => item.name === name);
  assert.equal(visible.meta.category, 'analysis');
  assert.deepEqual(visible.meta.deliverablePaths, [name + '/抖音近期作品分析.md']);
  const report = await fs.readFile(path.join(project, metadata.deliverables[0]), 'utf8');
  const response = await fetch(info.baseUrl + '/api/output/' + [name, metadata.deliverables[0]].map(encodeURIComponent).join('/'));
  assert.ok(response.ok);
  const rendered = await response.json();
  assert.equal(rendered.content.replaceAll('\r\n', '\n'), report.replaceAll('\r\n', '\n'));
  assert.match(report, /2,700/);
  assert.match(report, /粉丝指数7不是粉丝7人|指数7不是粉丝7人/);
  const calculations = JSON.parse(await fs.readFile(path.join(project, 'assets/作品明细与计算.json'), 'utf8'));
  assert.equal(calculations.initial_coverage.returned, 6);
  assert.equal(calculations.supplemented_coverage.returned, 9);
  assert.equal(calculations.totals.views, 2700);
  assert.equal(calculations.unresolved.followers, null);
  const originals = [];
  for (const file of ['初次采集.json', '内容管理页.txt']) {
    const original = await fs.readFile(path.join(info.outputs, '抖音合成采集资料/assets', file));
    const retained = await fs.readFile(path.join(project, 'assets/原始证据', file));
    assert.deepEqual(original, retained);
    originals.push({ file, sha256: hash(original), bytes: original.length });
  }
  const agent = JSON.parse(await fs.readFile(path.join(project, 'assets/验收记录.json'), 'utf8'));
  assert.equal(agent.needsUserMoreInstructions, false);
  assert.equal(agent.boundaries.realSocialPlatformsAccessed, false);
  await page.getByRole('button', { name: '控制台', exact: true }).first().click();
  await page.locator('.sidebar-nav').getByRole('button', { name: '内容库', exact: true }).click();
  await page.getByText(metadata.title, { exact: true }).first().waitFor();
  const images = path.join(root, 'docs/images', pkg.version);
  await fs.mkdir(images, { recursive: true });
  await page.screenshot({ path: path.join(images, 'collection-agent.png'), animations: 'disabled' });
  const result = { passed: true, version: pkg.version, checkedAt: new Date().toISOString(),
    syntheticDataOnly: true, realPackagedUi: true, realLocalHttpApi: true,
    acceptanceScope: 'Independent Agent completed a read-only offline evidence supplement from local synthetic page snapshots, not a live platform collection.',
    projectVisible: true, reportMatchesFileApi: true, originals, agent };
  await fs.writeFile(path.join(root, 'docs/evidence/collection-agent-' + pkg.version + '.json'), JSON.stringify(result, null, 2));
  console.log('INDEPENDENT COLLECTION AGENT FILE/API/UI VERIFIED');
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (app) await app.close(); });
