"""Account verification uses synthetic responses and an isolated Chinese-path workspace."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'vendor' / 'easel'


class AccountApi(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 账号 测试 ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('web', 'easel', 'outputs/_login'):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        for name in ('web/app.py', 'easel/persona.py', 'easel/__init__.py'):
            shutil.copy2(SOURCE / name, self.root / name)
        self.saved_path = list(sys.path)
        sys.path.insert(0, str(SOURCE / 'skills/shared/scripts'))
        self.saved_modules = {k: v for k, v in sys.modules.items() if k == 'easel' or k.startswith('easel.')}
        for k in self.saved_modules:
            del sys.modules[k]
        spec = importlib.util.spec_from_file_location('account_api_fixture', self.root / 'web/app.py')
        self.web = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.web
        spec.loader.exec_module(self.web)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.web.app,
            client=('127.0.0.1', 45678)), base_url='http://127.0.0.1:7860')
        self.browser = patch.object(self.web, '_require_business_browser', return_value=None)
        self.browser.start()
        self.marker = self.root / 'outputs/_login/douyin.json'

    async def asyncTearDown(self):
        self.browser.stop()
        await self.client.aclose()
        for k in list(sys.modules):
            if k == 'easel' or k.startswith('easel.') or k == 'account_api_fixture':
                del sys.modules[k]
        sys.modules.update(self.saved_modules)
        sys.path[:] = self.saved_path

    @staticmethod
    def response(data, code=0):
        return SimpleNamespace(stdout=json.dumps(data), stderr='', returncode=code)

    async def verify(self, force=False):
        response = await self.client.get('/api/accounts/douyin/whoami' + ('?force=1' if force else ''))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def test_old_success_and_cookie_presence_are_not_verified(self):
        self.marker.write_text('{"state":"success","message":"旧登录成功"}', encoding='utf8')
        (self.root / 'cookies.json').write_text('old cookie fixture', encoding='utf8')
        accounts = (await self.client.get('/api/accounts')).json()
        for platform in ('douyin', 'bilibili'):
            account = next(a for a in accounts if a['platform'] == platform)
            self.assertFalse(account['loggedIn'])
            self.assertEqual(account['verificationStatus'], 'unknown')
        self.assertEqual(next(a for a in accounts if a['platform'] == 'douyin')['name'], '抖音')

    async def test_manual_force_bypasses_cache_and_negative_overrides_old_success(self):
        verified = {'loggedIn': True, 'verificationStatus': 'verified', 'accountId': 'account-a',
                    'name': '测试账号', 'checkedAt': int(time.time())}
        required = {'loggedIn': False, 'verificationStatus': 'login_required', 'errorCode': 'LOGIN_REQUIRED',
                    'message': '创作者后台需要登录。'}
        with patch.object(self.web.subprocess, 'run', side_effect=[self.response(verified), self.response(required)]) as run:
            first, cached = await self.verify(), await self.verify()
            self.assertTrue(first['loggedIn'])
            self.assertTrue(cached['cached'])
            self.assertEqual(run.call_count, 1)
            negative = await self.verify(force=True)
            self.assertEqual(run.call_count, 2)
        self.assertFalse(negative['loggedIn'])
        self.assertFalse(negative['cached'])
        self.assertEqual(json.loads(self.marker.read_text(encoding='utf8'))['state'], 'expired')
        platforms = (await self.client.get('/api/analytics/platforms')).json()
        self.assertEqual(next(a for a in platforms if a['platform'] == 'douyin')['verificationStatus'], 'login_required')

    async def test_unknown_preserves_login_material_and_last_identity_without_false_success(self):
        with patch.object(self.web.subprocess, 'run', return_value=self.response({
                'loggedIn': True, 'verificationStatus': 'verified', 'accountId': 'account-a', 'name': '测试账号'})):
            await self.verify(force=True)
        original = self.marker.read_bytes()
        profile = self.root / 'private-browser-profile'
        profile.mkdir()
        cookie = profile / 'Cookies'
        cookie.write_bytes(b'fixture-cookie-not-real')
        with patch.object(self.web.subprocess, 'run', side_effect=[self.response({'error': 'offline'}),
                self.response({'loggedIn': True, 'name': '恢复连接'})]) as run:
            unknown = await self.verify(force=True)
            self.assertEqual(unknown['verificationStatus'], 'unknown')
            self.assertFalse(unknown['loggedIn'])
            self.assertEqual(unknown['lastKnown']['accountId'], 'account-a')
            account = next(a for a in (await self.client.get('/api/accounts')).json() if a['platform'] == 'douyin')
            self.assertFalse(account['loggedIn'])
            recovered = await self.verify()
            self.assertTrue(recovered['loggedIn'])
            self.assertEqual(recovered['verificationStatus'], 'verified')
            self.assertEqual(run.call_count, 2, 'Unknown verification must not lock retries behind the success TTL')
        self.assertEqual(cookie.read_bytes(), b'fixture-cookie-not-real')
        self.assertNotEqual(original, self.marker.read_bytes(), 'Later genuine success may update the marker')

    async def test_unknown_does_not_rewrite_success_marker(self):
        with patch.object(self.web.subprocess, 'run', return_value=self.response({'loggedIn': True, 'accountId': 'a'})):
            await self.verify(force=True)
        original = self.marker.read_bytes()
        with patch.object(self.web.subprocess, 'run', side_effect=subprocess.TimeoutExpired('fixture', 150)):
            result = await self.verify(force=True)
        self.assertEqual(result['errorCode'], 'VERIFY_TIMEOUT')
        self.assertEqual(result['verificationStatus'], 'unknown')
        self.assertEqual(original, self.marker.read_bytes())

    async def test_failed_process_cannot_claim_verified_or_fresh_analysis(self):
        with patch.object(self.web.subprocess, 'run', return_value=self.response({'loggedIn': True, 'accountId': 'a'}, code=1)):
            self.assertEqual((await self.verify(force=True))['verificationStatus'], 'unknown')
        with patch.object(self.web.subprocess, 'run', return_value=self.response({
                'platform': 'douyin', 'name': '抖音', 'loggedIn': False, 'verificationStatus': 'login_required',
                'followers': None, 'likes': None, 'posts': None, 'fetched_at': int(time.time())})):
            result = (await self.client.get('/api/analytics/douyin')).json()
        self.assertEqual(result['verificationStatus'], 'login_required')
        self.assertIsNone(result['followers'])
        self.assertEqual(result['name'], '抖音')


if __name__ == '__main__':
    unittest.main()
