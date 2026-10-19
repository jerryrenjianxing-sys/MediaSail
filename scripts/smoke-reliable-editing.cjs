// Real packaged renderer, synthetic files, independent bootstrap and library.
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
let app, page, cleanup = false;
const result = { version: pkg.version, passed: false, checks: [], run, executable };
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8'); };
(async () => {
  assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'), 'Daily installation cannot be tested');
  const layout = await require('../desktop/library.cjs').chooseLibrary({ bootstrapRoot: bootstrap, targetRoot: libraryRoot, installDirectory: path.dirname(executable) });
  await write(path.join(layout.workspace, 'profiles', '合成测试画像', 'identity.md'), '# 合成身份\n原始定位');
  await write(path.join(layout.dataRoot, 'ui-state.json'), { schema: 1, migration: { version: '0.3.3' }, values: { easel_onboarding_seen: '1', mediasail_selected_profile: '合成测试画像', easel_theme: 'light' } });
  const env = { ...process.env, EASEL_LIBRARY_BOOTSTRAP: bootstrap, LOCALAPPDATA: path.join(run, '独立Local'), APPDATA: path.join(run, '独立Roaming') };
  delete env.EASEL_DESKTOP_DATA; delete env.ELECTRON_RUN_AS_NODE;
  try {
    app = await electron.launch({ executablePath: executable, env, timeout: 60000 }); page = await app.firstWindow();
    await page.waitForURL('http://127.0.0.1:*/', { timeout: 180000 });
    await page.route('**/api/accounts/*/whoami*', route => route.fulfill({ json: { loggedIn: false, verificationStatus: 'unknown', errorCode: 'SYNTHETIC', message: '隔离界面验收' } }));
    await page.route('**/api/trends*', route => route.fulfill({ json: { trends: [], updated: 0 } }));
    await page.getByRole('button', { name: '控制台', exact: true }).first().click();
    await page.getByRole('button', { name: '画像', exact: true }).click();
    await page.getByRole('button', { name: '✏️ 编辑资料', exact: true }).click();
    const text = page.locator('.profile-dim textarea').first(); await text.fill('# 用户尚未保存的定位');
    let dialogs = 0;
    page.on('dialog', async dialog => { dialogs++; if (cleanup) await dialog.accept(); else await dialog.dismiss(); });
    await page.getByRole('button', { name: '内容库', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(dialogs, 1, 'Leaving an edited profile must ask before discarding');
    assert.equal(await text.inputValue(), '# 用户尚未保存的定位', 'Cancelled leave preserves the draft');
    result.checks.push('cancelled profile navigation retains draft');
    result.passed = true;
  } finally {
    await write(path.join(run, 'result.json'), result);
    if (app) { cleanup = true; await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
    console.log(JSON.stringify(result));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
