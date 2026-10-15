const path=require('node:path'),cp=require('node:child_process'),pkg=require('../package.json');
const root=path.resolve(__dirname,'..');
cp.execFileSync(process.execPath,[require.resolve('electron-builder/out/cli/cli.js'),'--win','nsis','--x64','--publish','never','--prepackaged',path.resolve(root,pkg.build.directories.output,'win-unpacked')],{cwd:root,env:process.env,windowsHide:true,stdio:'inherit'});
