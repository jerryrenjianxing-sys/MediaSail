"""Build local, immutable browser-tool resources; never reads a user profile."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import struct
import subprocess
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def sha(file):
    digest = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

def plain(file):
    file = Path(file)
    for part in (file, *file.parents):
        if part.exists() and (part.is_symlink() or getattr(part.stat(), 'st_file_attributes', 0) & 0x400):
            raise ValueError(f'Unexpected link in build input: {part}')
    return file

def relative(name):
    name = name.replace('\\', '/')
    value = PurePosixPath(name)
    if not name or value.is_absolute() or ':' in name or any(part in ('..', '') for part in value.parts):
        raise ValueError(f'Unsafe resource path: {name}')
    return name

def imports(file):
    """PE imports: reject an unexpected separate VC runtime requirement."""
    data = Path(file).read_bytes()
    pe, = struct.unpack_from('<I', data, 0x3c)
    if data[pe:pe+4] != b'PE\0\0' or struct.unpack_from('<H', data, pe+4)[0] != 0x8664:
        raise ValueError('BrowserSkill must be a Windows x64 executable')
    count, = struct.unpack_from('<H', data, pe+6)
    optional = pe+24
    optional_size, = struct.unpack_from('<H', data, pe+20)
    if struct.unpack_from('<H', data, optional)[0] != 0x20b:
        raise ValueError('Expected a PE32+ executable')
    sections = [struct.unpack_from('<IIII', data, optional+optional_size+i*40+8) for i in range(count)]
    def offset(rva):
        for virtual_size, virtual_address, raw_size, raw in sections:
            if virtual_address <= rva < virtual_address+max(virtual_size, raw_size):
                return raw+rva-virtual_address
        raise ValueError('Unreadable PE import table')
    rva, = struct.unpack_from('<I', data, optional+112+8)
    result = []
    if rva:
        pos = offset(rva)
        while any(data[pos:pos+20]):
            name_rva, = struct.unpack_from('<I', data, pos+12)
            start = offset(name_rva)
            result.append(data[start:data.index(b'\0', start)].decode('ascii'))
            pos += 20
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser-archive', required=True)
    parser.add_argument('--bsk', required=True)
    parser.add_argument('--extension', required=True)
    parser.add_argument('--notices', required=True)
    args = parser.parse_args()
    lock = json.loads((ROOT/'browser-tools.lock.json').read_text('utf8'))
    browser = plain(args.browser_archive)
    if sha(browser) != lock['browser']['sha256']:
        raise ValueError('Pinned browser archive SHA-256 mismatch')
    bsk = plain(args.bsk)
    if sha(bsk)!=lock['bsk']['binarySha256']:
        raise ValueError('BrowserSkill binary SHA-256 differs from the reviewed release build')
    dependencies = imports(bsk)
    system={'kernel32.dll','ntdll.dll','advapi32.dll','bcrypt.dll','bcryptprimitives.dll','crypt32.dll','shell32.dll','ole32.dll','ws2_32.dll','userenv.dll','user32.dll','dbghelp.dll','msvcrt.dll','ucrtbase.dll'}
    if any(name.lower() not in system and not name.lower().startswith(('api-ms-win-','ext-ms-win-')) for name in dependencies):
        raise ValueError('BrowserSkill requires an unbundled runtime DLL: '+str(dependencies))
    identity=json.loads(subprocess.check_output([str(bsk),'mediasail-info','--json'],timeout=20,text=True,encoding='utf8'))
    if identity!={'product':'MediaSailBrowserSkill','version':lock['bsk']['version'],'build':lock['bsk']['build'],'protocol':lock['bsk']['protocol'],'target':lock['bsk']['target'],'managed':True}:
        raise ValueError('BrowserSkill is not the pinned MediaSail adapted build')
    output = ROOT/'build/browser-tools'
    stage = ROOT/'build'/('browser-tools.staging-'+uuid.uuid4().hex)
    stage.mkdir(parents=True)
    shutil.copyfile(browser, stage/'browser.zip')
    shutil.copyfile(bsk, stage/'bsk.exe')
    cache_files = []
    with zipfile.ZipFile(browser) as archive:
        seen = set()
        for item in archive.infolist():
            if item.is_dir():
                continue
            name = relative(item.filename)
            if name.lower() in seen or stat.S_IFMT(item.external_attr >> 16) == stat.S_IFLNK:
                raise ValueError('Unexpected duplicate or linked browser resource')
            seen.add(name.lower())
            digest = hashlib.sha256()
            with archive.open(item) as stream:
                for block in iter(lambda: stream.read(1024*1024), b''):
                    digest.update(block)
            cache_files.append({'path':'browser/'+name, 'sha256':digest.hexdigest()})
    extension = plain(args.extension)
    manifest_file = extension/'manifest.json'
    manifest = json.loads(manifest_file.read_text('utf8'))
    if manifest['version'] != lock['bsk']['version']:
        raise ValueError('BrowserSkill extension version mismatch')
    extension_identity=json.loads((extension/'mediasail-build.json').read_text('utf8'))
    if extension_identity!={'product':'MediaSailBrowserSkill','version':lock['bsk']['version'],'build':lock['bsk']['build'],'managed':True}:
        raise ValueError('BrowserSkill extension is not the pinned adapted build')
    manifest.update(name='BrowserSkill for MediaSail', version_name='0.4.1 MediaSail build 1', key=(ROOT/'integrations/browserskill/extension-key.txt').read_text('ascii').strip())
    public_key = __import__('base64').b64decode(manifest['key'])
    extension_id = ''.join(chr(ord('a')+int(c,16)) for c in hashlib.sha256(public_key).hexdigest()[:32])
    if extension_id != lock['bsk']['extensionId']:
        raise ValueError('Extension identity does not match the lock')
    with zipfile.ZipFile(stage/'extension.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(extension.rglob('*')):
            if not file.is_file():
                continue
            plain(file)
            name = relative(file.relative_to(extension).as_posix())
            if name == 'mediasail-bootstrap.json':
                raise ValueError('Private browser launch state must not enter a distribution')
            content = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode('utf8') if name == 'manifest.json' else file.read_bytes())
            info = zipfile.ZipInfo(name, (1980,1,1,0,0,0));info.external_attr=0o644 << 16
            archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED)
            cache_files.append({'path':'extension/'+name, 'sha256':hashlib.sha256(content).hexdigest()})
    helpers = []
    inputs = [(ROOT/'agent-skill/mediasail/scripts'/name, name) for name in ('browser.ps1','browser-native.cs','browser-welcome.html')]
    inputs.append((ROOT/'branding/MediaSail-app-icon.png','browser-icon.png'))
    notices = plain(args.notices)
    if not (notices/'BrowserSkill-MIT.txt').is_file() or not (notices/'Chromium-NOTICES.html').is_file():
        raise ValueError('Browser-tool notices are incomplete')
    for directory, dirs, names in os.walk(notices):
        for name in dirs:
            plain(Path(directory)/name)
        for name in names:
            file=plain(Path(directory)/name)
            inputs.append((file, 'notices/'+file.relative_to(notices).as_posix()))
    for source, name in inputs:
        destination=stage/name;destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,destination)
        entry={'file':name,'sha256':sha(destination)};helpers.append(entry)
        cache_files.append({'path':name,'sha256':entry['sha256']})
    cache_files.append({'path':'bsk.exe','sha256':sha(bsk)})
    payload = {'schema':1,'product':'MediaSailBrowser',
               'browser':{'version':lock['browser']['version'],'archive':'browser.zip','sha256':sha(browser),'executable':'browser/'+lock['browser']['root']+'/chrome.exe'},
               'bsk':{'version':lock['bsk']['version'],'build':lock['bsk']['build'],'protocol':lock['bsk']['protocol'],'identity':identity,'file':'bsk.exe','sha256':sha(bsk),'imports':dependencies},
               'extension':{'archive':'extension.zip','sha256':sha(stage/'extension.zip'),'extensionId':extension_id},
               'runtimeHelpers':helpers,'cacheFiles':cache_files}
    payload['bundleId']=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    (stage/'manifest.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    if output.exists():
        output.rename(ROOT/'build'/('browser-tools.previous-'+uuid.uuid4().hex))
    stage.rename(output)
    print(json.dumps({'ok':True,'bundleId':payload['bundleId'],'files':len(cache_files),'resources':str(output)}))

if __name__ == '__main__':
    main()
