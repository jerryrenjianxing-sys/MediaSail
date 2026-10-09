// Adapter for the China website observed on 2026-10-09. No publishing endpoints.
const ORIGIN = 'https://aitoearn.cn';
const HOME = ORIGIN + '/zh-CN';
class AitoError extends Error {
  constructor(message, kind = 'failed') { super(message); this.kind = kind; }
}
// Runs in an isolated world of the already logged-in, sandboxed website.
// The website token never leaves that renderer or enters logs / application IPC.
async function pageRequest(origin, route, method, data, accountId) {
  if (location.origin !== origin) return { error: '请先打开 AitoEarn 中国站。', kind: 'login' };
  let auth;
  try { auth = JSON.parse(localStorage.getItem('User') || '{}').state; } catch {}
  if (!auth?.token || !auth?.userInfo?.id) return { error: '请先在 AI 发布页面登录 AitoEarn。', kind: 'login' };
  if (accountId && String(auth.userInfo.id) !== accountId) return { error: '当前 AitoEarn 账号已改变，请切回发送时的账号。', kind: 'login' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(origin + '/api/' + route, {
      method, headers: { Authorization: `Bearer ${auth.token}`, 'Accept-Language': 'zh-CN', 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return { error: '登录已失效或没有操作权限，请重新登录后重试。', kind: 'login' };
    if (response.status >= 500) return { error: 'AitoEarn 服务暂时异常，请稍后核对结果。', kind: 'uncertain' };
    let body;
    try { body = await response.json(); } catch { return { error: 'AitoEarn 返回格式已变化，请更新适配后重试。', kind: 'uncertain' }; }
    if ([401, 12000].includes(body.code)) return { error: 'AitoEarn 登录已失效，请重新登录。', kind: 'login' };
    if (!response.ok || body.code !== 0) return { error: String(body.message || 'AitoEarn 拒绝了此操作。').slice(0, 400), kind: 'failed' };
    return { data: body.data };
  } catch { return { error: '连接中断或等待超时。', kind: 'uncertain' }; }
  finally { clearTimeout(timeout); }
}
class WebsiteAdapter {
  constructor(getContents) { this.getContents = getContents; }
  async request(route, method = 'GET', data, accountId) {
    // This allowlist is intentionally incapable of publishing, deleting, or executing a URL supplied by the renderer.
    const allowed = (method === 'GET' && /^(user\/mine|material\/group\/list\/\d+\/100|material\/list\/\d+\/100\?groupId=[\w-]+)$/.test(route)) ||
      (method === 'POST' && /^(material|material\/group|assets\/uploadSign|assets\/[\w-]+\/confirm)$/.test(route));
    if (!allowed) throw new AitoError('不支持的草稿操作。');
    const wc = this.getContents();
    if (!wc || wc.isDestroyed() || new URL(wc.getURL() || HOME).origin !== ORIGIN) throw new AitoError('请先打开 AI 发布并登录。', 'login');
    let result;
    try {
      result = await wc.executeJavaScriptInIsolatedWorld(937, [{ code: `(${pageRequest.toString()})(${[ORIGIN, route, method, data, accountId].map(x => JSON.stringify(x) ?? 'undefined').join(',')})` }]);
    } catch { throw new AitoError('页面正在切换或连接中断，请重新打开 AI 发布。', 'uncertain'); }
    if (result?.error) throw new AitoError(result.error, result.kind);
    if (!result || !Object.hasOwn(result, 'data')) throw new AitoError('AitoEarn 接口格式发生变化。', 'uncertain');
    return result.data;
  }
  async identity() {
    const user = await this.request('user/mine');
    if (!user?.id) throw new AitoError('无法确认 AitoEarn 登录账号。', 'login');
    return { id: String(user.id), name: String(user.name || user.nickname || user.username || '已登录账号') };
  }
  async groups(accountId) {
    const rows = [];
    for (let page = 1; page <= 100; page++) {
      const data = await this.request(`material/group/list/${page}/100`, 'GET', undefined, accountId);
      if (!Array.isArray(data?.list)) throw new AitoError('草稿箱列表格式发生变化，请更新适配。');
      rows.push(...data.list.map(g => ({ id: String(g.id || g._id || ''), name: String(g.name || g.title || '未命名草稿箱') })).filter(g => /^[\w-]+$/.test(g.id)));
      if (data.list.length < 100 || (typeof data.total === 'number' && rows.length >= data.total)) return rows;
    }
    throw new AitoError('草稿箱过多，无法完整读取。');
  }
  async createGroup(accountId) {
    const groups = await this.groups(accountId);
    const existing = groups.find(g => g.name === 'Easel 导入');
    if (existing) return existing;
    const data = await this.request('material/group', 'POST', { name: 'Easel 导入', type: 'video' }, accountId);
    if (!data?.id && !data?._id) throw new AitoError('草稿箱创建结果不明，请刷新列表核对。', 'uncertain');
    return { id: String(data.id || data._id), name: 'Easel 导入' };
  }
  sign(file, accountId) { return this.request('assets/uploadSign', 'POST', { filename: file.name, size: file.size, type: 'userMedia' }, accountId); }
  confirm(id, accountId) {
    if (!/^[\w-]+$/.test(id)) throw new AitoError('上传凭据格式发生变化。');
    return this.request(`assets/${id}/confirm`, 'POST', { id }, accountId);
  }
  createDraft(payload, accountId) { return this.request('material', 'POST', payload, accountId); }
  async findDraft(payload, accountId) {
    for (let page = 1; page <= 1000; page++) {
      const data = await this.request(`material/list/${page}/100?groupId=${encodeURIComponent(payload.groupId)}`, 'GET', undefined, accountId);
      if (!Array.isArray(data?.list)) throw new AitoError('无法核对草稿结果，列表格式发生变化。', 'uncertain');
      const found = data.list.find(d => sameDraft(d, payload));
      if (found) return String(found.id || found._id || '') || null;
      if (data.list.length < 100 || (typeof data.total === 'number' && page * 100 >= data.total)) return null;
    }
    throw new AitoError('草稿太多，无法完整核对，请在网站中确认。', 'uncertain');
  }
}
function sameDraft(draft, payload) {
  return String(draft.title || '').trim() === payload.title && String(draft.desc || '').trim() === payload.desc &&
    String(draft.type || '') === payload.type && String(draft.coverUrl || '') === String(payload.coverUrl || '') &&
    JSON.stringify((draft.mediaList || []).map(m => [m.type, m.url])) === JSON.stringify(payload.mediaList.map(m => [m.type, m.url]));
}
module.exports = { WebsiteAdapter, AitoError, ORIGIN, HOME, sameDraft, pageRequest };
