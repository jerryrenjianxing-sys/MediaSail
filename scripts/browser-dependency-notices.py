"""Collect notices from the exact locked BrowserSkill build, without fetching dependencies."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tomllib

def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def license_files(directory):
    result=[]
    for file in directory.rglob('*'):
        if any(part in ('node_modules','.git','target','tests','test','examples') for part in file.relative_to(directory).parts[:-1]):
            continue
        if file.is_file() and re.match(r'^(licen[cs]e|copying|copyright|notice|unlicen[cs]e)([._-]|$)',file.name,re.I):
            result.append(file)
    return sorted(result)

def node_package(start,name):
    for parent in (start,*start.parents):
        file=parent/'node_modules'/name/'package.json'
        if file.is_file():
            return file.resolve()
    raise ValueError(f'Missing installed production package {name} from {start}')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True)
    parser.add_argument('--cargo-metadata',required=True)
    parser.add_argument('--cargo-home',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--source-output',required=True)
    args=parser.parse_args()
    source=Path(args.source).resolve();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    source_out=Path(args.source_output);source_out.mkdir(parents=True,exist_ok=True)
    metadata=json.loads(Path(args.cargo_metadata).read_text('utf-8-sig'))
    locked=tomllib.loads((source/'Cargo.lock').read_text('utf8'))
    checksums={(p['name'],p['version']):p.get('checksum') for p in locked['package']}
    crates={file.name:file for file in Path(args.cargo_home).glob('registry/cache/*/*.crate')}
    inventory=[];text=['BrowserSkill adapted build — dependency notices',
        'Includes locked production and build-time Rust packages. Inclusion does not assert every package is linked.',
        'Original license files follow; the corresponding .crate sources are in the Browser Sources kit.\n']
    for package in sorted(metadata['packages'],key=lambda p:(p['name'],p['version'])):
        directory=Path(package['manifest_path']).parent
        files=license_files(directory)
        text.append(f"\n{'='*72}\n{package['name']} {package['version']}\nDeclared license: {package['license']}\nRepository: {package.get('repository') or ''}\n")
        record={key:package.get(key) for key in ('name','version','license','repository','source')}
        record['notices']=[]
        for file in files:
            relative=file.relative_to(directory).as_posix()
            text.append(f'--- {relative} ---\n'+file.read_text('utf8',errors='replace'))
            record['notices'].append({'path':relative,'sha256':digest(file)})
        if package.get('source','') and package['source'].startswith('registry+'):
            name=f"{package['name']}-{package['version']}.crate"
            archive=crates.get(name)
            if not archive or digest(archive)!=checksums[(package['name'],package['version'])]:
                raise ValueError('Missing or mismatched locked crate: '+name)
            target=source_out/'crates'/name;target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(archive,target)
            record['sourceArchive']={'path':'crates/'+name,'sha256':digest(target)}
        if not files and package.get('source'):
            raise ValueError(f"No notice file for Rust package {package['name']}")
        inventory.append(record)
    (out/'BrowserSkill-Rust-NOTICES.txt').write_text('\n'.join(text),encoding='utf8')
    npm=[];seen=set();missing=[];queue=[source/'apps/extension/package.json'];npm_text=['BrowserSkill extension — installed production dependency notices\n']
    while queue:
        file=queue.pop(0).resolve();package=json.loads(file.read_text('utf8'))
        identity=(package['name'],package.get('version','workspace'))
        if identity in seen:continue
        seen.add(identity);directory=file.parent
        record={key:package.get(key) for key in ('name','version','license','repository')}
        files=license_files(directory) if 'node_modules' in directory.parts else []
        npm_text.append(f"\n{'='*72}\n{identity[0]} {identity[1]}\nDeclared license: {package.get('license','workspace root MIT')}\n")
        record['notices']=[]
        for notice in files:
            name=notice.relative_to(directory).as_posix()
            npm_text.append(f'--- {name} ---\n'+notice.read_text('utf8',errors='replace'))
            record['notices'].append({'path':name,'sha256':digest(notice)})
        if not files and not package['name'].startswith('@browser-skill/'):
            if package['name']=='@remixicon/react':
                npm_text.append('See RemixIcon-LICENSE.txt (fixed official license snapshot).')
            else:
                override=out/'npm'/(package['name'].replace('/','_')+'-'+package['version']+'.txt')
                if override.is_file():
                    npm_text.append(override.read_text('utf8'))
                    record['notices'].append({'path':'npm/'+override.name,'sha256':digest(override)})
                else:missing.append(record)
        npm.append(record)
        dependencies={**package.get('dependencies',{}),**package.get('optionalDependencies',{})}
        for name in dependencies:
            try:queue.append(node_package(directory,name))
            except ValueError:
                if name not in package.get('optionalDependencies',{}):raise
    (out/'BrowserSkill-Extension-NOTICES.txt').write_text('\n'.join(npm_text),encoding='utf8')
    (out/'BrowserSkill-dependencies.json').write_text(json.dumps({'rust':inventory,'extension':sorted(npm,key=lambda p:p['name'])},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    if missing:
        (source_out/'missing-npm-notices.json').write_text(json.dumps(missing,indent=2)+'\n',encoding='utf8')
        raise ValueError('Missing production notices: '+', '.join(p['name']+'@'+p['version'] for p in missing))
    print(json.dumps({'rustPackages':len(inventory),'extensionPackages':len(npm),'sources':str(source_out)}))

if __name__=='__main__':main()
