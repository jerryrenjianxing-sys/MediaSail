"""Account observations are tested through the actual CLI and HTTP Interface."""
import json
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
SCRIPT = REPO / 'vendor/easel/skills/shared/scripts/account_observations.py'


def observation(**changes):
    return {'platform': 'douyin', 'fetched_at': 1793577600, 'source': 'douyin-creator-home',
            'accountId': None, 'nickname': '合成账号', 'followers': None, 'following': 9,
            'followerIndex': 7, 'likes': 74, 'posts': None, 'metrics': [], 'notes': [],
            'collection': {'status': 'partial', 'missingFields': ['followers', 'posts'],
                           'issues': [{'field': 'followers', 'code': 'not_observed', 'message': '页面未见精确粉丝数'}]},
            **changes}


class ObservationCli(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 观测 中文 ')
        self.addCleanup(self.temp.cleanup)
        self.library = Path(self.temp.name)
        self.workspace = self.library / '资料工作区'
        self.workspace.mkdir()
        (self.library / '.mediasail-library.json').write_text(json.dumps({
            'schema': 1, 'product': 'MediaSail', 'state': 'ready', 'libraryId': 'library-observation-a'}), encoding='utf8')

    def call(self, *args, expected=0):
        environment = dict(os.environ, EASEL_ROOT=str(self.workspace), PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(SCRIPT), *args],
                                env=environment, encoding='utf8', capture_output=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def register(self, value, expected=0):
        source = self.library / '本次观测.json'
        source.write_text(json.dumps(value, ensure_ascii=False), encoding='utf8')
        return self.call('register', '--file', str(source), expected=expected)

    def test_partial_observation_can_be_registered_and_read_without_login(self):
        receipt = self.register(observation())
        self.assertTrue(receipt['ok'])
        self.assertEqual(receipt['libraryId'], 'library-observation-a')
        saved = self.call('show', receipt['observationId'])['observation']
        self.assertEqual(saved['followerIndex'], 7)
        self.assertIsNone(saved['followers'])
        self.assertEqual(saved['producer'], 'external-agent')
        self.assertNotIn('loggedIn', saved)
        self.assertEqual(saved['collection']['issues'][0]['message'], '页面未见精确粉丝数')
        listed = self.call('list', '--platform', 'douyin')
        self.assertEqual([row['observationId'] for row in listed['observations']], [receipt['observationId']])

    def test_repeated_registration_is_idempotent_and_id_conflict_keeps_original(self):
        value = observation(observationId='synthetic-fixed-id', followers=0)
        first = self.register(value)
        repeat = self.register(value)
        self.assertFalse(first['duplicate'])
        self.assertTrue(repeat['duplicate'])
        conflict = self.register({**value, 'followers': 11}, expected=1)
        self.assertEqual(conflict['code'], 'observation_conflict')
        self.assertEqual(conflict['status'], 409)
        self.assertEqual(self.call('show', first['observationId'])['observation']['followers'], 0)
        self.assertEqual(len(self.call('list')['observations']), 1)

    def test_damaged_record_is_reported_without_hiding_other_records(self):
        damaged = self.register(observation(observationId='damaged'))
        good = self.register(observation(observationId='good', fetched_at=1793664000))
        Path(damaged['path']).write_text('[]', encoding='utf8')  # external editing boundary
        result = self.call('show', 'damaged', expected=1)
        self.assertEqual(result['code'], 'observation_unreadable')
        listing = self.call('list')
        self.assertEqual([row['observationId'] for row in listing['observations']], [good['observationId']])
        self.assertEqual(listing['errors'][0]['file'], 'damaged.json')
        self.assertEqual(Path(damaged['path']).read_text(encoding='utf8'), '[]')

    def test_competing_cli_writers_commit_one_record_and_return_conflicts(self):
        environment = dict(os.environ, EASEL_ROOT=str(self.workspace), PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
        children = []
        for number in range(10):
            source = self.library / f'并发输入{number}.json'
            source.write_text(json.dumps(observation(observationId='one-shared-id', followers=number,
                extensions={'diagnostic': '合成内容' * 100000}), ensure_ascii=False), encoding='utf8')
            children.append(subprocess.Popen([sys.executable, '-X', 'utf8', '-B', str(SCRIPT),
                'register', '--file', str(source)], env=environment, encoding='utf8',
                stdout=subprocess.PIPE, stderr=subprocess.PIPE))
        replies = []
        for child in children:
            stdout, stderr = child.communicate(timeout=30)
            self.assertIn(child.returncode, (0, 1), stderr)
            replies.append(json.loads(stdout))
        self.assertEqual(sum(bool(row['ok']) for row in replies), 1)
        self.assertTrue(all(row.get('code') == 'observation_conflict' for row in replies if not row['ok']))
        listing = self.call('list')
        self.assertEqual(len(listing['observations']), 1)
        self.assertEqual(listing['errors'], [])

    def test_growth_uses_actual_time_and_only_same_account_source_and_metric_meaning(self):
        identity = {'accountId': 'stable-account-a', 'identityEvidence': [{'kind': 'platform-id', 'value': 'stable-account-a'}]}
        meanings = {key: {'label': label, 'unit': 'count', 'window': 'lifetime', 'scope': scope}
                    for key, label, scope in [('followers', '粉丝数', 'account'), ('likes', '累计获赞', 'account'),
                                              ('posts', '公开作品数', 'public-posts')]}
        self.register(observation(**identity, observationId='old-baseline', fetched_at=1793404800,
                                  metricDefinitions=meanings, followers=10, likes=50, posts=1))
        self.register(observation(**identity, observationId='different-window', fetched_at=1793491200,
            metricDefinitions={**meanings, 'followers': {**meanings['followers'], 'window': '7-days'}},
            followers=999, likes=50, posts=1))
        self.register(observation(observationId='same-name-new-account', fetched_at=1793491300,
            accountId='stable-account-b', metricDefinitions=meanings, followers=900, likes=900, posts=900))
        current = self.register(observation(**identity, observationId='current', fetched_at=1793577600,
                                            metricDefinitions=meanings, followers=14, likes=60, posts=2))
        # Late import is not the last observation; failed samples do not replace a useful result.
        self.register(observation(**identity, observationId='very-old-late-import', fetched_at=1793000000,
                                  metricDefinitions=meanings, followers=3, likes=5, posts=0))
        saved = self.call('show', current['observationId'])['observation']
        self.assertEqual(saved['growthStatus'], 'available')
        self.assertEqual(saved['growth']['last']['followers'], 4)
        self.assertEqual(saved['growth']['last']['likes'], 10)
        self.assertEqual(saved['growth']['last']['posts'], 1)
        self.assertEqual(saved['growth']['last']['since_days'], 2.0)
        self.assertEqual(self.call('list')['observations'][0]['observationId'], 'current')
        unknown = self.call('show', 'same-name-new-account')['observation']
        self.assertEqual(unknown['growthStatus'], 'unavailable')
        self.assertIn('身份依据', unknown['growthReason'])

    def test_helper_can_register_and_read_offline_in_the_current_library(self):
        scripts = self.workspace / 'skills/shared/scripts'
        scripts.mkdir(parents=True)
        for name in ('account_observations.py', 'profile_lock.py', 'account_stats.py', 'business_browser.py',
                     'creator_auth.py', 'account_collection.py', 'login_state.py', 'platform_readback.py'):
            shutil.copy2(SCRIPT.parent / name, scripts / name)
        connection = self.library / 'agent-connection.json'
        connection.write_text(json.dumps({'schema':1, 'product':'MediaSail', 'version':'0.5.12',
            'workspace':str(self.workspace), 'libraryRoot':str(self.library), 'libraryId':'library-observation-a',
            'baseUrl':None, 'python':sys.executable, 'environment':{}}), encoding='utf8')
        source = self.library / '离线观测.json'
        source.write_text(json.dumps(observation(), ensure_ascii=False), encoding='utf8')
        helper = REPO / 'agent-skill/mediasail/scripts/mediasail.py'
        def run(*arguments):
            result = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(helper), '--connection',
                str(connection), 'observations', *arguments], capture_output=True, encoding='utf8')
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.loads(result.stdout)
        receipt = run('register', '--file', str(source))
        self.assertEqual(run('show', receipt['observationId'])['observation']['libraryId'], 'library-observation-a')
        self.assertEqual(len(run('list')['observations']), 1)


