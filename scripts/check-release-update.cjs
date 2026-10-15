// Run only after 0.4.3 is published. Observe the unchanged 0.4.2 GitHub updater;
// never request a download or installation, and never launch the user's install.
const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const from = '0.4.2', to = '0.4.3';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function within(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function safePath(candidate) {
  const resolved = path.resolve(candidate);
  const forbidden = [
    'D:\\mediasail',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ElectronEasel'),
  ].filter(Boolean).map(value => path.resolve(value).toLowerCase());
  let existing = resolved;
  const missing = [];
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    assert.notEqual(parent, existing, 'No existing parent for the requested test path');
    existing = parent;
  }
  const canonical = path.join(fs.realpathSync.native(existing), ...missing).toLowerCase();
  assert(!forbidden.some(parent => within(parent, resolved.toLowerCase()) || within(parent, canonical)), 'Refusing to use the real MediaSail installation or user data');
  return resolved;
}

function isolatedEnvironment(data) {
  const env = {};
  // Carry OS/network settings only. Do not inherit model keys, GitHub tokens,
  // developer profiles, or another application's configuration locations.
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'SystemDrive', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS', 'USERNAME', 'OS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const home = path.join(data, 'home'), temporary = path.join(data, 'temp');
  const roaming = path.join(home, 'AppData', 'Roaming'), local = path.join(home, 'AppData', 'Local');
  for (const directory of [home, temporary, roaming, local]) fs.mkdirSync(directory, { recursive: true });
  const windows = env.SystemRoot || env.SYSTEMROOT || env.WINDIR || 'C:\\Windows';
  Object.assign(env, {
    PATH: [path.join(windows, 'System32'), windows, path.join(windows, 'System32', 'WindowsPowerShell', 'v1.0')].join(path.delimiter),
    USERPROFILE: home, HOME: home,
    HOMEDRIVE: path.parse(home).root.slice(0, 2), HOMEPATH: home.slice(2),
    APPDATA: roaming, LOCALAPPDATA: local, TEMP: temporary, TMP: temporary,
    EASEL_DESKTOP_DATA: data,
    PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
  });
  return env;
}

