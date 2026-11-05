"""Assemble corresponding-source assets from verified local inputs; never fetches or publishes."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]

def sha(file):
    digest=hashlib.sha256()
    with Path(file).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    return digest.hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-root',type=Path,required=True)
    parser.add_argument('--crate-sources',type=Path,required=True)
    args=parser.parse_args()
    crate_root=args.crate_sources/'crates'
    if not crate_root.is_dir():raise ValueError('Rust source directory is missing: '+str(crate_root))
    dependencies=json.loads((ROOT/'licenses/browser-tools/BrowserSkill-dependencies.json').read_text('utf8'))
    crate_entries=[]
    for dependency in dependencies['rust']:
        material=dependency.get('sourceArchive')
        if not material:
            if (dependency.get('source') or '').startswith('registry+'):
                raise ValueError('Pinned Rust dependency has no source archive: '+dependency['name'])
            continue
        relative=Path(material['path'])
        if relative.parts[0]!='crates' or len(relative.parts)!=2:
            raise ValueError('Invalid Rust source archive path')
        file=args.crate_sources/relative
        if not file.is_file():raise ValueError('Pinned Rust source is missing: '+relative.as_posix())
        if file.is_symlink() or sha(file)!=material['sha256']:
            raise ValueError('Pinned Rust source hash mismatch: '+relative.as_posix())
        crate_entries.append((file,'rust-sources/'+file.name))
    package=json.loads((ROOT/'package.json').read_text('utf8'));version=package['version']
    out=(ROOT/package['build']['directories']['output']).resolve();out.mkdir(parents=True,exist_ok=True)
    tools=args.audit_root/'source-kit'
    manifest=json.loads((tools/'source-kit-manifest.json').read_text('utf8'))
    mapping=json.loads((tools/'audit-local-input-map.json').read_text('utf8'))
    verification=json.loads((tools/'VERIFICATION.json').read_text('utf8'))
    if verification['status']!='source-preparation-review-passed' or verification['patch_failures']:
        raise ValueError('Source-preparation audit has not passed')
    entries=[]
    for file in tools.iterdir():
        if file.is_file() and file.name!='audit-local-input-map.json':entries.append((file,'chromium/'+file.name))
    for material in manifest['materials']:
        file=Path(mapping[material['id']])
        if file.stat().st_size!=material['bytes'] or sha(file)!=material['sha256']:
            raise ValueError('Source material mismatch: '+material['id'])
        if material['id']!='chromium-base':entries.append((file,'chromium/'+material['relative_path']))
    runtime_root=args.audit_root/'gnu-runtime'
    runtime_manifest=json.loads((runtime_root/'gnu-runtime-materials-manifest.json').read_text('utf8'))
    for material in runtime_manifest['upstream_originals']:
        if not material['file'].startswith('source-archives/'):continue
        file=runtime_root/material['file']
        if file.stat().st_size!=material['bytes'] or sha(file)!=material['sha256']:
            raise ValueError('Runtime source mismatch: '+material['file'])
        entries.append((file,'gnu-runtime/'+material['file']))
    entries.extend(crate_entries)
    for folder,prefix in [(ROOT/'integrations/browserskill','browserskill-adaptation'),(ROOT/'licenses/browser-tools','notices'),(ROOT/'agent-skill/mediasail/scripts','mediasail-entry')]:
        for file in sorted(folder.rglob('*')):
            if not file.is_file() or '__pycache__' in file.parts:continue
            if file.is_symlink():raise ValueError('Unexpected source link: '+str(file))
            entries.append((file,prefix+'/'+file.relative_to(folder).as_posix()))
    entries.extend([(ROOT/'browser-tools.lock.json','browser-tools.lock.json'),(ROOT/'build/browser-source/BrowserSkill-source.zip','BrowserSkill-source.zip'),(out/'chromium-source-parts.json','chromium-source-parts.json')])
    for name in ['prepare-browser-payload.py','browser-dependency-notices.py','verify-browser-source.py']:
        entries.append((ROOT/'scripts'/name,'mediasail-build/'+name))
    text='''# MediaSail browser corresponding sources

This optional developer asset accompanies MediaSail {version}. It is not an additional runtime download.

Download this ZIP and all three chromium-*-source.tar.xz.001/.002/.003 parts from the SAME Release.
Run `python join-chromium.py <directory-containing-parts>` after extracting this ZIP. The script checks
each part and the joined original hash, then writes chromium/materials/chromium-156.0.8078.73.tar.xz.
Read chromium/README.md for offline source preparation, original flags, prerequisites and limitations.
All 137 pinned patches and the complete domain-substitution inputs passed source preparation review.
No complete Chromium recompilation is claimed. Original full sources remain intact in the split archive;
the smaller review tree is only evidence, not a replacement for corresponding source.

BrowserSkill-source.zip is the exact original pinned ZIP used for patch replay. Apply
browserskill-adaptation/mediasail.patch. The product's build steps and fixed extension identity are
documented there; locked Rust dependency .crate sources are in rust-sources. Mediabunny MPL sources
are in chromium/materials/mediabunny-1.61.3.tgz. option-ext MPL source is in rust-sources.
The original source tree and locks preserve the remaining extension source/dependency references.
The original pinned LLVM-MinGW build scripts and MinGW-w64 sources are in gnu-runtime/source-archives;
compiler, LLVM and Rust commits are listed in browser-tools.lock.json and notices/GNU-runtime.

Independent component licenses apply; the main MediaSail source ZIP supplies the rest of the app.
Notices for Microsoft's unchanged d3dcompiler_47.dll do not restrict the open-source portions.
'''.format(version=version)
    join='''import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parent
parts=root/'chromium-source-parts.json'
info=json.loads(parts.read_text('utf8'))
directory=Path(sys.argv[1]).resolve()
destination=root/'chromium/materials'/info['original']
destination.parent.mkdir(parents=True,exist_ok=True)
temporary=destination.with_suffix(destination.suffix+'.joining')
whole=hashlib.sha256()
with temporary.open('xb') as output:
 for part in info['parts']:
  path=directory/part['file'];digest=hashlib.sha256()
  if path.stat().st_size!=part['bytes']:raise ValueError('Part size mismatch: '+path.name)
  with path.open('rb') as source:
   for block in iter(lambda:source.read(1024*1024),b''):
    digest.update(block);whole.update(block);output.write(block)
  if digest.hexdigest()!=part['sha256']:raise ValueError('Part hash mismatch: '+path.name)
if whole.hexdigest()!=info['sha256']:raise ValueError('Joined source hash mismatch')
if destination.exists():raise ValueError('Original already exists; retained verified joined temporary')
temporary.rename(destination)
print(destination)
'''
    asset=out/f'MediaSail-{version}-browser-sources.zip';stage=asset.with_suffix('.zip.partial')
    records=[]
    with zipfile.ZipFile(stage,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        archive.writestr('BrowserSources/README.md',text)
        archive.writestr('BrowserSources/join-chromium.py',join)
        seen=set()
        for file,name in entries:
            if name in seen:raise ValueError('Duplicate source kit destination: '+name)
            seen.add(name);archive.write(file,'BrowserSources/'+name)
            records.append({'path':name,'bytes':file.stat().st_size,'sha256':sha(file)})
        archive.writestr('BrowserSources/files.json',json.dumps(records,indent=2)+'\n')
    with zipfile.ZipFile(stage) as archive:
        if archive.testzip() is not None:raise ValueError('Source-kit ZIP CRC check failed')
    stage.replace(asset)
    record={'schema':1,'version':version,'asset':asset.name,'bytes':asset.stat().st_size,'sha256':sha(asset),'files':len(records),'sourcePreparation':verification['status'],'fullChromiumRebuild':False}
    (out/'browser-source-kit.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
    print(json.dumps(record))

if __name__=='__main__':main()
