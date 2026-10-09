const path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {environment}=require('../desktop/runtime.cjs');const root=path.resolve(__dirname,'..'),resources=process.env.EASEL_TEST_RESOURCES || path.join(root,'build');
const o=environment(resources,path.join(root,'.test-data/media'),path.join(root,'vendor/easel'),12345,12346);
for(const [name,exe,args]of [
 ['Python media imports',o.python,['-c','import cv2,librosa,rembg,onnxruntime,ctranslate2; print("Media imports OK")']],
 ['Bundled Chromium',o.python,['-c','from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); page=b.new_page(); page.set_content("<h1>ElectronEasel</h1>"); assert page.title()==""; print("Browser OK",b.version); b.close(); p.stop()']],
 ['Portable Python CLI',path.join(resources,'runtime/launchers/python3.exe'),['--version']],
 ['Portable Bilibili CLI',path.join(resources,'runtime/launchers/biliup.exe'),['--version']],
 ['FFmpeg',path.join(resources,'runtime/ffmpeg/ffmpeg.exe'),['-version']],
 ['Xiaohongshu selftest',o.python,[path.join(root,'vendor/easel/skills/shared/scripts/xhs_publish.py'),'selftest']],
 ['Bilibili selftest',o.python,[path.join(root,'vendor/easel/skills/shared/scripts/bili_login.py'),'selftest']]
]){const r=cp.spawnSync(exe,args,{env:o.env,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1e6});assert.equal(r.status,0,name+': '+r.stderr+' '+r.error);console.log(name+': '+r.stdout.trim().split('\n').slice(0,2).join(' '));}