async function main() {
  assert.equal(process.platform, 'win32', 'This acceptance check requires Windows');
  assert(process.env.EASEL_TEST_EXE, 'Set EASEL_TEST_EXE to a preserved, isolated 0.4.2 MediaSail.exe');
  const executable = safePath(fs.realpathSync.native(safePath(process.env.EASEL_TEST_EXE)));
  assert.equal(path.basename(executable).toLowerCase(), 'mediasail.exe');
  const resources = path.join(path.dirname(executable), 'resources');
  assert(fs.existsSync(path.join(resources, 'app.asar')), 'Expected the packaged 0.4.2 application');
  const config = fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8');
  assert.match(config, /^provider:\s*github\s*$/m);
  assert.match(config, /^owner:\s*jerryrenjianxing-sys\s*$/m);
  assert.match(config, /^repo:\s*MediaSail\s*$/m);

  const evidence = safePath(process.env.EASEL_RELEASE_EVIDENCE || path.resolve(root, '../../outputs/MediaSail/verification-release-0.4.3'));
  fs.mkdirSync(evidence, { recursive: true });
  // Resolve the actual evidence directory as well, so a junction cannot point
  // at the user's existing installation or data.
  safePath(fs.realpathSync.native(evidence));
  const testRoot = safePath(path.join(root, '.test-data'));
  fs.mkdirSync(testRoot, { recursive: true });
  const data = fs.mkdtempSync(path.join(testRoot, '发布 更新 0.4.3-'));
  const result = {
    passed: false, from, to, startedAt: new Date().toISOString(),
    source: 'unchanged packaged electron-updater GitHub configuration',
    repository: 'https://github.com/jerryrenjianxing-sys/MediaSail',
    executable, isolatedData: data, attempts: [], downloadRequested: false, installationRequested: false,
  };
  let app, processHandle, page, panel;
  const persist = () => fs.writeFileSync(path.join(evidence, 'release-update-result.json'), JSON.stringify(result, null, 2));
  try {
    app = await electron.launch({ executablePath: executable, cwd: path.dirname(executable), args: [], env: isolatedEnvironment(data), timeout: 60000 });
    processHandle = app.process();
    const baseline = await app.evaluate(({ app }) => {
      const require = process.getBuiltinModule('node:module').createRequire(app.getAppPath() + '/package.json');
      const updater = require('electron-updater').autoUpdater;
      const probe = { metadata: null, downloadEvents: 0, downloadedEvents: 0 };
      globalThis.mediaSailReleaseCheck = probe;
      // Read-only observation: do not replace the provider, transport, cache,
      // download methods, or installation methods.
      updater.on('update-available', info => {
        probe.metadata = {
          version: info.version, releaseDate: info.releaseDate || null,
          files: (info.files || []).map(file => ({
            filename: String(file.url || '').split(/[?#]/, 1)[0].split('/').filter(Boolean).pop() || '',
            size: file.size || null, sha512: file.sha512 || null,
          })),
        };
      });
      updater.on('download-progress', () => { probe.downloadEvents++; });
      updater.on('update-downloaded', () => { probe.downloadedEvents++; });
      return { version: app.getVersion(), userData: app.getPath('userData'), packaged: app.isPackaged, autoDownload: updater.autoDownload, autoInstallOnAppQuit: updater.autoInstallOnAppQuit };
    });
    assert.equal(baseline.version, from, 'The explicitly supplied baseline must be 0.4.2');
    assert.equal(path.resolve(baseline.userData).toLowerCase(), path.resolve(data).toLowerCase());
    assert.equal(baseline.packaged, true);
    assert.equal(baseline.autoDownload, false);
    assert.equal(baseline.autoInstallOnAppQuit, false);
    result.baseline = baseline;

    page = await app.firstWindow();
    await page.waitForURL('http://127.0.0.1:*/', { timeout: 240000 });
    await page.locator('.sidebar-status').filter({ hasText: '网关已连接' }).waitFor({ timeout: 240000 });
    const welcome = page.getByRole('button', { name: '先用通用模式', exact: true });
    if (await welcome.isVisible()) await welcome.click();
    result.serviceReadyAt = new Date().toISOString();

    const panelOpened = app.waitForEvent('window', { predicate: candidate => candidate !== page, timeout: 15000 });
    await page.evaluate(() => window.desktopUpdates.openAndCheck());
    panel = await panelOpened;
    await panel.waitForURL('**/updates.html');
    await panel.locator('#headline').waitFor();
    // A newly published stable release can be delayed in GitHub's CDN. Use
    // only the original check interface, no more than once every 30 seconds.
    const deadline = Date.now() + 300000;
    let lastCheck = Date.now(), lastRecorded = '', state;
    while (Date.now() < deadline) {
      state = await page.evaluate(() => window.desktopUpdates.status());
      assert(state, 'The baseline update bridge did not return state');
      assert(!['downloading', 'downloaded', 'installing'].includes(state.phase), 'Unexpected download or installation during a discovery-only check');
      const identity = JSON.stringify([state.phase, state.current, state.version, state.checkedAt]);
      if (identity !== lastRecorded) {
        result.attempts.push({ at: new Date().toISOString(), phase: state.phase, current: state.current, version: state.version, checkedAt: state.checkedAt });
        lastRecorded = identity;
      }
      if (state.phase === 'available') break;
      if (['current', 'error'].includes(state.phase) && Date.now() - lastCheck >= 30000) {
        lastCheck = Date.now();
        await panel.evaluate(() => window.mediaSailUpdate.call('check'));
      }
      await delay(500);
    }
    assert.equal(state?.phase, 'available', 'GitHub did not offer 0.4.3 within five minutes');
    assert.equal(state.current, from);
    assert.equal(state.version, to);
    result.updateState = state;
    fs.writeFileSync(path.join(evidence, 'update-state.json'), JSON.stringify(state, null, 2));
    const probe = await app.evaluate(() => globalThis.mediaSailReleaseCheck);
    assert.equal(probe.downloadEvents, 0);
    assert.equal(probe.downloadedEvents, 0);
    assert.equal(probe.metadata?.version, to);
    result.metadata = probe.metadata;
    result.downloadEvents = probe.downloadEvents;
    result.downloadedEvents = probe.downloadedEvents;
    fs.writeFileSync(path.join(evidence, 'release-metadata.json'), JSON.stringify(probe.metadata, null, 2));
    await panel.screenshot({ path: path.join(evidence, 'old-0.4.2-discovers-0.4.3.png'), animations: 'disabled' });
    result.passed = true;
    result.verifiedAt = new Date().toISOString();
  } catch (error) {
    result.error = error.message;
    if (panel) await panel.screenshot({ path: path.join(evidence, 'update-check-failure.png'), animations: 'disabled' }).catch(() => {});
    else if (page) await page.screenshot({ path: path.join(evidence, 'startup-failure.png'), animations: 'disabled' }).catch(() => {});
    throw error;
  } finally {
    if (app) {
      // A failed first startup can still ask whether to stop its own services.
      // Suppress that test-only confirmation, then let the normal exit clean up.
      await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); }).catch(() => {});
      try { await app.close(); } catch (error) { result.cleanupError = error.message; }
    }
    result.cleanupComplete = !processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null;
    const descriptor = path.join(data, 'agent-connection.json');
    if (fs.existsSync(descriptor)) {
      const connection = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
      result.connectionStatusAfterExit = connection.status;
      result.cleanupComplete = result.cleanupComplete && connection.status === 'stopped';
    }
    result.passed = result.passed && result.cleanupComplete;
    result.completedAt = new Date().toISOString();
    persist();
  }
  assert.equal(result.cleanupComplete, true, 'The isolated baseline did not exit cleanly');
  console.log(JSON.stringify({ passed: result.passed, from, to, evidence, noDownloadOrInstall: true }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
