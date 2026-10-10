// Release-upload courier only; never bundled or used by the application updater.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
function read(fd,start,length){const b=Buffer.alloc(length);let n=0;while(n<length){const k=fs.readSync(fd,b,n,length-n,start+n);assert.ok(k>0,'Unexpected EOF');n+=k;}return b;}
async function apply(planFile,baseFile,output){
 const p=JSON.parse(zlib.gunzipSync(fs.readFileSync(planFile)));assert.equal(p.format,1);assert.match(p.target.name,/^MediaSail-\d+\.\d+\.\d+-win-x64-Setup\.exe$/);assert.equal(path.basename(output),p.target.name);
 assert.equal(await hash(baseFile),p.base.sha256,'Base SHA-256');assert.equal(fs.statSync(baseFile).size,p.base.size);
 const source=fs.openSync(baseFile,'r'),dest=fs.openSync(output,'wx');let size=0;
 try{for(const op of p.operations){if(op.copy){const [start,length]=op.copy;assert.ok(Number.isSafeInteger(start)&&Number.isSafeInteger(length)&&start>=0&&length>0&&start+length<=p.base.size);for(let pos=0;pos<length;pos+=1024*1024){const bytes=read(source,start+pos,Math.min(1024*1024,length-pos));fs.writeSync(dest,bytes);size+=bytes.length;}}else{const bytes=Buffer.from(op.data,'base64');fs.writeSync(dest,bytes);size+=bytes.length;}assert.ok(size<=p.target.size);}}finally{fs.closeSync(source);fs.closeSync(dest);}
 assert.equal(size,p.target.size);assert.equal(await hash(output),p.target.sha256,'Reconstructed SHA-256');console.log(JSON.stringify({verified:true,bytes:size,sha256:p.target.sha256}));return p;
}
(async()=>{
 const [mode,a,b,c]=process.argv.slice(2);
 if(mode==='apply'){await apply(a,b,c);return;}
 assert.equal(mode,'create');const oldFile=path.resolve(a),newFile=path.resolve(b),planFile=path.resolve(c);
 const {computeOperations}=require('electron-updater/out/differentialDownloader/downloadPlanBuilder');
 const maps=[oldFile,newFile].map(f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f+'.blockmap'))));assert.equal(maps[0].version,maps[1].version);assert.equal(maps[1].files.length,1);assert.equal(maps[1].files[0].offset,0);
 const operations=computeOperations(maps[0],maps[1],{info:()=>{},warn:()=>{}}),fd=fs.openSync(newFile,'r');let covered=0,literal=0;
 const p={format:1,base:{name:path.basename(oldFile),size:fs.statSync(oldFile).size,sha256:await hash(oldFile)},target:{name:path.basename(newFile),size:fs.statSync(newFile).size,sha256:await hash(newFile)},operations:[]};
 try{for(const op of operations){const size=op.end-op.start;covered+=size;if(op.kind===0)p.operations.push({copy:[op.start,size]});else{literal+=size;p.operations.push({data:read(fd,op.start,size).toString('base64')});}}}finally{fs.closeSync(fd);}
 assert.equal(covered,p.target.size);fs.writeFileSync(planFile,zlib.gzipSync(JSON.stringify(p),{level:1}),{flag:'wx'});console.log(JSON.stringify({targetBytes:covered,literalBytes:literal,courierBytes:fs.statSync(planFile).size,targetSha256:p.target.sha256}));
})().catch(e=>{console.error(e);process.exitCode=1;});
