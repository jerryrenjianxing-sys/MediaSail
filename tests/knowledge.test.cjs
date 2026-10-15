const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {curatePayload,neutralize}=require('../scripts/curate-knowledge.cjs');
const policy=require('../scripts/knowledge-policy.cjs');
test('curated knowledge preserves business scripts and full methods, retires generic implementations',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail 知识 test ')),payload=path.join(folder,'payload'),source=path.resolve(__dirname,'../vendor/easel');
 try{
  fs.mkdirSync(path.join(payload,'easel'),{recursive:true});
  fs.cpSync(path.join(source,'skills'),path.join(payload,'easel/skills'),{recursive:true});
  fs.writeFileSync(path.join(payload,'manifest.json'),JSON.stringify({upstream:'fixture',version:'test',files:{}}));
  const result=curatePayload({payloadRoot:payload,sourceRoot:source});
  assert.equal(result.keptScripts.length,policy.keptScripts.length);
  const root=path.join(payload,'easel'),index=JSON.parse(fs.readFileSync(path.join(root,'skills/knowledge-index.json')));
  for(const entry of index){assert.ok(fs.existsSync(path.join(root,entry.document)));assert.ok(!policy.RETIRED_SKILLS.has(entry.name));}
  for(const rel of result.keptScripts){
   if(rel.endsWith('skill-wechat-publisher/scripts/publish.py'))continue;
   assert.deepEqual(fs.readFileSync(path.join(root,rel)),fs.readFileSync(path.join(source,rel)),rel);
  }
  assert.ok(!fs.existsSync(path.join(root,'skills/openclaw/video-production/vendor/video-pipeline-sdk/pipeline/run.py')));
  for(const rel of ['video-production/references/design-baseline.md','video-production/references/quality-mechanisms.md','skill-social-performance-review/references/analysis-framework.md','skill-profile-builder/references/social-link-analysis.md'])assert.ok(fs.readFileSync(path.join(root,'skills/openclaw',rel),'utf8').length>500,rel);
  const review=fs.readFileSync(path.join(root,'skills/openclaw/skill-social-performance-review/SKILL.md'),'utf8');
  assert.match(review,/25%/);assert.match(review,/重新归一化/);assert.match(review,/自己的工具/);
  assert.match(review,/\[业务工具清单\]\(\.\.\/\.\.\/business-tools\.md\)/);
  assert.ok(fs.existsSync(path.join(root,'skills/openclaw/video-production/references/upstream-sdk-LICENSE.txt')));
  const manifest=JSON.parse(fs.readFileSync(path.join(payload,'manifest.json')));
  for(const [rel,hash]of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex'),hash,rel);
  for(const rel of Object.keys(manifest.files).filter(p=>p.endsWith('.md'))){
   const doc=fs.readFileSync(path.join(root,rel),'utf8');
   for(const match of doc.matchAll(/!?\[[^\]]+\]\(([^)]+)\)/g)){
    const href=match[1];if(/^(?:https?:|#|mailto:|data:)/.test(href)||href.includes('<'))continue;
    const target=decodeURI(href.split('#')[0]);if(target)assert.ok(fs.existsSync(path.resolve(root,path.dirname(rel),target)),rel+' -> '+href);
   }
  }
  assert.throws(()=>curatePayload({payloadRoot:path.dirname(source),sourceRoot:source}),/overlaps|Missing/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('neutralization retains data/formulas and retires legacy execution commands',()=>{
 const body=neutralize('# 方法\n\n比率=收藏/点赞，缺值不补零。\n\n```json\n{"likes":10,"saves":2}\n```\n\n```bash\npython skills/shared/scripts/ai_image.py --prompt "a"\n```',{method:true});
 assert.match(body,/收藏\/点赞/);assert.match(body,/"likes":10/);assert.doesNotMatch(body,/python skills/);
});
