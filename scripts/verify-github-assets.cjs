// Verify GitHub's server-computed digests and preserve all previous release assets.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,require('../package.json').build.directories.output),version=require('../package.json').version;
const snapshot=path.join(root,'.test-data','release-assets-before-'+version+'.json');
const releases=JSON.parse(cp.execFileSync('gh',['api','repos/jerryrenjianxing-sys/MediaSail/releases','--paginate'],{encoding:'utf8',maxBuffer:20e6}));
const old=releases.filter(r=>r.tag_name!=='v'+version).map(r=>({tag:r.tag_name,assets:r.assets.map(a=>({id:a.id,name:a.name,size:a.size,digest:a.digest})).sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.tag.localeCompare(b.tag));
async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return 'sha256:'+h.digest('hex');}
(async()=>{
 if(process.argv.includes('--snapshot')){assert.ok(!fs.existsSync(snapshot),'Snapshot already exists');fs.writeFileSync(snapshot,JSON.stringify(old,null,2));console.log('Recorded '+old.length+' old releases');return;}
 assert.deepEqual(old,JSON.parse(fs.readFileSync(snapshot,'utf8')),'Old release assets changed');
 const current=releases.find(r=>r.tag_name==='v'+version);assert.ok(current);
 const names=['MediaSail-'+version+'-win-x64-Setup.exe','MediaSail-'+version+'-win-x64-Setup.exe.blockmap','MediaSail-'+version+'-source.zip','latest.yml','SHA256SUMS.txt'];
 const assets=[];
 for(const name of names){const asset=current.assets.find(a=>a.name===name);assert.ok(asset,name);assert.equal(asset.size,fs.statSync(path.join(out,name)).size);assert.equal(asset.digest,await hash(path.join(out,name)));assets.push({name,size:asset.size,digest:asset.digest});}
 const report={version,draft:current.draft,verifiedAt:new Date().toISOString(),preservedVersions:old.map(r=>r.tag),assets};
 fs.mkdirSync(path.join(root,'docs/evidence'),{recursive:true});fs.writeFileSync(path.join(root,'docs/evidence','assets-'+version+'.json'),JSON.stringify(report,null,2));console.log('All five assets match; all '+old.length+' older releases preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
