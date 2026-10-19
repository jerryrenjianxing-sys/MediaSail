"""Profile editing contract through HTTP, isolated files, no platform requests."""
import asyncio
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import httpx

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'vendor/easel'


class ProfileFiles(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='MediaSail 画像 中文 空格 ')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in ('web', 'easel', 'profiles/测试画像', 'outputs'):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name in ('web/app.py', 'easel/persona.py', 'easel/__init__.py', 'easel/profile_files.py'):
            if (SOURCE / name).exists():
                shutil.copy2(SOURCE / name, self.root / name)
        self.saved_path = list(sys.path)
        self.saved_modules = {key: value for key, value in sys.modules.items()
                              if key == 'easel' or key.startswith('easel.')}
        for key in self.saved_modules:
            del sys.modules[key]
        sys.path.insert(0, str(SOURCE / 'skills/shared/scripts'))
        spec = importlib.util.spec_from_file_location('profile_files_fixture', self.root / 'web/app.py')
        self.web = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.web
        spec.loader.exec_module(self.web)
        self.file = self.root / 'profiles/测试画像/identity.md'
        self.file.write_bytes(b'hello')
        self.url = '/api/persona/测试画像'
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.web.app,
            client=('127.0.0.1', 45678)), base_url='http://127.0.0.1:7860')

    async def asyncTearDown(self):
        await self.client.aclose()
        for key in list(sys.modules):
            if key == 'easel' or key.startswith('easel.') or key == 'profile_files_fixture':
                del sys.modules[key]
        sys.modules.update(self.saved_modules)
        sys.path[:] = self.saved_path

    async def snapshot(self, filename='identity.md'):
        response = await self.client.get(self.url + '/files')
        self.assertEqual(response.status_code, 200, response.text)
        return next(row for row in response.json()['files'] if row['filename'] == filename)

    async def save(self, content, revision=None, filename='identity.md'):
        body = {'filename': filename, 'content': content}
        if revision is not None:
            body['revision'] = revision
        return await self.client.put(self.url + '/file', json=body)

    async def test_read_returns_raw_revision_and_missing_dimensions_remain_missing(self):
        self.assertEqual(await self.snapshot(), {'filename': 'identity.md', 'content': 'hello',
            'revision': '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'})
        self.assertEqual(await self.snapshot('style.md'), {'filename': 'style.md', 'content': '', 'revision': 'missing'})
        self.assertFalse((self.file.parent / 'style.md').exists())

    async def test_external_edit_rejects_stale_save_and_returns_latest_content(self):
        before = await self.snapshot()
        self.file.write_text('Agent 已修改定位', encoding='utf-8')
        response = await self.save('用户尚未保存的草稿', before['revision'])
        self.assertEqual(response.status_code, 409, response.text)
        detail = response.json()['detail']
        self.assertEqual(detail['code'], 'revision_conflict')
        self.assertEqual(detail['current']['content'], 'Agent 已修改定位')
        self.assertEqual(await self.snapshot(), detail['current'])

    async def test_same_revision_concurrent_requests_have_one_winner_and_one_conflict(self):
        before = await self.snapshot()
        responses = await asyncio.gather(self.save('用户甲', before['revision']), self.save('Agent 乙', before['revision']))
        self.assertEqual(sorted(row.status_code for row in responses), [200, 409])
        winner = next(row.json() for row in responses if row.status_code == 200)
        latest = await self.snapshot()
        self.assertEqual(latest, {key: winner[key] for key in ('filename', 'content', 'revision')})
        self.assertEqual(next(row.json()['detail']['current'] for row in responses if row.status_code == 409), latest)

    async def test_legacy_save_and_explicit_missing_custom_dimension_remain_supported(self):
        response = await self.save('旧调用仍可使用')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual((await self.snapshot())['content'], '旧调用仍可使用')
        saved = await self.save('用户自定义经验', 'missing', filename='自定义 经验.md')
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(await self.snapshot('自定义 经验.md'), {key: saved.json()[key] for key in ('filename', 'content', 'revision')})

    async def test_deleted_file_is_not_silently_recreated_by_a_stale_writer(self):
        before = await self.snapshot()
        self.file.unlink()
        response = await self.save('旧草稿', before['revision'])
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail']['current']['revision'], 'missing')
        self.assertFalse(self.file.exists())

    async def test_replace_failure_keeps_the_previous_document_and_returns_an_error(self):
        before = await self.snapshot()
        with patch.object(self.web.profile_store.os, 'replace', side_effect=PermissionError('synthetic disk failure')):
            response = await self.save('不能误报为已保存', before['revision'])
        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(response.json()['detail']['code'], 'profile_io_error')
        self.assertEqual(await self.snapshot(), before)
        self.assertFalse(list(self.file.parent.glob('.mediasail-profile-*.tmp')))

    async def test_unreadable_document_is_not_replaced_even_by_a_legacy_writer(self):
        self.file.write_bytes(b'\xff\xfe\x00')
        response = await self.save('不能覆盖损坏原件')
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail']['code'], 'invalid_profile_file')
        self.assertEqual(self.file.read_bytes(), b'\xff\xfe\x00')

    async def test_invalid_revision_and_path_are_rejected_without_changes(self):
        before = await self.snapshot()
        self.assertEqual((await self.save('bad', 'not-a-revision')).status_code, 422)
        self.assertEqual((await self.save('bad', before['revision'], filename='../identity.md')).status_code, 400)
        self.assertEqual(await self.snapshot(), before)

    async def test_an_external_change_during_disk_flush_stops_replacement(self):
        before = await self.snapshot()
        fsync = self.web.profile_store.os.fsync
        def external_edit(fd):
            self.file.write_text('Agent 在保存期间修改', encoding='utf-8')
            return fsync(fd)
        with patch.object(self.web.profile_store.os, 'fsync', side_effect=external_edit):
            response = await self.save('界面旧草稿', before['revision'])
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual((await self.snapshot())['content'], 'Agent 在保存期间修改')
        self.assertFalse(list(self.file.parent.glob('.mediasail-profile-*.tmp')))

    async def test_process_interruption_before_replace_keeps_original_readable(self):
        before = await self.snapshot()
        command = ('import sys,os;from pathlib import Path;sys.path.insert(0,sys.argv[1]);'
                   'import profile_files;profile_files.os.replace=lambda *args:os._exit(77);'
                   'profile_files.save(Path(sys.argv[2]),"interrupted",sys.argv[3])')
        result = subprocess.run([sys.executable, '-B', '-c', command,
            str(SOURCE / 'skills/shared/scripts'), str(self.file), before['revision']], capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 77, result.stderr.decode('utf-8', errors='replace'))
        self.assertEqual(await self.snapshot(), before)
