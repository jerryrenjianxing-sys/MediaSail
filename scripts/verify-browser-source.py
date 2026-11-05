"""Prepare a pinned source fixture explicitly; replay checks never download or rewrite source."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import urllib.request
import uuid
import zipfile

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'build/browser-source/BrowserSkill-source.zip'

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-from')
    parser.add_argument('--download',action='store_true')
    args=parser.parse_args()
    lock=json.loads((ROOT/'browser-tools.lock.json').read_text('utf8'))['bsk']
    expected=lock['sourceSha256']
    if args.prepare_from or args.download:
        ARCHIVE.parent.mkdir(parents=True,exist_ok=True)
        if ARCHIVE.is_file() and sha(ARCHIVE)==expected:
            print('Pinned BrowserSkill source fixture already prepared');return
        stage=ARCHIVE.with_name(ARCHIVE.name+'.'+uuid.uuid4().hex+'.partial')
        if args.prepare_from:shutil.copyfile(args.prepare_from,stage)
        else:
            with urllib.request.urlopen(lock['sourceUrl'],timeout=45) as stream,stage.open('xb') as output:
                shutil.copyfileobj(stream,output)
        if sha(stage)!=expected:raise ValueError('BrowserSkill source SHA-256 does not match the lock; partial retained')
        stage.replace(ARCHIVE);print('Prepared pinned BrowserSkill source fixture');return
    if not ARCHIVE.is_file():
        raise ValueError('Prepare BrowserSkill source first: python scripts/verify-browser-source.py --download (or --prepare-from <archive>)')
    if sha(ARCHIVE)!=expected:raise ValueError('Pinned BrowserSkill source fixture is damaged')
    inventory=json.loads((ROOT/'integrations/browserskill/adapted-files.json').read_text('utf8'))
    if inventory['upstream']!=lock['sourceCommit']:raise ValueError('BrowserSkill patch identity differs from lock')
    with tempfile.TemporaryDirectory(prefix='MediaSailBrowserSource-') as temporary:
        tree=Path(temporary)
        with zipfile.ZipFile(ARCHIVE) as archive:
            roots={PurePosixPath(item.filename).parts[0] for item in archive.infolist()}
            if len(roots)!=1:raise ValueError('Unexpected BrowserSkill source archive layout')
            prefix=next(iter(roots))+'/'
            for name in inventory['files']:
                relative=PurePosixPath(name)
                if relative.is_absolute() or '..' in relative.parts or ':' in name:raise ValueError('Invalid source patch path')
                file=tree/relative;file.parent.mkdir(parents=True,exist_ok=True)
                file.write_bytes(archive.read(prefix+name))
        patch=ROOT/'integrations/browserskill/mediasail.patch'
        for arguments in (['apply','--check',str(patch)],['apply',str(patch)]):
            subprocess.run(['git','-c','core.autocrlf=false',*arguments],cwd=tree,check=True,capture_output=True)
        for name,expected_hash in inventory['files'].items():
            if sha(tree/name)!=expected_hash:raise ValueError('BrowserSkill adapted source mismatch: '+name)
    print(f"BrowserSkill pinned patch replay passed: {len(inventory['files'])} adapted files")

if __name__=='__main__':main()
