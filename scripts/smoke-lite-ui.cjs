// Real packaged UI + real isolated local APIs. No installed profile, real account,
// platform login, publication, updater download, or installer is used here.
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const output = path.resolve(root, '../../outputs/MediaSail');
const executable = path.resolve(process.env.EASEL_TEST_EXE || path.join(output, 'release-' + version, 'win-unpacked/MediaSail.exe'));
const data = path.join(root, '.test-data', '轻量 UI 中文 空格 ' + version + ' ' + Date.now());
const evidence = path.resolve(process.env.EASEL_LITE_EVIDENCE || path.join(output, 'verification-' + version, 'lite-ui-' + Date.now()));
const forbidden = ['D:\\mediasail', path.join(process.env.LOCALAPPDATA || '', 'Programs/MediaSail')];
for (const directory of forbidden) {
  const base = path.resolve(directory).toLowerCase(), candidate = executable.toLowerCase();
  assert.ok(candidate !== base && !candidate.startsWith(base + path.sep), 'Refusing the daily installed MediaSail');
}
assert.ok(data.startsWith(path.join(root, '.test-data') + path.sep));
let app, page, info, clipboardSaved = false, occupied;
const checks = [], shots = [], errors = [], forbiddenRequests = [], buildResponses = [];
const oldPersona = '历史 画像 中文';
const newPersona = '新建 画像 测试';
const legacy = Array.from({ length: 125 }, (_, i) => ({ id: 'archived-' + i, title: '保留历史 ' + i, persona: oldPersona, created: i, messages: [{ role: 'user', content: '旧版历史正文 ' + i }] }));
const legacyText = JSON.stringify(legacy);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message, timeout = 15000) {
  const deadline = Date.now() + timeout; let last;
  do { try { if (await test()) return; } catch (e) { last = e; } await sleep(150); } while (Date.now() < deadline);
  throw new Error(message + (last ? ': ' + last.message : ''));
}
function record(name) { checks.push(name); console.log('LITE UI: ' + name); }
async function connection() { return JSON.parse(await fs.readFile(path.join(data, 'agent-connection.json'), 'utf8')); }
async function api(url, options) {
  const response = await fetch(info.baseUrl + url, options);
  const value = await response.json();
  assert.ok(response.ok, url + ': ' + JSON.stringify(value)); return value;
}
async function putFile(filename, content) {
  return api('/api/persona/' + encodeURIComponent(newPersona) + '/file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) });
}
async function state() { return page.evaluate(() => window.desktopUiState.call('load')); }
async function focus() { await sleep(650); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }
async function screenshot(name) {
  const file = path.join(evidence, name + '.png');
  await page.screenshot({ path: file, animations: 'disabled' }); shots.push(file);
}
async function theme(value) {
  if (await page.locator('html').getAttribute('data-theme') !== value) await page.locator('.skill-header .skill-theme').click();
  await until(async () => await page.locator('html').getAttribute('data-theme') === value, 'Expected theme ' + value);
  await until(() => page.locator('.skill-theme-transition').evaluateAll(rows => rows.every(row => getComputedStyle(row).display === 'none' || Number(getComputedStyle(row).opacity) === 0)), 'Theme animation settles');
}
async function backupClipboard() {
  await app.evaluate(async ({ clipboard, ClipboardItem }) => {
    const items = await clipboard.read();
    globalThis.__mediaSailLiteClipboard = await Promise.all(items.map(async item => {
      const formats = {};
      for (const type of item.types) { const value = await item.getType(type); formats[type] = type === 'electron application/bookmark' ? value : new Blob([await value.arrayBuffer()], { type: value.type }); }
      return new ClipboardItem(formats);
    }));
  }); clipboardSaved = true;
}
async function closeApp() {
  if (!app) return;
  if (clipboardSaved) {
    await app.evaluate(async ({ clipboard }) => { const items = globalThis.__mediaSailLiteClipboard; if (items?.length) await clipboard.write(items); else clipboard.clear(); delete globalThis.__mediaSailLiteClipboard; });
    clipboardSaved = false;
  }
  await app.close(); app = null;
}
async function launch() {
  const env = { ...process.env, EASEL_DESKTOP_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath: executable, args: [], env, timeout: 60000 });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const name = new URL(request.url()).pathname;
    if (/^\/api\/(chat(?:\/|$)|agent(?:\/|$)|skill$|settings\/(?:models|local-agents)|env\/(?:tools|install|job))/.test(name) || /^\/api\/profile\/build\/status\//.test(name)) forbiddenRequests.push({ method: request.method(), path: name });
  });
  page.on('response', response => { if (new URL(response.url()).pathname === '/api/profile/build') void response.json().then(value => buildResponses.push(value)); });
  await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
  await page.locator('.skill-home').waitFor({ timeout: 30000 });
  await until(async () => (await connection()).status === 'ready', 'Local service ready', 30000);
  info = await connection();
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), version);
  assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), data);
  assert.equal(info.node, null);
  assert.equal((await api('/api/status')).gateway, false);
  assert.equal(await page.locator('.sidebar').count(), 0);
  return page;
}
async function helper(args) {
  const filename = path.join(info.skillDir, 'scripts/mediasail.ps1');
  const result = cp.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', filename, ...args, '--data-dir', data], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, (result.stdout || '') + '\n' + (result.stderr || '')); return result.stdout;
}
(async () => {
  await fs.access(executable); await fs.mkdir(evidence, { recursive: true });
  const profileDir = path.join(data, 'workspace/profiles', oldPersona); await fs.mkdir(profileDir, { recursive: true });
  for (const filename of ['identity.md', 'style.md', 'audience.md', 'platforms.md', 'preferences.md', 'memory.md']) await fs.writeFile(path.join(profileDir, filename), '# 升级保留\n' + filename, 'utf8');
  await fs.writeFile(path.join(data, 'ui-state.json'), JSON.stringify({ schema: 1, migration: { version: '0.3.3', sessions: 125, copies: 0, sources: [] }, values: { easel_sessions: legacyText, easel_active_session: legacy[124].id, easel_theme: 'light', easel_onboarding_seen: '1' } }));
  try {
    await launch();
    await theme('light'); await screenshot('0.5.0-home-light');
    await theme('dark'); await screenshot('0.5.0-home-dark'); await theme('light');
    record('Actual packaged Agent home and existing animated light/dark themes');
    await backupClipboard(); await page.getByRole('button', { name: '复制 Skill', exact: true }).click();
    await page.getByRole('button', { name: '已复制', exact: true }).waitFor();
    assert.ok((await app.evaluate(({ clipboard }) => clipboard.readText())).includes(data));
    record('Actual connection Skill copied; original clipboard backed up for restoration');
    await page.getByRole('button', { name: '控制台', exact: true }).click();
    await page.locator('.sidebar-status').filter({ hasText: '本地服务已连接' }).waitFor();
    await until(async () => await page.locator('.persona-select').inputValue() === oldPersona, 'One-time legacy profile selection');
    assert.equal((await state()).values.easel_sessions, legacyText);
    assert.equal(await page.locator('.sidebar-nav').getByRole('button', { name: '对话', exact: true }).count(), 0);
    assert.equal(await page.locator('.session-item').count(), 0);
    record('125 old sessions untouched; independent profile migrated; no chat navigation or new session');
    await page.locator('.persona-select').selectOption('__new__');
    await page.getByPlaceholder('如：科技数码达人').fill(newPersona);
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByPlaceholder('如：平价护肤测评').fill('轻量版运营画像验收');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByRole('button', { name: '生成画像', exact: true }).click();
    await page.locator('.profile-head .page-title').filter({ hasText: newPersona }).waitFor();
    await until(() => buildResponses.some(value => value.created && value.async === false && value.status === 'baseline-ready'), 'Synchronous baseline response');
    await until(async () => (await connection()).selectedProfile === newPersona, 'Descriptor selectedProfile synchronized');
    assert.equal((await state()).values.mediasail_selected_profile, newPersona);
    record('Real onboarding creates six-dimensional baseline without AI polling; selection persisted and discoverable');
    await putFile('identity.md', '# 外部 Agent 已更新定位\n真实 API 写入'); await focus();
    await page.getByText('外部 Agent 已更新定位', { exact: true }).waitFor();
    await page.getByRole('button', { name: '✏️ 编辑资料', exact: true }).click();
    const dimension = page.locator('.profile-dim').filter({ hasText: '身份定位' }).first();
    const field = dimension.locator('textarea'); await field.fill('尚未保存的人工编辑');
    await putFile('identity.md', '# 另一位 Agent 的最新定位'); await focus();
    await page.getByText('画像已有外部更新。当前未保存编辑已保留；保存时会再次核对冲突。', { exact: true }).waitFor();
    assert.equal(await field.inputValue(), '尚未保存的人工编辑');
    page.once('dialog', dialog => dialog.dismiss()); await dimension.getByRole('button', { name: '保存', exact: true }).click();
    assert.equal(await field.inputValue(), '尚未保存的人工编辑');
    assert.equal((await api('/api/persona/' + encodeURIComponent(newPersona) + '/files')).files.find(file => file.filename === 'identity.md').content, '# 另一位 Agent 的最新定位');
    await screenshot('0.5.0-profile-conflict-protected');
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '放弃当前编辑并载入最新资料', exact: true }).click();
    assert.equal(await field.inputValue(), '# 另一位 Agent 的最新定位');
    await screenshot('0.5.0-profile-updated');
    record('External API edits visible on focus; dirty edits protected; conflict cancellation and explicit reload work');
    const project = '外部 Agent 成品 中文'; await fs.mkdir(path.join(info.outputs, project), { recursive: true });
    await fs.writeFile(path.join(info.outputs, project, '成品.md'), '# 完成的运营内容\n由外部创作后回存。', 'utf8');
    await helper(['python', 'skills/shared/scripts/manifest.py', 'meta', '--topic', project, '--title', '外部 Agent 回存验收', '--kind', 'article', '--status', 'ready', '--deliverables', '成品.md']);
    await page.locator('.sidebar-nav').getByRole('button', { name: '内容库', exact: true }).click();
    await page.getByText('外部 Agent 回存验收', { exact: true }).first().waitFor(); await screenshot('0.5.0-content-library');
    record('Real manifest helper registration visible in original content library');
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '历史存档', exact: true }).click();
    await page.getByRole('button', { name: '打开历史存档目录', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '导出聊天 JSON（125 条）', exact: true }).count(), 1);
    assert.equal(await page.locator('#history-session').count(), 0);
    await page.locator('.settings-nav').getByRole('button', { name: '软件更新', exact: true }).click();
    await until(async () => await page.getByTestId('update-current-version').innerText() === version, 'Settings version');
    await screenshot('0.5.0-settings-updates');
    assert.equal(await page.getByRole('button', { name: '模型配置', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '环境安装', exact: true }).count(), 0);
    await page.locator('.settings-close').click();
    record('Settings keeps updates and archive-directory/export entry; no chat reader/model/environment pages');
    await page.locator('.sidebar-nav').getByRole('button', { name: '工作台', exact: true }).click();
    await page.getByRole('button', { name: '去发布', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '一键适配各平台', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '发布前预检', exact: true }).count(), 0);
    await page.getByRole('button', { name: '一键发布', exact: true }).waitFor();
    assert.deepEqual(forbiddenRequests, []);
    record('Core publishing UI remains; no internal chat/model/skill-execution requests');
    const firstUrl = info.baseUrl; await closeApp();
    assert.equal((await connection()).status, 'stopped');
    occupied = http.createServer((_request, response) => { response.writeHead(404); response.end('Independent test-owned port occupant'); });
    await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(Number(new URL(firstUrl).port), '127.0.0.1', resolve); });
    await launch(); assert.notEqual(info.baseUrl, firstUrl);
    await page.getByRole('button', { name: '控制台', exact: true }).click();
    await until(async () => await page.locator('.persona-select').inputValue() === newPersona, 'Persisted independent selection');
    await until(async () => (await connection()).selectedProfile === newPersona, 'Restart descriptor selection');
    assert.equal((await state()).values.easel_sessions, legacyText);
    await page.locator('.sidebar-nav').getByRole('button', { name: '画像', exact: true }).click();
    await page.getByText('另一位 Agent 的最新定位', { exact: true }).waitFor();
    assert.deepEqual(forbiddenRequests, []); assert.deepEqual(errors, []);
    record('Real restart onto different local port retains independent selection, profile changes and all 125 historical sessions');
    await closeApp();
    await fs.writeFile(path.join(evidence, 'lite-ui-result.json'), JSON.stringify({ passed: true, version, executable, data, testedAt: new Date().toISOString(), firstUrl, secondUrl: info.baseUrl, checks, screenshots: shots, forbiddenRequests, errors, buildResponses, usesRealPackagedApplication: true, usesRealLocalBusinessApis: true, realPlatformAccountsUsed: false, clipboardRestored: !clipboardSaved, notes: ['Fresh isolated test data; old history fixture is synthetic, not a full installer upgrade.', 'No installer, download-speed benchmark, real publication, or AitoEarn account test is performed.'] }, null, 2));
    console.log('PACKAGED LITE UI PASSED: ' + path.join(evidence, 'lite-ui-result.json'));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, 'failure.png'), animations: 'disabled' }).catch(() => {});
    await fs.writeFile(path.join(evidence, 'lite-ui-result.json'), JSON.stringify({ passed: false, version, executable, data, checks, screenshots: shots, forbiddenRequests, errors, error: error.stack }, null, 2)); throw error;
  } finally {
    await closeApp();
    if (occupied) { occupied.closeAllConnections(); await new Promise(resolve => occupied.close(resolve)); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
