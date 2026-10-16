"""Project registration uses only synthetic projects; no platform or account I/O."""
import asyncio
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch

import httpx

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'vendor' / 'easel'
SCRIPT = SOURCE / 'skills/shared/scripts/manifest.py'


class ProjectMetadata(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 分类 中文 ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('web', 'easel', 'outputs', 'profiles'):
            (self.root / name).mkdir()
        for name in ('web/app.py', 'easel/persona.py', 'easel/__init__.py'):
            shutil.copy2(SOURCE / name, self.root / name)
        self.saved_path = list(sys.path)
        self.saved_modules = {key: value for key, value in sys.modules.items()
                              if key == 'easel' or key.startswith('easel.')}
        for key in self.saved_modules:
            del sys.modules[key]
        sys.path.insert(0, str(SCRIPT.parent))
        spec = importlib.util.spec_from_file_location('output_metadata_fixture', self.root / 'web/app.py')
        self.web = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.web
        spec.loader.exec_module(self.web)
        self.manifest = self.web.project_manifest
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.web.app,
            client=('127.0.0.1', 45678)), base_url='http://127.0.0.1:7860')
        self.project = self.root / 'outputs' / '研究 项目'
        self.project.mkdir()
        self.file = self.project / '.easel.json'
        self.url = '/api/projects/研究 项目/metadata'

    async def asyncTearDown(self):
        await self.client.aclose()
        for key in list(sys.modules):
            if key == 'easel' or key.startswith('easel.') or key == 'output_metadata_fixture':
                del sys.modules[key]
        sys.modules.update(self.saved_modules)
        sys.path[:] = self.saved_path

    def write(self, data, *, bom=False):
        raw = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
        if bom:
            raw = b'\xef\xbb\xbf' + raw
        self.file.write_bytes(raw)
        return raw

    async def snapshot(self):
        response = await self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def save(self, revision, changes):
        return await self.client.patch(self.url, json={'revision': revision, 'changes': changes})

    def no_temps(self):
        self.assertFalse(list(self.project.glob('.easel-write-*.tmp')))

    async def test_missing_registration_and_explicit_creation_without_guessing_category(self):
        self.assertEqual(await self.snapshot(), {'metadata': {}, 'revision': 'missing'})
        self.assertFalse(self.file.exists())
        empty = await self.save('missing', {})
        self.assertEqual(empty.status_code, 200, empty.text)
        self.assertFalse(self.file.exists())
        response = await self.save('missing', {'title': '分析报告', 'category': 'analysis', 'profile': '运营画像'})
        self.assertEqual(response.status_code, 200, response.text)
        value = response.json()
        self.assertEqual(value['metadata']['topic'], self.project.name)
        self.assertEqual(value['metadata']['steps'], [])
        self.assertEqual(value['metadata']['category'], 'analysis')
        self.assertEqual(value['metadata']['profile'], '运营画像')
        self.assertEqual(value['revision'], hashlib.sha256(self.file.read_bytes()).hexdigest())
        listed = (await self.client.get('/api/outputs')).json()[0]
        self.assertEqual(listed['meta']['category'], 'analysis')
        self.assertEqual(listed['meta']['profile'], '运营画像')
        conflict = await self.save('missing', {'title': 'cannot replace a newly registered project'})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['detail']['current'], value)
        self.assertEqual((await self.client.get('/api/projects/不存在/metadata')).status_code, 404)
        self.assertFalse((self.root / 'outputs/不存在').exists())

    async def test_bom_revision_is_raw_and_delta_preserves_all_unedited_fields(self):
        original = {'title': '旧标题', 'summary': '摘要', 'kind': 'legacy-format', 'category': 'legacy-purpose',
                    'status': 'custom-state', 'profile': '原画像', 'cover': '封面.png',
                    'deliverables': ['报告.md'], 'steps': [{'layer': 'discover', 'custom': 9}],
                    'created': '2020-01-01', 'unknown': {'agent': [1, 2, 3]}, 'tags': ['保留']}
        raw = self.write(original, bom=True)
        before = await self.snapshot()
        self.assertEqual(before['metadata'], original)
        self.assertEqual(before['revision'], hashlib.sha256(raw).hexdigest())
        response = await self.save(before['revision'], {'title': '新标题', 'category': 'creation', 'profile': ''})
        self.assertEqual(response.status_code, 200, response.text)
        after = response.json()['metadata']
        for key, value in original.items():
            if key not in {'title', 'category', 'profile'}:
                self.assertEqual(after[key], value, key)
        self.assertEqual(after['profile'], '')
        self.assertIn('updated', after)
        self.assertEqual(json.loads(self.file.read_text(encoding='utf-8')), after)
        self.no_temps()

    async def test_external_agent_edit_produces_conflict_with_complete_current_document(self):
        self.write({'title': '初始', 'steps': [1], 'unknown': {'kept': True}})
        before = await self.snapshot()
        changed = {'title': 'Agent更新', 'steps': [1, 2], 'unknown': {'kept': True}, 'category': 'reference'}
        raw = self.write(changed)
        response = await self.save(before['revision'], {'summary': '用户尚未保存'})
        self.assertEqual(response.status_code, 409, response.text)
        detail = response.json()['detail']
        self.assertEqual(detail['code'], 'revision_conflict')
        self.assertEqual(detail['current'], {'metadata': changed, 'revision': hashlib.sha256(raw).hexdigest()})
        self.assertEqual(self.file.read_bytes(), raw)
        self.no_temps()

    async def test_two_http_writers_with_the_same_revision_have_one_success_and_one_conflict(self):
        self.write({'title': '初始', 'steps': [1], 'unknown': 7})
        before = await self.snapshot()
        responses = await asyncio.gather(self.save(before['revision'], {'title': '甲'}),
                                         self.save(before['revision'], {'title': '乙'}))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
        successful = next(response.json() for response in responses if response.status_code == 200)
        conflict = next(response.json()['detail'] for response in responses if response.status_code == 409)
        self.assertEqual(conflict['current'], successful)
        self.assertEqual(json.loads(self.file.read_bytes())['unknown'], 7)
        self.no_temps()

    async def test_a_direct_edit_during_temp_write_is_detected_before_replacement(self):
        self.write({'title': '初始', 'steps': ['old']})
        before = await self.snapshot()
        agent = {'title': '并发Agent', 'steps': ['old', 'new'], 'extra': {'kept': 1}}
        original_sync = self.manifest.os.fsync
        def sync_and_edit(fd):
            original_sync(fd)
            self.write(agent)
        with patch.object(self.manifest.os, 'fsync', side_effect=sync_and_edit):
            response = await self.save(before['revision'], {'title': '用户修改'})
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail']['current']['metadata'], agent)
        self.assertEqual(json.loads(self.file.read_bytes()), agent)
        self.no_temps()

    async def test_bad_json_nonobjects_and_empty_files_are_not_replaced_or_hidden(self):
        for raw in (b'{bad', b'[]', b'null', b'1', b'"string"', b'', b'  ', b'\xff', b'{"value":NaN}'):
            with self.subTest(raw=raw):
                self.file.write_bytes(raw)
                read = await self.client.get(self.url)
                self.assertEqual(read.status_code, 409, read.text)
                self.assertEqual(read.json()['detail']['code'], 'invalid_manifest')
                response = await self.save(hashlib.sha256(raw).hexdigest(), {'category': 'analysis'})
                self.assertEqual(response.status_code, 409, response.text)
                self.assertEqual(response.json()['detail']['code'], 'invalid_manifest')
                self.assertEqual(self.file.read_bytes(), raw)
                tree = await self.client.get('/api/outputs')
                self.assertEqual(tree.status_code, 200, tree.text)
                self.assertEqual(tree.json()[0]['name'], self.project.name)
                self.assertNotIn('meta', tree.json()[0])
        self.no_temps()

    async def test_invalid_changes_are_refused_but_explicit_empty_values_clear_fields(self):
        self.write({'title': '原', 'category': 'creation', 'profile': '画像', 'tags': ['标签'], 'steps': []})
        before = await self.snapshot()
        for changes in ({'category': 'video'}, {'kind': 'unknown'}, {'status': 'deleted'}, {'title': None},
                        {'tags': 'x'}, {'tags': [3]}, {'steps': []}, {'cover': 'other.png'},
                        {'deliverables': []}, {'topic': 'rename'}, {'profile': 5}):
            with self.subTest(changes=changes):
                response = await self.save(before['revision'], changes)
                self.assertEqual(response.status_code, 422, response.text)
                self.assertEqual(response.json()['detail']['code'], 'invalid_changes')
                self.assertEqual(await self.snapshot(), before)
        invalid_revision = await self.save('wrong', {'title': 'new'})
        self.assertEqual(invalid_revision.status_code, 422)
        self.assertEqual(invalid_revision.json()['detail']['code'], 'invalid_revision')
        response = await self.save(before['revision'], {'category': '', 'profile': '', 'tags': [], 'summary': ''})
        self.assertEqual(response.status_code, 200, response.text)
        value = response.json()['metadata']
        self.assertEqual((value['category'], value['profile'], value['tags'], value['summary']), ('', '', [], ''))
        self.assertEqual(value['title'], '原')

    async def test_unsafe_and_system_projects_are_not_editable(self):
        for name in ('_analytics', '.hidden', 'analytics', 'wechat'):
            (self.root / 'outputs' / name).mkdir()
            response = await self.client.patch(f'/api/projects/{name}/metadata', json={'revision': 'missing', 'changes': {'title': 'no'}})
            self.assertEqual(response.status_code, 403, response.text)
            self.assertFalse((self.root / 'outputs' / name / '.easel.json').exists())
        for name in ('bad:name', 'bad%5Cname', 'bad%22name', 'bad%3Fname', 'trailing.'):
            response = await self.client.get(f'/api/projects/{name}/metadata')
            self.assertEqual(response.status_code, 400, response.text)
        (self.root / 'outputs/not-a-directory').write_text('keep')
        self.assertEqual((await self.client.get('/api/projects/not-a-directory/metadata')).status_code, 403)

    async def test_directory_junction_cannot_redirect_metadata_writes(self):
        outside = self.root / 'outside'
        outside.mkdir()
        original = outside / '.easel.json'
        original.write_bytes(b'{"title":"outside"}')
        link = self.root / 'outputs' / 'linked-project'
        if os.name == 'nt':
            result = subprocess.run(['cmd.exe', '/d', '/c', 'mklink', '/J', str(link), str(outside)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.addCleanup(lambda: os.rmdir(link) if link.exists() else None)
        else:
            link.symlink_to(outside, target_is_directory=True)
        response = await self.client.patch('/api/projects/linked-project/metadata', json={'revision': 'missing', 'changes': {'title': 'no'}})
        self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(original.read_bytes(), b'{"title":"outside"}')
        self.assertEqual(list(outside.iterdir()), [original])

    async def test_manifest_symlink_is_not_followed(self):
        outside = self.root / 'outside.json'
        outside.write_bytes(b'{"title":"outside"}')
        try:
            self.file.symlink_to(outside)
        except OSError as error:
            self.skipTest(f'Host does not permit file symlinks: {error}')
        response = await self.save('missing', {'title': 'no'})
        self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(response.json()['detail']['code'], 'unsafe_manifest')
        self.assertEqual(outside.read_bytes(), b'{"title":"outside"}')
        self.assertTrue(self.file.is_symlink())

    async def test_fsync_or_replace_failure_preserves_the_original_and_cleans_the_temp(self):
        original = self.write({'title': '原件', 'unknown': [1, 2], 'steps': []})
        before = await self.snapshot()
        for target in ('fsync', 'replace'):
            with self.subTest(target=target), patch.object(self.manifest.os, target, side_effect=PermissionError('fixture write refused')):
                response = await self.save(before['revision'], {'title': 'should fail'})
            self.assertEqual(response.status_code, 500, response.text)
            self.assertEqual(response.json()['detail']['code'], 'metadata_io_error')
            self.assertEqual(self.file.read_bytes(), original)
            self.no_temps()

    async def test_unreadable_metadata_is_not_treated_as_a_missing_document(self):
        original = self.write({'title': '原件'})
        with patch.object(self.manifest, '_read_raw', side_effect=PermissionError('fixture read refused')):
            response = await self.client.get(self.url)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['detail']['code'], 'metadata_io_error')
        self.assertEqual(self.file.read_bytes(), original)

    async def test_deleted_project_during_save_is_not_recreated(self):
        self.write({'title': '原件'})
        before = await self.snapshot()
        original_mkstemp = self.manifest.tempfile.mkstemp
        def remove_project(**kwargs):
            shutil.rmtree(self.project)
            return original_mkstemp(**kwargs)
        with patch.object(self.manifest.tempfile, 'mkstemp', side_effect=remove_project):
            response = await self.save(before['revision'], {'title': 'no recreation'})
        self.assertEqual(response.status_code, 500)
        self.assertFalse(self.project.exists())

    async def test_metadata_only_updates_change_recent_order_without_changing_content_paths(self):
        older = self.project / '报告.md'
        older.write_text('原文件', encoding='utf-8')
        other = self.root / 'outputs/另一个项目'
        other.mkdir()
        (other / '报告.md').write_text('另外原件', encoding='utf-8')
        original = self.write({'title': '初始', 'deliverables': ['报告.md']})
        for file in (older, self.file):
            os.utime(file, (1000000000, 1000000000))
        os.utime(other / '报告.md', (1000001000, 1000001000))
        self.assertEqual((await self.client.get('/api/outputs')).json()[0]['name'], other.name)
        response = await self.save(hashlib.sha256(original).hexdigest(), {'category': 'analysis'})
        self.assertEqual(response.status_code, 200, response.text)
        tree = (await self.client.get('/api/outputs')).json()
        self.assertEqual(tree[0]['name'], self.project.name)
        self.assertEqual(tree[0]['meta']['deliverablePaths'], [self.project.name + '/报告.md'])
        self.assertEqual(older.read_text(encoding='utf-8'), '原文件')

    async def test_step_recorders_keep_new_registration_fields_and_their_original_cli_semantics(self):
        import persona_gate
        calls = [(self.manifest.cmd_record, SimpleNamespace(topic='研究 项目', data=str(self.file),
                  profile='原画像', layer='general', skill='external-agent', status='done',
                  outputs='报告.md', upstream=None, summary='保留业务步骤')),
                 (persona_gate.cmd_record, SimpleNamespace(topic='研究 项目', data=str(self.file),
                  profile='原画像', score=50, verdict='warn', deviations='测试说明'))]
        for function, args in calls:
            original = {'title': '报告', 'category': 'analysis', 'profile': '已选画像',
                        'steps': [], 'unknown': {'kept': True}}
            self.write(original, bom=True)
            with redirect_stdout(io.StringIO()):
                function(args)
            actual = json.loads(self.file.read_bytes())
            for field in ('title', 'category', 'profile', 'unknown'):
                self.assertEqual(actual[field], original[field])
            self.assertEqual(len(actual['steps']), 1)
            self.assertEqual(actual['steps'][0]['status'], 'done')
            if function is persona_gate.cmd_record:
                self.assertEqual(actual['steps'][0]['persona_check']['verdict'], 'warn')

    async def test_step_recorders_detect_a_metadata_update_during_their_write(self):
        import persona_gate
        calls = [(self.manifest.cmd_record, SimpleNamespace(topic='研究 项目', data=str(self.file),
                  profile=None, layer='general', skill='external-agent', status='done',
                  outputs=None, upstream=None, summary='测试')),
                 (persona_gate.cmd_record, SimpleNamespace(topic='研究 项目', data=str(self.file),
                  profile=None, score=50, verdict='warn', deviations='测试'))]
        for function, args in calls:
            self.write({'title': '原登记', 'category': 'creation', 'steps': []})
            changed = {'title': '界面已保存', 'category': 'analysis', 'steps': [], 'external': 1}
            original_sync = self.manifest.os.fsync
            def sync_and_edit(fd):
                original_sync(fd)
                self.write(changed)
            with patch.object(self.manifest.os, 'fsync', side_effect=sync_and_edit):
                with self.assertRaises(self.manifest.ManifestError) as caught:
                    function(args)
            self.assertEqual(caught.exception.code, 'revision_conflict')
            self.assertEqual(caught.exception.current['metadata'], changed)
            self.assertEqual(json.loads(self.file.read_bytes()), changed)
            self.no_temps()


class ManifestCli(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 登记 CLI ')
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name) / '项目 中文' / '.easel.json'

    def cli(self, *args):
        return subprocess.run([sys.executable, '-X', 'utf8', '-B', str(SCRIPT), *args, '--data', str(self.file)],
                              capture_output=True, text=True, encoding='utf-8')

    def test_category_profile_and_delta_preserve_unmentioned_registration(self):
        self.file.parent.mkdir()
        original = {'title': '原', 'profile': '旧画像', 'cover': '封面.png', 'deliverables': ['成品.md'],
                    'unknown': {'external': True}, 'steps': [{'skill': 'agent', 'outputs': ['原件.md']}]}
        self.file.write_text(json.dumps(original, ensure_ascii=False), encoding='utf-8-sig')
        revision = hashlib.sha256(self.file.read_bytes()).hexdigest()
        read = self.cli('read', '--revision')
        self.assertEqual(read.returncode, 0, read.stderr)
        self.assertEqual(json.loads(read.stdout), {'metadata': original, 'revision': revision})
        changed = self.cli('meta', '--category', 'analysis', '--profile', '新画像', '--if-revision', revision)
        self.assertEqual(changed.returncode, 0, changed.stderr)
        after = json.loads(self.file.read_bytes())
        self.assertEqual(after['category'], 'analysis')
        self.assertEqual(after['profile'], '新画像')
        for key in ('title', 'cover', 'deliverables', 'unknown', 'steps'):
            self.assertEqual(after[key], original[key])
        self.assertEqual(json.loads(changed.stdout)['revision'], hashlib.sha256(self.file.read_bytes()).hexdigest())
        before = self.file.read_bytes()
        conflict = self.cli('meta', '--title', '不能覆盖', '--if-revision', revision)
        self.assertEqual(conflict.returncode, 1)
        detail = json.loads(conflict.stderr)
        self.assertEqual(detail['code'], 'revision_conflict')
        self.assertEqual(detail['current']['metadata'], after)
        self.assertEqual(self.file.read_bytes(), before)

    def test_new_project_category_clear_and_invalid_category(self):
        created = self.cli('meta', '--category', 'creation', '--tags', '一,二', '--title', '新建')
        self.assertEqual(created.returncode, 0, created.stderr)
        cleared = self.cli('meta', '--category', '', '--tags', '')
        self.assertEqual(cleared.returncode, 0, cleared.stderr)
        data = json.loads(self.file.read_bytes())
        self.assertEqual(data['category'], '')
        self.assertEqual(data['tags'], [])
        self.assertEqual(data['title'], '新建')
        before = self.file.read_bytes()
        rejected = self.cli('meta', '--category', 'video')
        self.assertNotEqual(rejected.returncode, 0)
        self.assertEqual(self.file.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
