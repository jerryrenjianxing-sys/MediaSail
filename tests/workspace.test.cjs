const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {syncWorkspace,digest,safe}=require('../desktop/workspace.cjs');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'easel 中文 '));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,payload:path.join(root,'payload'),data:path.join(root,'data')};}
async function pack(f,version,files){const hashes={};for(const [name,text]of Object.entries(files)){const p=path.join(f.payload,'easel',name);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,text);hashes[name]=digest(Buffer.from(text));}await fs.writeFile(path.join(f.payload,'manifest.json'),JSON.stringify({version,files:hashes}));}
test('upgrade preserves profiles, assets, credentials, outputs and unknown files',async t=>{
 const f=await fixture(t);await pack(f,'1',{'app.py':'old','profiles/me/profile.md':'seed','assets/demo.txt':'seed'});const work=await syncWorkspace(f.payload,f.data);
 await fs.writeFile(path.join(work,'profiles/me/profile.md'),'my profile');await fs.writeFile(path.join(work,'.env'),'SECRET=kept');await fs.writeFile(path.join(work,'custom.txt'),'mine');
 await pack(f,'2',{'app.py':'new','profiles/me/profile.md':'new seed','assets/demo.txt':'changed seed'});await syncWorkspace(f.payload,f.data);
 assert.equal(await fs.readFile(path.join(work,'app.py'),'utf8'),'new');assert.equal(await fs.readFile(path.join(work,'profiles/me/profile.md'),'utf8'),'my profile');assert.equal(await fs.readFile(path.join(work,'.env'),'utf8'),'SECRET=kept');assert.equal(await fs.readFile(path.join(work,'custom.txt'),'utf8'),'mine');assert.equal(await fs.readFile(path.join(work,'assets/demo.txt'),'utf8'),'seed');
});
test('modified code is backed up and removed user-modified files are retained',async t=>{
 const f=await fixture(t);await pack(f,'1',{'app.py':'old','retired.py':'old','gone.py':'old'});const work=await syncWorkspace(f.payload,f.data);await fs.writeFile(path.join(work,'app.py'),'custom code');await fs.writeFile(path.join(work,'retired.py'),'custom');await pack(f,'2',{'app.py':'new'});await syncWorkspace(f.payload,f.data);
 assert.equal(await fs.readFile(path.join(f.data,'upgrade-backups/2/app.py'),'utf8'),'custom code');assert.equal(await fs.readFile(path.join(work,'retired.py'),'utf8'),'custom');await assert.rejects(fs.stat(path.join(work,'gone.py')),{code:'ENOENT'});
});
test('reject traversal and corrupted payload before writing destination',async t=>{
 const f=await fixture(t);assert.throws(()=>safe(f.data,'../escape'));await pack(f,'1',{'app.py':'good'});await fs.writeFile(path.join(f.payload,'easel/app.py'),'corrupted');await assert.rejects(syncWorkspace(f.payload,f.data),/校验失败/);
});
test('clean install creates writable directories without Git placeholders',async t=>{
 const f=await fixture(t);await pack(f,'2',{'app.py':'code'});
 const work=await syncWorkspace(f.payload,f.data);
 for(const name of ['assets','outputs','profiles'])assert.ok((await fs.stat(path.join(work,name))).isDirectory());
 await fs.writeFile(path.join(work,'outputs/中文成品.txt'),'kept');
 await syncWorkspace(f.payload,f.data);
 assert.equal(await fs.readFile(path.join(work,'outputs/中文成品.txt'),'utf8'),'kept');
});
