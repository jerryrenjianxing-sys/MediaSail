// Packaged UI behavior. All files, accounts and platform responses are synthetic.
'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json');
const executable = path.resolve(process.env.EASEL_TEST_EXE || path.join(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe'));
const run = path.join(os.homedir(), 'Documents', 'MediaSail 隔离验证', '可靠编辑 ' + pkg.version + ' ' + Date.now());
const bootstrap = path.join(run, '独立定位'), libraryRoot = path.join(run, '中文 空格资料库');
const evidence = path.join(root, 'docs/images', pkg.version), resultFile = path.join(root, 'docs/evidence', 'reliable-editing-' + pkg.version + '.json');
const result = { version: pkg.version, passed: false, checks: [], screenshots: [], run, executable, syntheticDataOnly: true, publications: 0 };
let app, page, info, decision = false, ended = false, cleanup = false;
const dialogs = [], errors = [];
const choices = [];
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8'); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) { const deadline = Date.now() + timeout; let last; while (Date.now() < deadline) { try { if (await check()) return; } catch (error) { last = error; } await delay(100); } throw Error(label + (last ? ': ' + last.message : '')); }
function record(name) { result.checks.push(name); console.log('RELIABLE EDITING: ' + name); }
async function shot(name) { await fs.mkdir(evidence, { recursive: true }); await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' }); result.screenshots.push(name + '.png'); }
async function api(url, body, method = 'PUT') { const response = await fetch(info.baseUrl + url, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; }
const nav = name => page.locator('.sidebar-nav').getByRole('button', { name, exact: true }).click();
const firstText = () => page.locator('.profile-dim textarea').first();
const firstSave = () => page.locator('.profile-dim').first().getByRole('button', { name: '保存', exact: true });
async function discardTo(name) { decision = true; await nav(name); await delay(150); decision = false; }
async function closeForm(button, field, value) { decision = false; const count = dialogs.length; await button.click(); await until(() => dialogs.length === count + 1, 'close asks once'); assert.equal(await field.inputValue(), value); choices.push(true); await button.click(); await until(() => dialogs.length === count + 2, 'explicit discard asks once'); }
async function start() {
  const env = { ...process.env, EASEL_LIBRARY_BOOTSTRAP: bootstrap, LOCALAPPDATA: path.join(run, '独立Local'), APPDATA: path.join(run, '独立Roaming') };
  delete env.EASEL_DESKTOP_DATA; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath: executable, env, timeout: 60000, recordVideo: { dir: path.join(run, 'video'), size: { width: 1280, height: 800 } } });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { const accepted = cleanup || dialog.type() === 'alert' || (choices.length ? choices.shift() : decision); dialogs.push({ type: dialog.type(), message: dialog.message(), accepted }); if (accepted) await dialog.accept(); else await dialog.dismiss(); });
  await page.route('**/api/accounts/*/whoami*', route => route.fulfill({ json: { loggedIn: false, verificationStatus: 'unknown', errorCode: 'SYNTHETIC', message: '隔离界面验收' } }));
  await page.route('**/api/trends*', route => route.fulfill({ json: { trends: [], updated: 0 } }));
  await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
  info = JSON.parse(await fs.readFile(path.join(libraryRoot, 'runtime/agent-connection.json'), 'utf8'));
  await page.getByRole('button', { name: '控制台', exact: true }).first().click();
}
(async () => {
  assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'), 'Daily installation cannot be tested');
  const layout = await require('../desktop/library.cjs').chooseLibrary({ bootstrapRoot: bootstrap, targetRoot: libraryRoot, installDirectory: path.dirname(executable) });
  for (const name of ['合成测试画像', '另一个画像']) await write(path.join(layout.workspace, 'profiles', name, 'identity.md'), '# 合成身份\n原始定位');
  const project = '可靠编辑 合成项目';
  await write(path.join(layout.workspace, 'outputs', project, '.easel.json'), { title: '可靠编辑项目', category: 'analysis', kind: 'article', custom: { retained: true }, deliverables: ['报告.md'], steps: [] });
  await write(path.join(layout.workspace, 'outputs', project, '报告.md'), '# 合成报告');
  await write(path.join(layout.dataRoot, 'ui-state.json'), { schema: 1, migration: { version: '0.3.3' }, values: { easel_onboarding_seen: '1', mediasail_selected_profile: '合成测试画像', easel_theme: 'light' } });
  try {
    await start(); await nav('画像');
    await page.getByRole('button', { name: '✏️ 编辑资料', exact: true }).click();
    const text = firstText(); await text.fill('# 用户尚未保存的定位');
    let count = dialogs.length; await nav('内容库'); await until(() => dialogs.length === count + 1, 'profile navigation asks once');
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    await page.locator('.persona-select').selectOption('另一个画像'); await delay(150);
    assert.equal(await page.locator('.persona-select').inputValue(), '合成测试画像');
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    record('cancelled page and profile changes preserve the draft');

    await page.getByTitle('设置', { exact: true }).click(); await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '更换资料库', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '先保存或取消' }).waitFor();
    assert.equal(JSON.parse(await fs.readFile(path.join(bootstrap, 'library-location.json'), 'utf8')).libraryRoot, libraryRoot);
    await page.locator('.settings-close').click(); assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    const updatesWindow = app.waitForEvent('window'); count = dialogs.length;
    await page.getByTitle('从 GitHub 检查和下载 MediaSail 新版').click();
    const panel = await updatesWindow; await panel.waitForLoadState(); assert.equal(dialogs.length, count);
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位'); await panel.close();
    record('library change refuses dirty edits; opening updates preserves edits without a discard prompt');

    count = dialogs.length;
    await app.evaluate(({ app }) => { app.quit(); app.quit(); return true; });
    await until(() => dialogs.length === count + 1, 'normal quit asks once');
    assert.equal(app.process().exitCode, null); assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    assert.equal(await page.locator('body').evaluate(body => body.inert), false);
    record('cancelled real quit preserves edits and rapid quit requests do not duplicate prompts');

    count = dialogs.length;
    const hidden = await app.evaluate(({ BrowserWindow }) => { const main = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('http://127.0.0.1:')); main.close(); return !main.isVisible(); });
    assert.equal(hidden, true); assert.equal(dialogs.length, count);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('http://127.0.0.1:')).show());
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    record('close to tray and restore retain the draft without an extra confirmation');

    // Replace only the third-party updater Adapter. Real installation is tested
    // separately on hosted Windows with the original NSIS executable.
    await app.evaluate(({ app }, future) => {
      const require = process.getBuiltinModule('node:module').createRequire(app.getAppPath() + '/package.json');
      const { NsisUpdater } = require('electron-updater');
      globalThis.__reliableUpdateFixture = { checks: 0, downloads: 0, installs: 0 };
      NsisUpdater.prototype.checkForUpdates = async function () { globalThis.__reliableUpdateFixture.checks++; this.emit('checking-for-update'); this.emit('update-available', { version: future, files: [{ size: 1 }] }); return null; };
      NsisUpdater.prototype.downloadUpdate = async function () { globalThis.__reliableUpdateFixture.downloads++; this.emit('update-downloaded', { version: future }); return []; };
      NsisUpdater.prototype.quitAndInstall = function () { globalThis.__reliableUpdateFixture.installs++; this.emit('error', new Error('synthetic installer launch failure')); };
    }, pkg.version.split('.').map((value, index) => index === 2 ? Number(value) + 1 : value).join('.'));
    const updatePanelReady = app.waitForEvent('window'); await page.getByTitle('从 GitHub 检查和下载 MediaSail 新版').click();
    const updatePanel = await updatePanelReady; await updatePanel.locator('#check').click();
    await updatePanel.locator('#download').waitFor({ state: 'visible' });
    assert.equal(await app.evaluate(() => globalThis.__reliableUpdateFixture.downloads), 0);
    await updatePanel.locator('#download').click(); await updatePanel.locator('#install').waitFor({ state: 'visible' });
    count = dialogs.length; await updatePanel.locator('#install').click(); await until(() => dialogs.length === count + 1, 'install asks before discarding edits');
    assert.equal(await app.evaluate(() => globalThis.__reliableUpdateFixture.installs), 0);
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位'); await updatePanel.close();
    await page.getByRole('button', { name: '关闭更新提示，本次运行不再提醒', exact: true }).click();
    result.updateAdapter = 'synthetic third-party SDK; no actual installer or download';
    record('update window shares edit protection; cancelled install never calls the installer Adapter');

    const identity = path.join(info.profiles, '合成测试画像/identity.md');
    await write(identity, '# Agent 最新定位');
    await firstSave().click();
    await page.getByText('最新内容：身份定位', { exact: true }).waitFor();
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    assert.equal((await api('/api/persona/' + encodeURIComponent('合成测试画像') + '/files')).files[0].content, '# Agent 最新定位');
    await shot('reliable-profile-light');
    let changeAgain = true;
    await page.route('**/api/persona/*/file', async route => { if (route.request().method() === 'PUT' && changeAgain) { changeAgain = false; await write(identity, '# Agent 再次修改'); } await route.continue(); });
    choices.push(true); await firstSave().click();
    await page.getByText('# Agent 再次修改', { exact: true }).waitFor();
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位');
    await page.locator('.sidebar-header button').first().click(); await delay(1100);
    await shot('reliable-profile-dark');
    record('profile conflict preserves draft, displays latest content and rejects a second external change');

    await text.fill('# 用户与 Agent 合并后的定位'); choices.push(true); await firstSave().click();
    await until(async () => (await api('/api/persona/' + encodeURIComponent('合成测试画像') + '/files')).files[0].content === '# 用户与 Agent 合并后的定位', 'reviewed version saved');
    await page.locator('.profile-dim').first().getByRole('button', { name: '已保存', exact: true }).waitFor();
    await nav('工作台'); await page.getByRole('button', { name: '记选题', exact: true }).click();
    await page.getByRole('button', { name: '+ 新建选题', exact: true }).click();
    count = dialogs.length; await page.locator('.overlay').getByRole('button', { name: '取消', exact: true }).click(); assert.equal(dialogs.length, count);
    await page.getByRole('button', { name: '+ 新建选题', exact: true }).click();
    const ideaField = page.getByPlaceholder('想做的内容 / 角度', { exact: true }); await ideaField.fill('尚未保存的选题');
    await closeForm(page.locator('.overlay').getByRole('button', { name: '取消', exact: true }), ideaField, '尚未保存的选题');
    await until(async () => await ideaField.count() === 0, 'idea closed after discard');
    record('clean idea closes silently; cancelled dirty close preserves its fields');

    await page.getByRole('button', { name: '内容日历', exact: true }).click();
    await page.locator('.cal-cell').filter({ hasNot: page.locator('.cal-event') }).first().click();
    const calendarField = page.locator('.overlay input').first(); await calendarField.fill('未保存的排期');
    await closeForm(page.locator('.overlay').getByRole('button', { name: '取消', exact: true }), calendarField, '未保存的排期');
    record('calendar close uses the same cancellation protection');

    await page.locator('.persona-select').selectOption('__new__');
    const wizardField = page.getByPlaceholder('如：科技数码达人'); await wizardField.fill('未完成的画像');
    await closeForm(page.locator('.overlay').getByRole('button', { name: '×', exact: true }), wizardField, '未完成的画像');
    record('initial profile wizard retains inputs after cancelling close');

    await nav('内容库');
    await page.getByRole('button', { name: '编辑归档信息', exact: true }).first().click();
    const editor = page.getByRole('dialog', { name: '编辑归档信息', exact: true }), title = editor.getByLabel('标题', { exact: true });
    await title.fill('尚未保存的归档标题');
    await closeForm(editor.getByRole('button', { name: '取消', exact: true }), title, '尚未保存的归档标题');
    assert.equal((await api('/api/projects/' + encodeURIComponent(project) + '/metadata')).metadata.title, '可靠编辑项目');
    record('metadata cancellation retains fields and explicit discard does not modify the project');

    await nav('账号');
    await page.route('**/api/login/xiaohongshu', route => route.fulfill({ json: { mode: 'credentials' } }));
    await page.route('**/api/accounts/xiaohongshu/credentials', route => route.fulfill({ json: { configured: false } }));
    const account = page.locator('.account-card').filter({ has: page.locator('.account-card-name').getByText('小红书', { exact: true }) });
    await account.getByRole('button', { name: '登录', exact: true }).click();
    const credential = page.getByPlaceholder('wx...', { exact: true }); await credential.fill('synthetic-app-id');
    await closeForm(page.locator('.overlay').getByRole('button', { name: '关闭', exact: true }), credential, 'synthetic-app-id');
    await page.route('**/api/login/douyin', route => route.fulfill({ json: { mode: 'qr', state: 'sms_required', message: '合成验证码场景' } }));
    await page.route('**/api/login/douyin/status', route => route.fulfill({ json: { state: 'sms_required', message: '合成验证码场景' } }));
    const douyin = page.locator('.account-card').filter({ has: page.locator('.account-card-name').getByText('抖音', { exact: true }) });
    await douyin.getByRole('button', { name: '登录', exact: true }).click();
    const sms = page.getByPlaceholder('短信验证码'); await sms.fill('123456');
    await closeForm(page.locator('.overlay').getByRole('button', { name: '关闭', exact: true }), sms, '123456');
    record('synthetic account credentials and SMS close preserve entered values when cancelled');

    await nav('工作台'); await page.getByRole('button', { name: '去发布', exact: true }).click();
    const publishBody = page.locator('textarea').first(); await publishBody.fill('合成持久草稿，不公开发布');
    await nav('画像'); await nav('工作台'); await page.getByRole('button', { name: '去发布', exact: true }).click();
    assert.equal(await publishBody.inputValue(), '合成持久草稿，不公开发布');
    await nav('内容库'); await delay(300);
    record('native publishing draft survives page changes without a redundant discard prompt');

    const oldInstance = info.instanceId;
    const retryPanelReady = app.waitForEvent('window'); await page.getByTitle('从 GitHub 检查和下载 MediaSail 新版').click();
    const retryPanel = await retryPanelReady; await retryPanel.locator('#install').click();
    await until(async () => {
      const current = JSON.parse(await fs.readFile(path.join(libraryRoot, 'runtime/agent-connection.json'), 'utf8'));
      if (current.instanceId !== oldInstance && current.status === 'ready') { info = current; return true; }
      return false;
    }, 'services recover after the installer Adapter rejects launch', 180000);
    await page.locator('.skill-home').waitFor();
    assert.equal(await page.locator('body').evaluate(body => body.inert), false);
    assert.equal(await app.evaluate(() => globalThis.__reliableUpdateFixture.installs), 1);
    await retryPanel.close();
    record('rejected installer launch restores local services and an interactive main page');
    result.video = await page.video().path();
    const video = page.video(); cleanup = true;
    await app.close(); ended = true;
    await fs.mkdir(evidence, { recursive: true }); await video.saveAs(path.join(evidence, 'reliable-editing.webm'));
    result.video = 'reliable-editing.webm';
    const stored = JSON.parse(await fs.readFile(path.join(info.dataDir, 'ui-state.json'), 'utf8'));
    assert.equal(JSON.parse(stored.values.easel_publish_draft).body, '合成持久草稿，不公开发布');
    assert.deepEqual(errors, []);
    result.passed = true;
  } catch (error) {
    result.error = error.stack || String(error);
    if (page && !page.isClosed()) await shot('reliable-failure').catch(() => {});
    throw error;
  } finally {
    if (app && !ended) { cleanup = true; await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
    result.dialogs = dialogs; result.rendererErrors = errors;
    await write(path.join(run, 'result.json'), result); await write(resultFile, result);
    console.log(JSON.stringify(result));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
