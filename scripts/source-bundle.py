from pathlib import Path
import json, zipfile
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
out=root.parent.parent/f'outputs/MediaSail/MediaSail-{version}-source.zip'
out.parent.mkdir(parents=True,exist_ok=True)
files=[]
for name in ['package.json','package-lock.json','runtime-lock.json','ffmpeg-lock.json','openclaw-shrinkwrap.json','requirements.lock','constraints.txt','README.md','.gitignore','.gitattributes','LICENSE','NOTICE']:
    files.append(root/name)
for name in ['desktop','bridge','scripts','tests','patches','licenses','branding','docs','.github']:
    files.extend(p for p in (root/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
manifest=json.loads((root/'build/payload/manifest.json').read_text())
files.extend(root/'vendor/easel'/name for name in manifest['files'])
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
    archive.writestr('MediaSail/upstream-files.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    for p in files:archive.write(p,Path('MediaSail')/p.relative_to(root))
print(out, out.stat().st_size)
