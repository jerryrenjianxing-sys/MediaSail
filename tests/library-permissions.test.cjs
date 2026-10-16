const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const library=require('../desktop/library.cjs');
test('Windows ACL write denial refuses fresh and existing libraries before changing the current pointer',{skip:process.platform!=='win32'},async t=>{
 const base=path.resolve(__dirname,'../.test-data');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'library-acl-'));
 assert.equal(path.dirname(root),base,'Only a dedicated task fixture may have its ACL changed');
 const sid='*'+cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();assert.match(sid,/^\*S-1-\d+(?:-\d+)+$/);
 const protectedPaths=[];
 function acl(target,args){assert.ok(target.startsWith(root+path.sep),'ACL target escaped fixture');const result=cp.spawnSync('icacls.exe',[target,...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr||result.stdout);}
 t.after(async()=>{for(const target of protectedPaths)acl(target,['/remove:d',sid,'/T','/Q']);assert.equal(path.dirname(path.resolve(root)),base);await fs.rm(root,{recursive:true,force:true});});
 const options={bootstrapRoot:path.join(root,'bootstrap'),installDirectory:path.join(root,'program')};
 const chosen=await library.chooseLibrary({...options,targetRoot:path.join(root,'current')});const pointer=await fs.readFile(path.join(options.bootstrapRoot,library.LOCATION));
 const fresh=path.join(root,'fresh-readonly');await fs.mkdir(fresh);protectedPaths.push(fresh);acl(fresh,['/deny',sid+':(OI)(CI)(W)','/Q']);
 await assert.rejects(library.chooseLibrary({...options,targetRoot:fresh}),/EACCES|EPERM|权限|拒绝|写入/i);assert.deepEqual(await fs.readFile(path.join(options.bootstrapRoot,library.LOCATION)),pointer);acl(fresh,['/remove:d',sid,'/T','/Q']);assert.deepEqual(await fs.readdir(fresh),[]);
 const existing=await library.chooseLibrary({bootstrapRoot:path.join(root,'other-bootstrap'),installDirectory:options.installDirectory,targetRoot:path.join(root,'existing')});
 protectedPaths.push(existing.libraryRoot);acl(existing.libraryRoot,['/deny',sid+':(OI)(CI)(W)','/Q']);
 await assert.rejects(library.chooseLibrary({...options,targetRoot:existing.libraryRoot}),/EACCES|EPERM|权限|拒绝|写入/i);assert.deepEqual(await fs.readFile(path.join(options.bootstrapRoot,library.LOCATION)),pointer);assert.equal(library.readLocation(options).libraryId,chosen.libraryId);
});
