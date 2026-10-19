// Verify the exact packaged desktop source, not an empty path-filtered subset.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),output=path.resolve(root,pkg.build.directories.output),resources=path.join(output,'win-unpacked/resources'),archive=path.join(resources,'app.asar');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())walk(file);else if(entry.isFile())files.push(path.relative(root,file));}}
walk(path.join(root,'desktop'));assert.ok(files.length>=20,'A meaningful desktop file set is required');
for(const file of files)assert.deepEqual(asar.extractFile(archive,file),fs.readFileSync(path.join(root,file)),'Packaged desktop differs: '+file);
const names=asar.listPackage(archive).map(file=>file.split(path.sep).filter(Boolean).join('/'));
assert.ok(names.includes('desktop/actions.cjs'));
assert.ok(!names.some(file=>file.startsWith('desktop/aitoearn/')),'Removed website adapter must not be shipped');
const packed=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
for(const key of ['name','version','main','dependencies'])assert.deepEqual(packed[key],pkg[key]);
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(fs.readFileSync(path.join(resources,'licenses/THIRD-PARTY-NOTICES.txt'),'utf8'),fs.readFileSync(path.join(root,'licenses/THIRD-PARTY-NOTICES.txt'),'utf8'));
const report={version:pkg.version,passed:true,verifiedAt:new Date().toISOString(),desktopFiles:files.length,desktopFilesByteMatched:files.map(file=>file.split(path.sep).join('/')),appAsarSha256:sha256(archive),payloadManifestSha256:sha256(path.join(root,'build/payload/manifest.json')),removedAitoAdapterAbsent:true,packageFieldsMatched:['name','version','main','dependencies'],thirdPartyNoticeMatched:true};
const destination=path.join(root,'docs/evidence','desktop-package-'+pkg.version+'.json');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2));console.log('Desktop package verified: '+files.length+' actual files match; no old AitoEarn runtime');
