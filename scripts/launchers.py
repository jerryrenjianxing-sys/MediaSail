from pathlib import Path
import importlib.metadata, shutil, subprocess
root=Path(__file__).resolve().parents[1]
dest=root/'build/runtime/launchers';dest.mkdir(parents=True,exist_ok=True)
csc=Path('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe')
subprocess.run([str(csc),'/nologo','/target:exe','/platform:x64',f'/out:{dest / "python3.exe"}',str(root/'scripts/PortableLauncher.cs')],check=True)
for name in {'easel','pip','pip3','python'} | {e.name for e in importlib.metadata.entry_points(group='console_scripts')}:
    if name!='python3':shutil.copy2(dest/'python3.exe',dest/f'{name}.exe')
print('Portable command launchers created')
