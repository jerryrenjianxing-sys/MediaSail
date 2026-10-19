'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { trustedStateSender } = require('./ui-state.cjs');

function validateSkillFileName(fileName) {
  if (typeof fileName !== 'string' || fileName.length > 100 || !fileName.endsWith('.md') ||
      !fileName.slice(0, -3).trim() || fileName.startsWith('.') || /[<>:"/\\|?*\x00-\x1f]/.test(fileName) ||
      /[ .]$/.test(fileName.slice(0, -3)) || /^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(fileName)) {
    throw Error('请使用不含路径或非法字符的普通文件名，并保留 .md 扩展名（最多100个字符）。');
  }
}
function createSkillShareHandler({ main, localOrigin, data, available, clipboard, ClipboardItem }) {
  let copying = false;
  return async (event, fileName) => {
    if (!trustedStateSender(event, main(), localOrigin())) return { ok: false, error: '此页面不能复制 Skill 文件。' };
    if (copying) return { ok: false, error: '文件正在复制，请稍候。' };
    copying = true;
    try {
      validateSkillFileName(fileName);
      if (!available()) throw Error('请等待本地服务就绪，或资料库切换完成后重试。');
      const origin = localOrigin(), root = data();
      const current = () => available() && origin === localOrigin() && root === data() && trustedStateSender(event, main(), origin);
      const response = await fetch(origin + '/api/platform-skill?format=connect', { signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) throw Error('接入说明暂不可读，请稍后重试或复制文字。');
      const text = await response.text();
      if (!current()) throw Error('软件状态已变化，请等待服务就绪后重新复制。');
      if (!text.trim() || Buffer.byteLength(text) > 128 * 1024) throw Error('接入说明格式不正确，请重试或复制文字。');
      if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error('请先选择资料库。');
      let cache = root;
      for (const part of ['', 'cache', 'agent-share']) {
        if (part) { cache = path.join(cache, part); try { await fs.mkdir(cache); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
        const stat = await fs.lstat(cache);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('资料库缓存必须是普通文件夹，不能是目录链接。');
      }
      const directory = await fs.mkdtemp(path.join(cache, 'copy-')), file = path.join(directory, fileName);
      await fs.writeFile(file, text, { encoding: 'utf8', flag: 'wx' });
      if (!current()) throw Error('软件状态已变化，请等待服务就绪后重新复制。');
      await clipboard.write([new ClipboardItem({ 'text/uri-list': pathToFileURL(file).href + '\r\n' })]);
      return { ok: true, data: { fileName } };
    } catch (error) { return { ok: false, error: error.message || '文件复制失败，可改用复制文字。' }; }
    finally { copying = false; }
  };
}
module.exports = { createSkillShareHandler, validateSkillFileName };
