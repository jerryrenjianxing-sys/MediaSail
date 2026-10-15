// Isolated packaged UI acceptance. Never installs, publishes, or uses real accounts.
// Screenshots labelled 125/150 percent use Electron page zoom, not Windows DPI.
const {_electron: electron} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../../outputs/MediaSail');
const version = require('../package.json').version;
const parts = version.split('.').map(Number);
const futureVersion = [parts[0], parts[1], parts[2] + 1].join('.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidence = path.resolve(process.env.EASEL_HOME_EVIDENCE || path.join(output, 'home-preview-2026-10-15', 'evidence', stamp));
const data = path.join(root, '.test-data', '首页 中文 空格 ' + version + ' ' + Date.now());
const executable = path.resolve(process.env.EASEL_TEST_EXE || path.join(output, 'win-unpacked', 'MediaSail.exe'));
const forbidden = [
  'D:\\mediasail',
  path.join(process.env.LOCALAPPDATA || 'C:\\Users\\jerry\\AppData\\Local', 'Programs', 'MediaSail'),
];
for (const directory of forbidden) {
  const candidate = executable.toLowerCase(), blocked = path.resolve(directory).toLowerCase();
  assert.ok(candidate !== blocked && !candidate.startsWith(blocked + path.sep), 'Refusing the daily installed MediaSail: ' + executable);
}
assert.ok(fs.existsSync(executable), 'Build the disposable packaged application first: ' + executable);
assert.ok(data.startsWith(path.join(root, '.test-data') + path.sep));
fs.mkdirSync(evidence, {recursive: true});

const checks = [], screenshots = [], failures = [], phases = [];
let metadataRequests = 0, installerRequests = 0, app, page, video, clipboardSaved = false;
let feed;
const server = http.createServer((request, response) => {
  if (request.url.startsWith('/latest.yml')) {
    metadataRequests++;
    response.setHeader('content-type', 'text/yaml');
    response.end('version: ' + futureVersion + '\nfiles:\n  - url: MediaSail-home-fixture.exe\n    sha512: ' + Buffer.alloc(64).toString('base64') + '\n    size: 1\npath: MediaSail-home-fixture.exe\nsha512: ' + Buffer.alloc(64).toString('base64') + "\nreleaseDate: '2026-10-15T00:00:00.000Z'\n");
    return;
  }
  installerRequests++;
  response.writeHead(404);
  response.end('No installer exists in this UI-only fixture.');
});
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function phase(name) { phases.push({name, at: new Date().toISOString()}); console.log('HOME ACCEPTANCE: ' + name); }
async function until(predicate, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    try { if (await predicate()) return; } catch (error) { last = error; }
    await sleep(100);
  } while (Date.now() < deadline);
  throw new Error(message + (last ? ': ' + last.message : ''));
}
const home = () => page.locator('.skill-home');
const primary = () => page.getByRole('button', {name: '控制台', exact: true});
const returnHome = () => page.locator('.sidebar-nav').getByRole('button', {name: '连接 Agent', exact: true});
const themeButton = () => page.locator('.skill-header .skill-theme');
const currentTheme = () => page.locator('html').getAttribute('data-theme');
async function waitTheme(theme) {
  await until(async () => await currentTheme() === theme, 'Expected ' + theme + ' theme');
  await until(() => page.locator('.skill-theme-transition').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none' || Number(getComputedStyle(element).opacity) === 0)), 'Theme overlay must settle');
}
async function setTheme(theme) {
  if (await currentTheme() !== theme) await themeButton().click();
  await waitTheme(theme);
}
async function state() { return page.evaluate(() => window.desktopUiState.call('load')); }
async function flush() { await page.evaluate(() => window.desktopUiState.call('flush')); }
async function resize(width, height, zoom = 1) {
  await app.evaluate(({BrowserWindow}, input) => {
    const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http://127.0.0.1:'));
    window.setContentSize(input.width, input.height);
    window.webContents.setZoomFactor(input.zoom);
  }, {width, height, zoom});
  await sleep(250);
}
async function screenshot(name) {
  const filename = path.join(evidence, name + '.png');
  await page.screenshot({path: filename, fullPage: false, animations: 'disabled'});
  const dimensions = await page.evaluate(() => ({width: innerWidth, height: innerHeight, devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth}));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 2, name + ': no horizontal overflow');
  screenshots.push({file: path.basename(filename), ...dimensions});
}
async function assertHome() {
  await home().waitFor();
  assert.equal(await page.locator('.sidebar').count(), 0, 'Agent-first home must not render the console sidebar');
  assert.equal(await page.getByRole('button', {name: '先用通用模式', exact: true}).count(), 0, 'First-use recommendation must not cover the home');
  assert.equal(await primary().count(), 1);
  assert.equal(await page.getByRole('button', {name: '控制台 →', exact: true}).count(), 1);
  assert.equal(await page.getByRole('button', {name: /^(复制 Skill|已复制)$/}).count(), 1);
  const bounds = await home().boundingBox();
  const viewport = await page.evaluate(() => ({width: document.querySelector('.page-host')?.clientWidth || document.documentElement.clientWidth, height: innerHeight}));
  assert.ok(bounds && bounds.x <= 1 && bounds.width >= viewport.width - 2, 'Home occupies the complete content width excluding its normal vertical scrollbar');
  assert.ok(await themeButton().isVisible());
  assert.match(await themeButton().getAttribute('aria-label'), /^切换到(浅色|深色)主题$/);
}
async function launch({record = false, colorScheme = 'light'} = {}) {
  const environment = {...process.env, EASEL_DESKTOP_DATA: data};
  delete environment.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: executable, args: [], env: environment, timeout: 30000, colorScheme,
    ...(record ? {recordVideo: {dir: path.join(evidence, 'raw-video'), size: {width: 1440, height: 900}}} : {}),
  });
  await app.evaluate(({app}, input) => {
    const requireApp = process.getBuiltinModule('node:module').createRequire(app.getAppPath() + '/package.json');
    const updater = requireApp('electron-updater').autoUpdater;
    updater.setFeedURL({provider: 'generic', url: input.feed});
    Object.defineProperty(updater.app, 'baseCachePath', {get: () => input.data});
  }, {feed, data});
  page = await app.firstWindow();
  page.on('pageerror', error => failures.push({at: new Date().toISOString(), message: error.message}));
  video = record ? page.video() : null;
  await page.waitForURL('http://127.0.0.1:*/', {timeout: 240000});
  await home().waitFor({timeout: 30000});
  await until(() => {
    const file = path.join(data, 'agent-connection.json');
    return fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).status === 'ready';
  }, 'Real local backend must be ready', 240000);
  const info = JSON.parse(fs.readFileSync(path.join(data, 'agent-connection.json'), 'utf8'));
  assert.equal(info.baseUrl, page.url().replace(/\/$/, ''));
  const backend = await (await fetch(info.baseUrl + '/api/status')).json();
  assert.equal(backend.gateway, true, 'Uses real isolated local services');
  assert.equal(await app.evaluate(({app}) => app.getPath('userData')), data);
  assert.equal(await app.evaluate(({app}) => app.getVersion()), version);
  return info;
}
async function backupClipboard() {
  await app.evaluate(async ({clipboard, ClipboardItem}) => {
    const items = await clipboard.read();
    globalThis.__mediaSailHomeClipboard = await Promise.all(items.map(async item => {
      const formats = {};
      for (const type of item.types) {
        const value = await item.getType(type);
        formats[type] = type === 'electron application/bookmark' ? value : new Blob([await value.arrayBuffer()], {type: value.type});
      }
      return new ClipboardItem(formats);
    }));
  });
  clipboardSaved = true;
}
async function restoreClipboard() {
  if (!clipboardSaved || !app) return;
  await app.evaluate(async ({clipboard}) => {
    const items = globalThis.__mediaSailHomeClipboard;
    if (items?.length) await clipboard.write(items); else clipboard.clear();
    delete globalThis.__mediaSailHomeClipboard;
  });
  clipboardSaved = false;
}
async function observeAnimation(action) {
  await page.evaluate(() => {
    window.__homeAnimationFrames = [];
    const started = performance.now();
    const sample = now => {
      const layer = document.querySelector('.skill-theme-transition');
      const styles = layer && getComputedStyle(layer);
      window.__homeAnimationFrames.push({ms: now - started, theme: document.documentElement.dataset.theme, display: styles?.display, opacity: styles?.opacity, clipPath: styles?.clipPath});
      if (now - started < 1100) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await action();
  await sleep(1250);
  return page.evaluate(() => window.__homeAnimationFrames);
}
async function closeApp() {
  if (!app) return;
  await restoreClipboard();
  await app.close();
  app = null;
}
async function convertVideo(recording) {
  if (!recording) throw new Error('Playwright did not record the actual rendered page');
  const webm = path.join(evidence, 'home-interactions.webm');
  await recording.saveAs(webm);
  const ffmpeg = path.join(path.dirname(executable), 'resources', 'runtime', 'ffmpeg', 'ffmpeg.exe');
  assert.ok(fs.existsSync(ffmpeg), 'The tested package must carry FFmpeg');
  const result = cp.spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(evidence, 'home-interactions.mp4')], {windowsHide: true, timeout: 180000, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || 'Video conversion failed');
  assert.ok(fs.statSync(webm).size > 10000);
  assert.ok(fs.statSync(path.join(evidence, 'home-interactions.mp4')).size > 10000);
  // Locate the real recorded interaction with the phase wall-clock and the
  // completed recording's actual duration. No replacement animation is drawn.
  const ffprobe = path.join(path.dirname(ffmpeg), 'ffprobe.exe');
  const probe = cp.spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', webm], {windowsHide: true, timeout: 30000, encoding: 'utf8'});
  assert.equal(probe.status, 0, probe.stderr);
  const duration = Number(JSON.parse(probe.stdout).format.duration);
  const animationAt = Date.parse(phases.find(item => item.name === 'Animated theme and persistence').at);
  const offset = Math.max(0, duration - (fs.statSync(webm).mtimeMs - animationAt) / 1000 - 1.2);
  const clip = cp.spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-ss', String(offset), '-i', webm, '-t', '7.5', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(evidence, 'theme-transition.mp4')], {windowsHide: true, timeout: 90000, encoding: 'utf8'});
  assert.equal(clip.status, 0, clip.stderr || 'Theme video trimming failed');
  fs.writeFileSync(path.join(evidence, 'theme-video-source.json'), JSON.stringify({source: path.basename(webm), sourceDurationSeconds: duration, trimOffsetSeconds: offset, trimDurationSeconds: 7.5, phaseAt: new Date(animationAt).toISOString(), method: 'Trim of actual Playwright frames; phase time aligned to completed WebM duration; visually inspect clip before delivery'}, null, 2));
}
function saveResult(passed, error) {
  fs.writeFileSync(path.join(evidence, 'home-result.json'), JSON.stringify({passed, version, at: new Date().toISOString(), executable, data, checks, phases, screenshots, metadataRequests, installerRequests, pageErrors: failures, fixtureUpdateVersion: futureVersion, scaleMethod: 'Electron webContents.setZoomFactor(1.25/1.5), not Windows system DPI', videoMethod: 'Playwright Electron recordVideo captures real rendered frames to WebM; bundled FFmpeg transcodes to MP4 without replacement graphics', ...(error ? {error: error.stack || String(error)} : {})}, null, 2));
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  feed = 'http://127.0.0.1:' + server.address().port;
  try {
    phase('Launch fresh packaged application');
    await launch({record: true});
    const recording = video;
    await resize(1440, 900);
    await assertHome();
    assert.equal(await currentTheme(), 'light', 'Fresh home follows emulated light system preference');
    assert.ok(!(await state()).values.easel_onboarding_seen, 'Home does not consume first-use onboarding');
    await screenshot('home-light');
    checks.push('fresh full-width Agent-first home', 'no first-use overlay on home', 'two console buttons and copy entry');

    phase('Existing console and onboarding');
    await primary().click();
    await page.locator('.sidebar').waitFor();
    await page.getByRole('button', {name: '先用通用模式', exact: true}).waitFor();
    await page.getByRole('button', {name: '先用通用模式', exact: true}).click();
    await page.locator('.sidebar-status').filter({hasText: '网关已连接'}).waitFor();
    await returnHome().click();
    await assertHome();
    assert.ok((await state()).values.easel_onboarding_seen);
    await page.getByRole('button', {name: '控制台 →', exact: true}).click();
    await page.locator('.sidebar').waitFor();
    assert.equal(await page.getByRole('button', {name: '先用通用模式', exact: true}).count(), 0);
    await returnHome().click();
    checks.push('console keeps original sidebar and first-use recommendation', 'footer console entry', 'console returns to standalone home');

    phase('Chat state and fixture stream survive homepage navigation');
    await primary().click();
    await page.locator('.sidebar-nav').getByRole('button', {name: '对话', exact: true}).click();
    const message = '首页切换验收：不调用模型的测试消息';
    const reply = '慢流第一段。切到首页之后继续。最后一段已完成。';
    await page.evaluate(() => {
      window.__homeOriginalFetch = window.fetch.bind(window);
      window.__homeStreamFixture = {requests: 0, aborted: false, finished: false};
      window.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.pathname !== '/api/chat/stream') return window.__homeOriginalFetch(input, init);
        window.__homeStreamFixture.requests++;
        const timers = [];
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const chunks = ['慢流第一段。', '切到首页之后继续。', '最后一段已完成。'];
            chunks.forEach((text, index) => timers.push(setTimeout(() => controller.enqueue(encoder.encode('id: ' + (index + 1) + '\nevent: token\ndata: ' + JSON.stringify(text) + '\n\n')), index * 1400)));
            timers.push(setTimeout(() => {
              controller.enqueue(encoder.encode('id: 4\nevent: done\ndata: {}\n\n'));
              controller.close();
              window.__homeStreamFixture.finished = true;
            }, 4200));
            init?.signal?.addEventListener('abort', () => {
              window.__homeStreamFixture.aborted = true;
              for (const timer of timers) clearTimeout(timer);
              try {controller.error(new DOMException('Fixture aborted', 'AbortError'));} catch {}
            }, {once: true});
          },
        });
        return new Response(stream, {status: 200, headers: {'content-type': 'text/event-stream'}});
      };
    });
    await page.locator('.chat-page textarea').fill(message);
    await page.locator('.chat-page textarea').press('Enter');
    await page.getByText('慢流第一段。', {exact: true}).waitFor();
    await returnHome().click();
    await assertHome();
    await until(async () => await page.evaluate(() => window.__homeStreamFixture.finished), 'Fixture stream completes while homepage is visible');
    await until(async () => JSON.stringify((await state()).values.easel_sessions).includes(reply), 'Complete reply saved while homepage remains visible');
    const streamed = await page.evaluate(() => window.__homeStreamFixture);
    assert.equal(streamed.requests, 1, 'No restart or duplicate chat request when changing pages');
    assert.equal(streamed.aborted, false);
    await primary().click();
    await page.locator('.sidebar-nav').getByRole('button', {name: '对话', exact: true}).click();
    await page.locator('.chat-page').getByText(message, {exact: true}).waitFor();
    await page.locator('.chat-page').getByText(reply, {exact: true}).waitFor();
    await page.evaluate(() => {window.fetch = window.__homeOriginalFetch; delete window.__homeOriginalFetch;});
    await returnHome().click();
    checks.push('chat history preserved across home/console changes', 'synthetic slow SSE completes and persists while homepage is shown; no model request');

    phase('Copy Skill, manual fallback and retry');
    let copied;
    await backupClipboard();
    try {
      await page.getByRole('button', {name: '复制 Skill', exact: true}).click();
      await page.getByRole('button', {name: '已复制', exact: true}).waitFor();
      copied = (await app.evaluate(({clipboard}) => clipboard.readText())).replace(/\r\n/g, '\n');
      assert.match(copied, /agent-connection\.json/);
      assert.ok(copied.includes(data));
    } finally { await restoreClipboard(); }
    await page.evaluate(() => {
      window.__homeClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      Object.defineProperty(navigator.clipboard, 'writeText', {configurable: true, value: async () => {throw new Error('isolated clipboard denial fixture');}});
    });
    await page.getByRole('button', {name: '已复制', exact: true}).click();
    const manual = page.getByRole('dialog');
    await manual.waitFor();
    assert.equal(await manual.getByRole('textbox', {name: 'Skill', exact: true}).inputValue(), copied.replace(/\r\n/g, '\n'));
    const selection = await manual.getByRole('textbox').evaluate(element => ({start: element.selectionStart, end: element.selectionEnd, length: element.value.length}));
    assert.equal(selection.start, 0); assert.equal(selection.end, selection.length);
    await manual.getByRole('button', {name: '完成', exact: true}).click();
    const failConnect = route => route.fulfill({status: 503, contentType: 'text/plain', body: 'isolated service failure'});
    await page.route('**/api/platform-skill?format=connect', failConnect);
    await page.getByRole('button', {name: '复制 Skill', exact: true}).click();
    await page.locator('.skill-error').waitFor();
    assert.match(await page.locator('.skill-error').innerText(), /重试/);
    await page.unroute('**/api/platform-skill?format=connect', failConnect);
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {configurable: true, value: async text => {window.__homeRetriedSkill = text;}}));
    await page.getByRole('button', {name: '复制 Skill', exact: true}).click();
    await page.getByRole('button', {name: '已复制', exact: true}).waitFor();
    assert.equal(await page.evaluate(() => window.__homeRetriedSkill), copied);
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {configurable: true, value: window.__homeClipboardWrite}));
    checks.push('actual clipboard copy with all original formats restored', 'manual dialog identical selected content', 'service failure feedback and retry');

    phase('Animated theme and persistence');
    await setTheme('light');
    const animationFrames = await observeAnimation(() => themeButton().click());
    await waitTheme('dark');
    assert.ok(animationFrames.some(frame => frame.display !== 'none' && Number(frame.opacity) > 0 && /circle\(/.test(frame.clipPath)), 'Actual animation rendered a circular wipe');
    fs.writeFileSync(path.join(evidence, 'theme-animation-frames.json'), JSON.stringify(animationFrames, null, 2));
    await screenshot('home-dark');
    await flush();
    assert.equal((await state()).values.easel_theme, 'dark');
    assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'ui-state.json'), 'utf8')).values.easel_theme, 'dark');
    await page.reload();
    await assertHome();
    await waitTheme('dark');
    await setTheme('light');
    await themeButton().evaluate(async element => {for (let i = 0; i < 5; i++) {element.click(); await new Promise(resolve => setTimeout(resolve, 70));}});
    await waitTheme('dark');
    assert.equal((await state()).values.easel_theme, 'dark', 'Five rapid toggles preserve final intent');
    await setTheme('light');
    await themeButton().click();
    await primary().click();
    await page.locator('.sidebar').waitFor();
    await until(async () => await currentTheme() === 'dark', 'Navigation during transition retains final theme');
    await returnHome().click();
    await waitTheme('dark');
    await page.emulateMedia({reducedMotion: 'reduce'});
    const reducedFrames = await observeAnimation(() => themeButton().click());
    await waitTheme('light');
    assert.ok(!reducedFrames.some(frame => frame.display !== 'none' && Number(frame.opacity) > 0), 'Reduced-motion preference suppresses animated overlay');
    await page.emulateMedia({reducedMotion: 'no-preference'});
    checks.push('real circular theme wipe captured', 'theme persisted to existing desktop storage and reload', 'rapid toggles', 'navigation during animation', 'reduced-motion immediate switch');

    phase('Agent marquee and responsive page zoom');
    const marquee = page.locator('.skill-marquee-track');
    assert.equal(await page.locator('.skill-agent-group').count(), 2);
    assert.equal(await page.locator('.skill-agent-group[aria-hidden="true"]').count(), 1);
    await page.getByRole('button', {name: '暂停图标滚动', exact: true}).click();
    assert.equal(await marquee.evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    await page.getByRole('button', {name: '继续图标滚动', exact: true}).click();
    await page.mouse.move(1, 1);
    await page.locator('.skill-title-dot').click();
    assert.equal(await marquee.evaluate(element => getComputedStyle(element).animationPlayState), 'running');
    await resize(1100, 700);
    await screenshot('home-small-light');
    await setTheme('dark');
    await screenshot('home-small-dark');
    for (const zoom of [1.25, 1.5]) {
      await resize(1440, 900, zoom);
      await screenshot('home-page-zoom-' + Math.round(zoom * 100) + '-dark');
      await setTheme('light');
      await screenshot('home-page-zoom-' + Math.round(zoom * 100) + '-light');
      await setTheme('dark');
    }
    await resize(1440, 900);
    await page.emulateMedia({reducedMotion: 'reduce'});
    assert.equal(await marquee.evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.emulateMedia({reducedMotion: 'no-preference'});
    checks.push('marquee pause/resume and duplicated accessible groups', 'reduced-motion static logos', '1100x700 content size', '125/150 percent Electron page zoom (not system DPI)');

    phase('Startup update banner shared by home and console');
    await page.locator('.desktop-update-banner').waitFor({timeout: 30000});
    assert.equal(metadataRequests, 1, 'Exactly one automatic startup check');
    assert.equal(installerRequests, 0, 'Startup never downloads');
    await screenshot('home-update-banner');
    await primary().click();
    await page.locator('.desktop-update-banner').waitFor();
    const panelEvent = app.waitForEvent('window', {predicate: candidate => candidate !== page});
    await page.getByRole('button', {name: '查看更新', exact: true}).click();
    const panel = await panelEvent;
    await panel.locator('#headline').waitFor();
    assert.match(await panel.locator('#headline').innerText(), new RegExp(futureVersion.replace(/\./g, '\\.')));
    await panel.close();
    await returnHome().click();
    await page.getByRole('button', {name: '关闭更新提示，本次运行不再提醒', exact: true}).click();
    await page.locator('.desktop-update-banner').waitFor({state: 'detached'});
    await primary().click();
    assert.equal(await page.locator('.desktop-update-banner').count(), 0);
    await returnHome().click();
    await page.reload();
    await assertHome();
    assert.equal(await page.locator('.desktop-update-banner').count(), 0);
    await app.evaluate(({BrowserWindow}) => {const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:')); window.close();});
    assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:')).isVisible()), false);
    await app.evaluate(({BrowserWindow}) => {const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:')); window.show();});
    assert.equal(await page.locator('.desktop-update-banner').count(), 0);
    assert.equal(installerRequests, 0);
    checks.push('home and console share banner/update window', 'dismiss survives page switch/reload/tray restore', 'no automatic installer download');

    phase('System preference and explicit preference precedence');
    await page.evaluate(() => window.desktopUiState.call('remove', {key: 'easel_theme'}));
    await flush();
    await page.emulateMedia({colorScheme: 'dark'});
    await page.reload();
    await assertHome();
    await waitTheme('dark');
    await page.emulateMedia({colorScheme: 'light'});
    await waitTheme('light');
    await setTheme('dark');
    await page.emulateMedia({colorScheme: 'light'});
    await waitTheme('dark');
    await flush();
    await closeApp();
    await convertVideo(recording);
    phase('Restart retains selected theme and checks once again');
    await launch({colorScheme: 'light'});
    await assertHome();
    await waitTheme('dark');
    assert.ok((await state()).values.easel_onboarding_seen);
    await page.locator('.desktop-update-banner').waitFor({timeout: 30000});
    assert.equal(metadataRequests, 2);
    assert.equal(installerRequests, 0);
    assert.equal(failures.length, 0, JSON.stringify(failures));
    checks.push('unconfigured theme follows changing system preference', 'explicit theme overrides system and survives process restart', 'dismiss resets next application run');
    await closeApp();
    saveResult(true);
    console.log('HOME ACCEPTANCE PASSED: ' + evidence);
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({path: path.join(evidence, 'failure.png')}).catch(() => {});
    saveResult(false, error);
    throw error;
  } finally {
    await closeApp();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1; server.closeAllConnections(); server.close();});
