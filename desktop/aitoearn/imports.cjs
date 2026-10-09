const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { AitoError } = require('./adapter.cjs');
const TYPES = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.mov':'video/quicktime' };
function contained(root, file) { const rel = path.relative(root, file); return rel && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel); }
async function selectedFile(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.includes(':')) throw new AitoError('素材路径无效。');
  const realRoot = await fsp.realpath(root), file = await fsp.realpath(path.resolve(root, rel));
  if (!contained(realRoot, file)) throw new AitoError('只能发送内容库中的文件。');
  const mime = TYPES[path.extname(file).toLowerCase()];
  if (!mime) throw new AitoError('目前支持 JPG、PNG、WebP 图片及 MP4、MOV 视频。');
  const stat = await fsp.stat(file);
  if (!stat.isFile() || stat.size === 0) throw new AitoError('素材为空或已不可用。');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return { path: rel, name: path.basename(file), size: stat.size, mtime: stat.mtimeMs, hash: hash.digest('hex'), mime };
}
function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(data, null, 2)); fs.renameSync(temp, file);
}
class ImportStore {
  constructor({ data, outputs, adapter, upload, onChange = () => {} }) {
    this.file = path.join(data, 'aitoearn/imports.json'); this.outputs = outputs; this.adapter = adapter; this.upload = upload; this.onChange = onChange;
    this.state = { version:1, compose:null, groups:{}, jobs:[] }; this.running = null; this.controller = null; this.stopping = false; this.preparing = false;
    if (fs.existsSync(this.file)) {
      try { const old = JSON.parse(fs.readFileSync(this.file, 'utf8')); if (old.version !== 1 || !Array.isArray(old.jobs) || typeof old.groups !== 'object') throw new Error(); this.state = old; }
      catch { throw new AitoError('AI 发布发送记录无法读取。请备份数据并查看日志，不会覆盖原记录。'); }
    }
    for (const job of this.state.jobs) {
      if (job.status === 'creating') { job.status = 'uncertain'; job.message = '上次保存草稿时退出，请先核对结果。'; }
      else if (['uploading','checking'].includes(job.status)) { job.status = 'paused'; job.message = '发送已暂停，可继续。'; }
    }
    this.save();
  }
  save() { atomicJson(this.file, this.state); this.onChange(); }
  busy() { return Boolean(this.running || this.preparing); }
  snapshot() { return { compose:this.state.compose, jobs:this.state.jobs.map(({ payload, uploads, files, ...job }) => ({ ...job, files:files.map(f => ({path:f.path,name:f.name,size:f.size})) })), busy:this.busy() }; }
  saveCompose(value) {
    // Only a local, bounded editor draft is persisted. File paths are revalidated before every upload.
    if (value !== null && (typeof value !== 'object' || JSON.stringify(value).length > 200000)) throw new AitoError('待发送内容过大。');
    this.state.compose = value; this.save(); return true;
  }
  async connection() {
    const user = await this.adapter.identity(), groups = await this.adapter.groups(user.id);
    return { user, groups, selectedGroup:this.state.groups[user.id] || '' };
  }
  async createGroup() {
    const user = await this.adapter.identity();
    const group = await this.adapter.createGroup(user.id); this.state.groups[user.id] = group.id; this.save(); return group;
  }
  async start(input) {
    if (this.busy() || this.stopping) throw new AitoError('已有发送任务正在处理，请稍候。');
    this.preparing = true; this.onChange();
    try {
      if (!input || typeof input !== 'object') throw new AitoError('发送内容无效。');
      const title = String(input.title || '').trim(), body = String(input.body || '').trim(), groupId = String(input.groupId || '');
      if (!title || !body) throw new AitoError('请补充标题和正文。');
      if (title.length > 500 || body.length > 100000 || !/^[\w-]{1,120}$/.test(groupId)) throw new AitoError('标题、正文或草稿箱无效。');
      const images = Array.isArray(input.images) ? [...new Set(input.images)] : [];
      const video = typeof input.video === 'string' ? input.video : '';
      if ((!images.length && !video) || (images.length && video)) throw new AitoError('请选择一组图片或一个视频。只有文字时请先添加媒体。');
      if (images.length > 100) throw new AitoError('一次最多选择 100 张图片，实际平台限制以 AitoEarn 为准。');
      const paths = [...images, ...(video ? [video] : []), ...(input.cover ? [input.cover] : [])];
      const files = await Promise.all([...new Set(paths)].map(p => selectedFile(this.outputs, p)));
      if (images.some(p => !files.find(f => f.path === p)?.mime.startsWith('image/')) || (video && !files.find(f => f.path === video)?.mime.startsWith('video/')) || (input.cover && !files.find(f => f.path === input.cover)?.mime.startsWith('image/'))) throw new AitoError('图片、视频或封面类型不匹配。');
      const user = await this.adapter.identity(), groups = await this.adapter.groups(user.id);
      if (input.accountId && user.id !== input.accountId) throw new AitoError('账号已改变，请刷新账号和草稿箱后重试。', 'login');
      if (!groups.some(g => g.id === groupId)) throw new AitoError('草稿箱不属于当前账号或已删除，请重新选择。');
      const content = { title, body, groupId, images, video, cover:input.cover || '' };
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify([user.id, content, files.map(f => [f.path,f.hash])])).digest('hex');
      let job = this.state.jobs.find(j => j.fingerprint === fingerprint);
      if (job) {
        if (job.status === 'done' || job.status === 'uncertain') return job.id;
      } else {
        job = { id:crypto.randomUUID(), fingerprint, accountId:user.id, accountName:user.name, content, files, uploads:{}, status:'paused', message:'准备发送', progress:0, createdAt:Date.now() };
        this.state.jobs.unshift(job);
      }
      this.state.groups[user.id] = groupId; this.save(); this.launch(job); return job.id;
    } finally { this.preparing = false; this.onChange(); }
  }
  update(job, values) { Object.assign(job, values, {updatedAt:Date.now()}); this.save(); }
  launch(job) {
    this.controller = new AbortController();
    this.running = this.run(job).finally(() => { this.running = null; this.controller = null; this.onChange(); });
  }
  async checkAccount(job) {
    const user = await this.adapter.identity();
    if (user.id !== job.accountId) throw new AitoError('请切回此任务对应的 AitoEarn 账号后继续。', 'login');
    if (this.stopping || this.controller?.signal.aborted) throw new AitoError('发送已暂停。', 'paused');
  }
  async run(job) {
    let creating = false;
    try {
      this.update(job, {status:'checking', message:'正在核对账号和素材…'}); await this.checkAccount(job);
      for (let index = 0; index < job.files.length; index++) {
        const file = job.files[index];
        if (job.uploads[file.hash]?.url) continue;
        await this.checkAccount(job);
        const current = await selectedFile(this.outputs, file.path);
        if (current.hash !== file.hash || current.size !== file.size) throw new AitoError(`素材「${file.name}」已变化，请从内容库重新发送。`);
        this.update(job, {status:'uploading', message:`正在上传 ${file.name}`, progress:Math.floor(index/job.files.length*90)});
        const sign = await this.adapter.sign(file, job.accountId);
        if (!sign?.id || !sign?.uploadUrl || !sign?.url) throw new AitoError('上传凭据格式发生变化，请更新适配。');
        await this.upload(path.resolve(this.outputs, file.path), file, sign, this.controller.signal, fraction => {
          job.progress = Math.floor((index+fraction)/job.files.length*90); this.onChange();
        });
        await this.checkAccount(job);
        const confirmed = await this.adapter.confirm(String(sign.id), job.accountId);
        const url = confirmed?.url || sign.url;
        if (new URL(url).origin !== 'https://assets.aitoearn.cn') throw new AitoError('上传资源不属于 AitoEarn 中国站，已停止。');
        job.uploads[file.hash] = { id:String(sign.id), url }; this.save();
      }
      await this.checkAccount(job);
      const url = p => job.uploads[job.files.find(f => f.path === p).hash].url;
      const c = job.content;
      const payload = { groupId:c.groupId, title:c.title, desc:c.body, type:c.video ? 'video' : 'article', accountTypes:[], mediaList:c.video ? [{url:url(c.video),type:'video'}] : c.images.map(p => ({url:url(p),type:'img'})) };
      if (c.cover || c.images[0]) payload.coverUrl = url(c.cover || c.images[0]);
      job.payload = payload;
      this.update(job, {status:'checking', message:'正在核对已有草稿…', progress:92});
      const existing = await this.adapter.findDraft(payload, job.accountId);
      if (existing) { this.update(job, {status:'done', message:'已找到相同草稿，可以打开检查。', draftId:existing, progress:100}); return; }
      await this.checkAccount(job);
      this.update(job, {status:'creating', message:'正在保存到 AitoEarn 草稿箱…', submittedAt:Date.now(), progress:96});
      creating = true;
      const result = await this.adapter.createDraft(payload, job.accountId);
      let id = typeof result === 'string' ? result : result?.id || result?._id;
      if (!id) id = await this.adapter.findDraft(payload, job.accountId);
      if (!id) throw new AitoError('草稿保存结果不明，请先核对。', 'uncertain');
      this.update(job, {status:'done', message:'草稿已保存，请在 AitoEarn 检查并选择发布账号。', draftId:String(id), progress:100});
    } catch (error) {
      const uncertain = creating && (!error.kind || ['uncertain','paused'].includes(error.kind));
      this.update(job, {status:uncertain ? 'uncertain' : error.kind === 'login' ? 'login' : this.stopping || error.kind === 'paused' ? 'paused' : 'failed', message:uncertain ? '草稿保存结果不明。请先核对，避免重复创建。' : (error.message || '发送失败，请重试。')});
    }
  }
  async retry(id, confirmedAbsent = false) {
    if (this.busy() || this.stopping) throw new AitoError('请等待当前任务结束。');
    const job = this.state.jobs.find(j => j.id === id); if (!job) throw new AitoError('发送记录不存在。');
    if (job.status === 'done') return id;
    if (job.status === 'uncertain' && (!confirmedAbsent || !job.checkedAbsentAt)) throw new AitoError('请先核对草稿是否已经创建。');
    this.launch(job); return id;
  }
  async reconcile(id) {
    if (this.busy()) throw new AitoError('请等待当前任务结束。');
    const job = this.state.jobs.find(j => j.id === id); if (!job?.payload || job.status !== 'uncertain') throw new AitoError('此任务无需核对。');
    this.preparing = true;
    try {
      await this.checkAccount(job);
      const found = await this.adapter.findDraft(job.payload, job.accountId);
      if (found) this.update(job, {status:'done', draftId:found, progress:100, message:'已核对：草稿已保存。'});
      else this.update(job, {checkedAbsentAt:Date.now(), message:'目前未查到相同草稿。请在网站核对后，再选择重新发送。'});
      return Boolean(found);
    } finally { this.preparing = false; this.onChange(); }
  }
  async shutdown() {
    this.stopping = true; this.controller?.abort();
    for (const job of this.state.jobs) {
      if (job.status === 'creating') { job.status='uncertain'; job.message='退出时正在保存草稿，请先核对结果。'; }
      else if (['checking','uploading'].includes(job.status)) { job.status='paused'; job.message='发送已暂停，可继续。'; }
    }
    this.save();
    if (this.running) await Promise.race([this.running, new Promise(resolve => setTimeout(resolve, 1500))]);
  }
}
module.exports = { ImportStore, selectedFile, contained, atomicJson, TYPES };
