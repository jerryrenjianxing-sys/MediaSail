"""Build-time downloads only. Never invoked on an end user's computer."""
from pathlib import Path
import hashlib, json, shutil, sys, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'build' / 'runtime'
LOCK = json.loads((ROOT / 'runtime-lock.json').read_text())

def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        print('Downloading', url, flush=True)
        urllib.request.urlretrieve(url, dest.with_suffix('.partial'))
        dest.with_suffix('.partial').replace(dest)
    return dest

if sys.argv[1] == 'node':
    version = 'v' + LOCK['node']
    name = f'node-{version}-win-x64.zip'
    archive = download(f'https://nodejs.org/dist/{version}/{name}', ROOT / 'build' / 'downloads' / name)
    checksums = urllib.request.urlopen(f'https://nodejs.org/dist/{version}/SHASUMS256.txt').read().decode()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1] == name)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'Node checksum mismatch'
    with zipfile.ZipFile(archive) as z:
        z.extractall(RUNTIME)
    (RUNTIME / name.removesuffix('.zip')).rename(RUNTIME / 'node')
    print('Node verified and extracted', flush=True)

elif sys.argv[1] == 'assets':
    from PIL import Image
    assets = ROOT / 'desktop' / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    # PNG was extracted from the user-approved logo using the built-in image tool.
    # Pillow only encodes the Windows multi-resolution ICO; it does not redraw it.
    source = ROOT / 'branding/MediaSail-app-icon.png'
    shutil.copy2(source, assets / 'icon.png')
    Image.open(source).save(assets / 'icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    public = ROOT / 'vendor/easel/web/frontend/public/assets'
    public.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, public / 'mediasail-icon.png')

elif sys.argv[1] == 'electron':
    version=LOCK['electron'];name=f'electron-v{version}-win32-x64.zip'
    archive=download(f'https://github.com/electron/electron/releases/download/v{version}/{name}',ROOT/'build/downloads'/name)
    expected=json.loads((ROOT/'node_modules/electron/checksums.json').read_text())[name]
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Electron checksum mismatch'
    with zipfile.ZipFile(archive) as z:z.extractall(ROOT/'node_modules/electron/dist')
    (ROOT/'node_modules/electron/path.txt').write_text('electron.exe')
    print('Electron verified and extracted',flush=True)

elif sys.argv[1] == 'ffmpeg':
    source = Path(sys.argv[2])
    expected = json.loads((ROOT / 'ffmpeg-lock.json').read_text())
    for name, checksum in expected.items():
        assert hashlib.sha256((source / 'bin' / name).read_bytes()).hexdigest() == checksum, f'{name}: does not match pinned FFmpeg build'
    dest = RUNTIME / 'ffmpeg'
    dest.mkdir(parents=True, exist_ok=True)
    for name in ['ffmpeg.exe', 'ffprobe.exe']:
        shutil.copy2(source / 'bin' / name, dest / name)
    shutil.copy2(source / 'LICENSE', dest / 'LICENSE')
    shutil.copy2(source / 'README.txt', dest / 'README.txt')
    print('Pinned FFmpeg binaries verified and copied', flush=True)
