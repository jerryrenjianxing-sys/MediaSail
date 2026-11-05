"""Split the verified original Chromium corresponding-source archive for Release assets."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    lock=json.loads((ROOT/'browser-tools.lock.json').read_text('utf8'))
    package=json.loads((ROOT/'package.json').read_text('utf8'))
    output=(args.output or ROOT/package['build']['directories']['output']).resolve()
    output.mkdir(parents=True,exist_ok=True)
    whole=hashlib.sha256();parts=[];part_size=1500*1024*1024
    with args.archive.open('rb') as stream:
        index=1
        while block:=stream.read(1024*1024):
            name=f"chromium-{lock['browser']['version']}-source.tar.xz.{index:03}"
            stage=output/(name+'.partial');digest=hashlib.sha256();size=0
            with stage.open('wb') as target:
                while block:
                    target.write(block);whole.update(block);digest.update(block);size+=len(block)
                    if size>=part_size:break
                    block=stream.read(min(1024*1024,part_size-size))
            parts.append({'file':name,'bytes':size,'sha256':digest.hexdigest()})
            stage.replace(output/name);index+=1
    if whole.hexdigest()!=lock['browser']['sourceSha256']:
        raise ValueError('Original Chromium source SHA-256 mismatch; do not publish these parts')
    record={'schema':1,'original':args.archive.name,'sha256':whole.hexdigest(),'bytes':sum(p['bytes'] for p in parts),'parts':parts}
    (output/'chromium-source-parts.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
    print(json.dumps(record))

if __name__=='__main__':main()
