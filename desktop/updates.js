const $=id=>document.getElementById(id);
const sizes=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GB':(n/1024**2).toFixed(1)+' MB';
function render(s){
  $('version').textContent='当前版本 '+s.current;
  const titles={idle:'检查新版本',checking:'正在检查',current:'已是最新版本',available:'新版本 '+s.version,downloading:'正在下载 '+s.version,downloaded:'可以安装 '+s.version,installing:'正在安装',error:'更新暂未完成',disabled:'开发模式'};
  $('headline').textContent=titles[s.phase]||'软件更新';$('message').textContent=s.message;
  $('check').hidden=['available','downloading','downloaded','installing'].includes(s.phase);
  $('check').disabled=['checking','disabled'].includes(s.phase);$('check').textContent=s.phase==='error'?'重新检查':'检查更新';
  $('download').hidden=s.phase!=='available';$('install').hidden=s.phase!=='downloaded';
  $('progress').hidden=s.phase!=='downloading';$('progress').value=s.percent;
  $('detail').textContent=s.phase==='downloading'?`${s.percent.toFixed(1)}% · ${sizes(s.transferred)} / ${sizes(s.total)} · ${sizes(s.bytesPerSecond)}/秒`:s.phase==='available'&&s.total?`完整安装包 ${sizes(s.total)}；支持时会尝试差分下载。`:'';
}
async function call(action){try{render(await window.mediaSailUpdate.call(action));}catch(e){$('message').textContent=e.message;}}
for(const action of ['check','download','install','releases','logs'])$(action).addEventListener('click',()=>void call(action));
window.mediaSailUpdate.subscribe(render);void call('status');
