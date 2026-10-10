"""Initialize an isolated Easel profile, without upstream's global installers."""
import json, os, shutil, subprocess, _winapi
from pathlib import Path
from branding import sync_defaults, without_runtime_root

def write_json(file, value):
    temp=file.with_suffix('.desktop-tmp'); temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8'); temp.replace(file)

def junction(link, target):
    if link.exists():
        if link.resolve() != target.resolve(): raise RuntimeError(f'工作目录链接与预期不同：{link}')
        return
    # Directory junctions need no administrator rights or developer-mode symlink support.
    _winapi.CreateJunction(str(target),str(link))

def prepare(root):
    state=Path(os.environ['EASEL_OPENCLAW_STATE_DIR']); state.mkdir(parents=True,exist_ok=True)
    workspace=Path(os.environ['EASEL_OPENCLAW_WORKSPACE']); workspace.mkdir(parents=True,exist_ok=True)
    for name in ('profiles','outputs','assets'): (root/name).mkdir(exist_ok=True)
    if not (root/'.env').exists(): shutil.copy2(root/'.env.example',root/'.env')
    for name,target in [('skills',root/'skills/openclaw'),('shared',root/'skills/shared'),('easel-profiles',root/'profiles'),('outputs',root/'outputs')]: junction(workspace/name,target)
    sync_defaults(root/'openclaw/workspace', workspace)
    context=f'# MediaSail 项目路径\n\n项目根目录：{root}\n产物输出到：{root / "outputs"}\n用户素材在：{root / "assets"}\n用户画像在：{root / "profiles"}\n'
    (workspace/'CONTEXT.md').write_text(context,encoding='utf8')
    agents=workspace/'AGENTS.md'
    text=without_runtime_root(agents.read_text(encoding='utf8'))
    agents.write_text(text+f'\n## 运行时项目根\n\n`{root}`\n',encoding='utf8')
    config=state/'openclaw.json'
    value=json.loads(config.read_text(encoding='utf8')) if config.exists() else {}
    gateway=value.setdefault('gateway',{})
    gateway.update(mode='local',bind='loopback',port=int(os.environ['OPENCLAW_GATEWAY_PORT']))
    gateway['auth']={'mode':'none'}
    gateway.setdefault('http',{}).setdefault('endpoints',{}).setdefault('chatCompletions',{})['enabled']=True
    defaults=value.setdefault('agents',{}).setdefault('defaults',{})
    defaults['workspace']=str(workspace); defaults.setdefault('timeoutSeconds',7200)
    value.setdefault('tools',{}).setdefault('profile','full')
    value.setdefault('memory',{}).setdefault('search',{}).setdefault('enabled',False)
    write_json(config,value)
