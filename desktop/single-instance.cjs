const net=require('node:net'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
function address(key){const user=os.userInfo();const id=crypto.createHash('sha256').update(key||[os.hostname(),user.username,user.homedir].join(':')).digest('hex').slice(0,32);return process.platform==='win32'?'\\\\.\\pipe\\MediaSail-user-'+id:path.join(os.tmpdir(),'mediasail-'+id+'.sock');}
// This pipe only raises an existing window. It accepts no paths or business commands.
async function acquire({key,onRaise=()=>{}}={}){
 const pipe=address(key);const server=net.createServer(socket=>{let bytes='';socket.setTimeout(2000,()=>socket.destroy());socket.on('data',chunk=>{bytes+=chunk.toString('utf8');if(bytes.length>32)return socket.destroy();if(bytes==='raise\n'){try{onRaise();}catch{}socket.end('ok\n');}});socket.on('error',()=>{});});
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipe,()=>{server.removeListener('error',reject);resolve();});});}
 catch(error){
  if(error.code!=='EADDRINUSE')throw error;
  await new Promise((resolve,reject)=>{const socket=net.createConnection(pipe);socket.setTimeout(2500,()=>{socket.destroy();reject(new Error('已有 MediaSail 实例暂未响应。'));});socket.once('connect',()=>socket.write('raise\n'));socket.once('data',()=>{socket.end();resolve();});socket.once('error',reject);});
  return {primary:false,close:async()=>{}};
 }
 server.on('error',()=>{});server.unref();
 return {primary:true,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={acquire,address};
