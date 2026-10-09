async function update(){const s=await window.desktopStartup.status();document.querySelector('#message').textContent=s.message;document.querySelector('#actions').hidden=!s.error;document.querySelector('.hint').hidden=s.error;}
document.querySelector('#retry').onclick=()=>window.desktopStartup.retry();
document.querySelector('#logs').onclick=()=>window.desktopStartup.logs();
update();setInterval(update,600);
