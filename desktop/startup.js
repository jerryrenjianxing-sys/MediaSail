async function update(){const s=await window.desktopStartup.status();document.querySelector('#message').textContent=s.message;document.querySelector('#actions').hidden=!s.error;document.querySelector('.hint').hidden=s.error;document.querySelector('#library-actions').hidden=!s.library;}
document.querySelector('#retry').onclick=()=>window.desktopStartup.retry();
document.querySelector('#logs').onclick=()=>window.desktopStartup.logs();
document.querySelector('#quit').onclick=()=>window.desktopStartup.quit();
document.querySelector('#choose-library').onclick=()=>window.desktopStartup.library('choose');
document.querySelector('#rollback-library').onclick=()=>window.desktopStartup.library('rollback');
document.querySelector('#cancel-library').onclick=()=>window.desktopStartup.library('cancel');
update();setInterval(update,600);
