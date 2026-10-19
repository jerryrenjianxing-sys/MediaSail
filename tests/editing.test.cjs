const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../vendor/easel/web/frontend/src/lib/editing.ts')).href;

test('a clean editor leaves without a prompt and a cancelled leave preserves the registered draft', async () => {
  const { createEditingSession } = await import(moduleUrl);
  const editing = createEditingSession();
  let dirty = false, prompts = 0;
  editing.register('profile', () => ({ label: '画像', dirty, saving: false }));
  const prompt = () => { prompts++; return false; };
  assert.equal(await editing.requestLeave({ reason: '切换页面', confirm: prompt }), true);
  assert.equal(prompts, 0);
  dirty = true;
  assert.equal(await editing.requestLeave({ reason: '切换页面', confirm: prompt }), false);
  assert.equal(editing.read().dirty, true);
  assert.equal(prompts, 1);
});

test('a save that starts while a leave decision is pending prevents interruption', async () => {
  const { createEditingSession } = await import(moduleUrl);
  const editing = createEditingSession();
  let saving = false;
  editing.register('profile', () => ({ label: '画像', dirty: true, saving }));
  assert.equal(await editing.requestLeave({ reason: '退出', notify: () => {}, confirm: async () => { saving = true; return true; } }), false);
});

test('rapid leave requests cannot reuse a confirmation and later edits require a fresh decision', async () => {
  const { createEditingSession } = await import(moduleUrl);
  const editing = createEditingSession();
  editing.register('profile', () => ({ label: '画像', dirty: true, saving: false }));
  let resolve, prompts = 0;
  const confirm = () => { prompts++; return new Promise(done => { resolve = done; }); };
  const first = editing.requestLeave({ reason: '切页', confirm });
  const second = editing.requestLeave({ reason: '退出', confirm });
  assert.equal(prompts, 1);
  resolve(true);
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(await editing.requestLeave({ reason: '退出', confirm: () => { prompts++; return false; } }), false);
  assert.equal(prompts, 2);
});

test('saving blocks interruption and library changes require clean drafts without offering discard', async () => {
  const { createEditingSession } = await import(moduleUrl);
  const editing = createEditingSession();
  let saving = true, prompts = 0;
  const notices = [];
  editing.register('profile', () => ({ label: '画像', dirty: true, saving }));
  const options = { reason: '退出', confirm: () => { prompts++; return true; }, notify: message => notices.push(message) };
  assert.equal(await editing.requestLeave(options), false);
  saving = false;
  assert.equal(await editing.requestLeave({ ...options, reason: '切换资料库', requireClean: true }), false);
  assert.equal(prompts, 0);
  assert.match(notices[0], /保存/);
  assert.match(notices[1], /保存或取消/);
  assert.equal(editing.read().dirty, true);
});

test('a failed decision releases the attempt and scoped registration cleanup preserves a replacement', async () => {
  const { createEditingSession } = await import(moduleUrl);
  const editing = createEditingSession();
  const previous = editing.register('profile', () => ({ label: '旧画像', dirty: true, saving: false }));
  const current = editing.register('profile', () => ({ label: '当前画像', dirty: true, saving: false }));
  previous();
  assert.equal(editing.read(['profile']).dirty, true);
  assert.equal(editing.read(['calendar']).dirty, false);
  await assert.rejects(editing.requestLeave({ reason: '退出', confirm: () => { throw Error('synthetic dialog failure'); } }), /synthetic/);
  assert.equal(await editing.requestLeave({ reason: '退出', confirm: () => true }), true);
  current();
  assert.equal(editing.read().dirty, false);
});
