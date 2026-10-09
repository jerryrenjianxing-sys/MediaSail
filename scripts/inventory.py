from pathlib import Path
import importlib.metadata, json, hashlib, subprocess
root=Path(__file__).resolve().parents[1]; dest=root/'licenses';dest.mkdir(exist_ok=True)
python=[]
for d in importlib.metadata.distributions():
    python.append({'name':d.metadata['Name'],'version':d.version,'license':d.metadata.get('License-Expression') or d.metadata.get('License'),'source':d.metadata.get('Home-page'),'projectUrls':d.metadata.get_all('Project-URL',[])})
(dest/'python-packages.json').write_text(json.dumps(python,ensure_ascii=False,indent=2),encoding='utf8')
packages=[]
for p in (root/'build/runtime/node').rglob('package.json'):
    if p.parent.name.startswith('.'):continue
    try:
        d=json.loads(p.read_text(encoding='utf8'))
        if d.get('name') and d.get('version'):packages.append({'name':d['name'],'version':d['version'],'license':d.get('license'),'repository':d.get('repository'),'path':p.relative_to(root/'build/runtime/node').as_posix()})
    except (OSError,ValueError):pass
(dest/'node-packages.json').write_text(json.dumps(packages,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Inventoried {len(python)} Python distributions and {len(packages)} npm package manifests',flush=True)
subprocess.run([str(root/'build/runtime/node/node.exe'),str(root/'scripts/inventory-runtime.cjs')],check=True)
