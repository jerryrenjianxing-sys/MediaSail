const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),payload=path.join(root,'build/payload/easel');
assert.ok(payload.startsWith(path.join(root,'build')+path.sep));
for(const relative of ['openclaw/stale-build-fixture.txt','assets/readme/stale-build-fixture.txt','web/static/stale-build-fixture.mp4']){const file=path.join(payload,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'previous full-build artifact');}
cp.execFileSync(process.execPath,[path.join(root,'scripts/stage.cjs')],{cwd:root,windowsHide:true,stdio:'inherit'});
const files=Object.keys(JSON.parse(fs.readFileSync(path.join(root,'build/payload/manifest.json'))).files);
assert.deepEqual(files.filter(p=>p.startsWith('openclaw/')||p.startsWith('assets/readme/')||/^web\/static\/.*\.(mp4|webm|mov)$/i.test(p)),[]);
for(const relative of ['openclaw/stale-build-fixture.txt','assets/readme/stale-build-fixture.txt','web/static/stale-build-fixture.mp4'])assert.equal(fs.existsSync(path.join(payload,relative)),false);
console.log('Previous full-build artifacts cannot re-enter the lightweight payload.');
