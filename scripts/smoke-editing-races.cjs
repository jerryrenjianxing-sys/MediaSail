// Focused regressions for delayed user-facing operations; synthetic library only.
'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json'), mode = process.argv[2] || 'ideas';
const run = path.join(os.homedir(), 'Documents', 'MediaSail 隔离验证', '编辑竞争 ' + mode + ' ' + Date.now());
let app, page, release = () => {};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (await fn()) return; await delay(100); } throw Error(label); }
async function write(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value)); }
(async () => {
  const executable = path.resolve(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe'), bootstrap = path.join(run, '定位'), libraryRoot = path.join(run, '资料库');
  const layout = await require('../desktop/library.cjs').chooseLibrary({ bootstrapRoot: bootstrap, targetRoot: libraryRoot, installDirectory: path.dirname(executable) });
  await write(path.join(layout.workspace, 'profiles/合成画像/identity.md'), '# original');
  await write(path.join(layout.workspace, 'profiles/合成画像/platforms.md'), '# existing platforms');
  await write(path.join(layout.dataRoot, 'ui-state.json'), { schema: 1, migration: { version: '0.3.3' }, values: { easel_onboarding_seen: '1', mediasail_selected_profile: '合成画像' } });
  let pending = false, fulfilled = false;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    app = await electron.launch({ executablePath: executable, env: { ...process.env, EASEL_DESKTOP_DATA: '', EASEL_LIBRARY_BOOTSTRAP: bootstrap, LOCALAPPDATA: path.join(run, 'Local'), APPDATA: path.join(run, 'Roaming') } });
    page = await app.firstWindow(); page.on('dialog', dialog => dialog.accept());
    await page.route('**/api/accounts/*/whoami*', route => route.fulfill({ json: { loggedIn: false, verificationStatus: 'unknown' } }));
    await page.route('**/api/trends*', route => route.fulfill({ json: { trends: [], updated: 0 } }));
    await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
    await page.getByRole('button', { name: '控制台', exact: true }).first().click();
    if (mode === 'ideas' || mode === 'calendar') {
      await page.getByRole('button', { name: mode === 'ideas' ? '记选题' : '排日历', exact: true }).click();
      if (mode === 'ideas') await page.getByRole('button', { name: '+ 新建选题', exact: true }).click();
      else await page.locator('.cal-cell').filter({ hasNot: page.locator('.cal-event') }).first().click();
      const title = page.getByPlaceholder(mode === 'ideas' ? '想做的内容 / 角度' : '要发什么内容'); await title.fill('正在提交的标题');
      await page.route('**/api/' + (mode === 'ideas' ? 'ideas' : 'schedule'), async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); pending = true; await gate; await route.fulfill({ response }); fulfilled = true; });
      await page.locator('.overlay').getByRole('button', { name: '保存', exact: true }).click();
      await until(() => pending, 'save response held');
      assert.equal(await title.isDisabled(), true, 'A pending save must prevent new input from being discarded on completion');
      release(); await until(() => fulfilled, 'save response released');
      await until(async () => await title.count() === 0, 'saved form closes');
    } else if (mode === 'credentials' || mode === 'sms') {
      await page.getByRole('button', { name: '账号', exact: true }).click();
      await page.route('**/api/login/xiaohongshu', route => route.fulfill({ json: mode === 'credentials' ? { mode: 'credentials' } : { mode: 'qr', state: 'sms_required' } }));
      await page.route('**/api/login/xiaohongshu/status', route => route.fulfill({ json: { state: 'sms_required' } }));
      await page.route('**/api/accounts/xiaohongshu/credentials', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { configured: false } });
        pending = true; await gate; await route.fulfill({ json: { ok: true } }); fulfilled = true;
      });
      await page.route('**/api/login/xiaohongshu/sms', async route => { pending = true; await gate; await route.fulfill({ json: { ok: true } }); fulfilled = true; });
      const account = page.locator('.account-card').filter({ has: page.locator('.account-card-name').getByText('小红书', { exact: true }) });
      await account.getByRole('button', { name: '登录', exact: true }).click();
      const input = page.getByPlaceholder(mode === 'credentials' ? 'wx...' : '短信验证码', { exact: true });
      await input.fill(mode === 'credentials' ? 'synthetic-app-id' : '123456');
      if (mode === 'credentials') await page.getByPlaceholder('开发者密钥（不会回显）').fill('synthetic-not-a-real-secret');
      await page.getByRole('button', { name: mode === 'credentials' ? '保存并验证' : '提交验证码', exact: true }).click();
      await until(() => pending, 'account response held');
      assert.equal(await input.isDisabled(), true, 'Pending account submission must lock its input');
      release(); await until(() => fulfilled, 'account response released');
    } else if (mode === 'wechat') {
      await page.getByRole('button', { name: '画像', exact: true }).click();
      await page.getByRole('button', { name: '✏️ 编辑资料', exact: true }).click();
      await page.route('**/api/analytics/wechat-oa', async route => { pending = true; await gate; await route.fulfill({ json: { verificationStatus: 'verified', accountId: 'synthetic-account', followers: 1234, posts: 8, reads: null, notes: [], metrics: [] } }); fulfilled = true; });
      await page.route('**/api/persona/*/file', async route => { await write(path.join(layout.workspace, 'profiles/合成画像/platforms.md'), '# Agent changed after collection'); await route.continue(); });
      const dimension = page.locator('.profile-dim').filter({ has: page.locator('.profile-dim-title').filter({ hasText: '平台运营' }) });
      await dimension.getByRole('button', { name: '📊 抓取公众号数据', exact: true }).click();
      await until(() => pending, 'analytics response held');
      assert.equal(await dimension.locator('textarea').isDisabled(), true, 'Collection must lock the dimension it will update');
      release(); await until(() => fulfilled, 'analytics response released');
      await until(async () => !(await dimension.locator('textarea').isDisabled()), 'collected draft released for reconciliation');
      assert.match(await dimension.locator('textarea').inputValue(), /1234/);
      assert.equal(await fs.readFile(path.join(layout.workspace, 'profiles/合成画像/platforms.md'), 'utf8'), '# Agent changed after collection');
      assert.match(await page.locator('.panel[role=status]').innerText(), /Agent changed after collection/);
    } else {
      await page.getByRole('button', { name: '画像', exact: true }).click();
      await page.getByRole('button', { name: '✏️ 编辑资料', exact: true }).click();
      await page.route('**/api/persona/*/files', async route => { const response = await route.fetch(); pending = true; await gate; await route.fulfill({ response }); fulfilled = true; });
      await page.getByRole('button', { name: '刷新', exact: true }).click();
      await until(() => pending, 'old profile response held');
      const text = page.locator('.profile-dim textarea').first(); await text.fill('# successful new save');
      await page.locator('.profile-dim').first().getByRole('button', { name: '保存', exact: true }).click();
      await page.locator('.profile-dim').first().getByRole('button', { name: '已保存', exact: true }).waitFor();
      release(); await until(() => fulfilled, 'old profile response released'); await delay(250);
      assert.equal(await text.inputValue(), '# successful new save', 'An older GET must not replace the newly saved text and revision');
    }
    const result = { mode, passed: true, version: pkg.version, syntheticDataOnly: true, publications: 0 };
    await write(path.join(run, 'result.json'), result);
    await write(path.join(root, 'docs/evidence', 'editing-race-' + mode + '-' + pkg.version + '.json'), result);
    console.log('EDITING RACE PASSED: ' + mode);
  } finally {
    release(); await delay(200);
    if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
