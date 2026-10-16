async function update(){const s=await window.desktopStartup.status();if(!s)return;document.querySelector('#message').textContent=s.message;document.querySelector('#actions').hidden=!s.error&&!s.needsSelection;document.querySelector('#selection-hint').hidden=!s.needsSelection;document.querySelector('#loading-hint').hidden=s.error||s.needsSelection;document.querySelector('#retry').hidden=!s.canRetry;document.querySelector('#retry').textContent=s.needsSelection?'重新检测':'重试启动';document.querySelector('#choose-library').textContent=s.needsSelection?'选择资料库':'更换资料库';for(const button of document.querySelectorAll('#actions button'))button.disabled=Boolean(s.busy);}
document.querySelector('#retry').onclick=()=>window.desktopStartup.retry();
document.querySelector('#logs').onclick=()=>window.desktopStartup.logs();
document.querySelector('#quit').onclick=()=>window.desktopStartup.quit();
document.querySelector('#updates').onclick=()=>window.desktopStartup.checkUpdates();
document.querySelector('#choose-library').onclick=()=>window.desktopStartup.library('choose').catch(()=>update());
update();setInterval(update,600);