class ObservationHttp(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 观测 HTTP ')
        self.addCleanup(self.temp.cleanup)
        library = Path(self.temp.name)
        self.root = library / 'workspace'
        for name in ('web', 'easel', 'outputs/_login'):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name in ('web/app.py', 'easel/persona.py', 'easel/__init__.py'):
            shutil.copy2(REPO / 'vendor/easel' / name, self.root / name)
        (library / '.mediasail-library.json').write_text(json.dumps({
            'schema': 1, 'product': 'MediaSail', 'state': 'ready', 'libraryId': 'http-library'}), encoding='utf8')
        self.saved_path = list(sys.path)
        sys.path.insert(0, str(SCRIPT.parent))
        self.saved_modules = {k: v for k, v in sys.modules.items() if k == 'easel' or k.startswith('easel.')}
        for key in self.saved_modules:
            del sys.modules[key]
        spec = importlib.util.spec_from_file_location('observation_api_fixture', self.root / 'web/app.py')
        self.web = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.web
        spec.loader.exec_module(self.web)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.web.app,
            client=('127.0.0.1', 45678)), base_url='http://127.0.0.1:7860')

    async def asyncTearDown(self):
        await self.client.aclose()
        for key in list(sys.modules):
            if key == 'easel' or key.startswith('easel.') or key == 'observation_api_fixture':
                del sys.modules[key]
        sys.modules.update(self.saved_modules)
        sys.path[:] = self.saved_path

    async def test_http_saves_and_lists_the_same_records_as_offline_cli_without_verifying_login(self):
        marker = self.root / 'outputs/_login/douyin.json'
        marker.write_bytes(b'{"state":"expired"}')
        response = await self.client.post('/api/account-observations', json=observation(
            observationId='http-sample', accountId='stable-a', libraryId='http-library'))
        self.assertEqual(response.status_code, 200, response.text)
        receipt = response.json()
        shown = await self.client.get('/api/account-observations/http-sample')
        self.assertEqual(shown.status_code, 200, shown.text)
        self.assertEqual(shown.json()['observation']['source'], 'douyin-creator-home')
        listed = await self.client.get('/api/account-observations?platform=douyin&accountId=stable-a')
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual([row['observationId'] for row in listed.json()['observations']], [receipt['observationId']])
        empty = await self.client.get('/api/account-observations?accountId=different-account')
        self.assertEqual(empty.json()['observations'], [])
        environment = dict(os.environ, EASEL_ROOT=str(self.root), PYTHONUTF8='1')
        child = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(SCRIPT), 'show', 'http-sample'],
                               env=environment, encoding='utf8', capture_output=True)
        self.assertEqual(child.returncode, 0, child.stderr)
        self.assertEqual(json.loads(child.stdout), shown.json())
        self.assertEqual(marker.read_bytes(), b'{"state":"expired"}')

    async def test_disk_commit_failure_returns_error_and_leaves_other_records_readable(self):
        good = await self.client.post('/api/account-observations', json=observation(observationId='retained'))
        self.assertEqual(good.status_code, 200)
        before = (await self.client.get('/api/account-observations/retained')).json()
        with patch('os.replace', side_effect=PermissionError('合成磁盘提交失败')):
            failed = await self.client.post('/api/account-observations', json=observation(observationId='not-committed'))
        self.assertEqual(failed.status_code, 503, failed.text)
        self.assertFalse(failed.json()['ok'])
        self.assertEqual((await self.client.get('/api/account-observations/not-committed')).status_code, 404)
        self.assertEqual((await self.client.get('/api/account-observations/retained')).json(), before)
        listed = (await self.client.get('/api/account-observations')).json()
        self.assertEqual([row['observationId'] for row in listed['observations']], ['retained'])

    async def test_malformed_data_is_rejected_and_cross_library_input_is_not_saved(self):
        invalid = await self.client.post('/api/account-observations', json=observation(metrics='not-a-list'))
        self.assertEqual(invalid.status_code, 422, invalid.text)
        self.assertEqual(invalid.json()['code'], 'invalid_observation')
        wrong_library = await self.client.post('/api/account-observations', json=observation(libraryId='a-different-library'))
        self.assertEqual(wrong_library.status_code, 409, wrong_library.text)
        self.assertEqual(wrong_library.json()['code'], 'library_mismatch')
        self.assertEqual((await self.client.get('/api/account-observations')).json()['observations'], [])

    async def test_malformed_nested_evidence_and_collection_are_not_accepted_as_displayable_data(self):
        for change in ({'collection':{'status':'partial','issues':[None]}},
                       {'reportPaths':[{'path':{'not':'a path'}}]},
                       {'collection':{'notesCoverage':{'total':{'not':'a number'}}}},
                       {'collection':{'missingFields':[{'not':'a field name'}]}}):
            with self.subTest(change=change):
                response = await self.client.post('/api/account-observations', json=observation(**change))
                self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual((await self.client.get('/api/account-observations')).json()['observations'], [])


if __name__ == '__main__':
    unittest.main()
