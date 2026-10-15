"""Isolated 0.5 business service checks: no account, model or platform traffic."""
import asyncio
import importlib.util
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import FastAPI

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'vendor' / 'easel'
sys.path.insert(0, str(REPO / 'bridge'))
sys.path.insert(0, str(SOURCE / 'skills' / 'shared' / 'scripts'))
import bootstrap
import agent_skill
import business_browser


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class BrowserResolution(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='MediaSail 浏览器 ')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def test_configured_path_wins_and_missing_path_is_explicit(self):
        browser = self.root / '自定义 Chrome.exe'
        browser.write_bytes(b'test')
        with patch.dict(os.environ, {'EASEL_BROWSER_EXECUTABLE': str(browser)}, clear=True), \
             patch.object(business_browser, '_candidates', side_effect=AssertionError('must use configured browser')):
            self.assertEqual(business_browser.resolve_browser(), browser.resolve())
            browser.unlink()
            with self.assertRaisesRegex(business_browser.BrowserUnavailable, '已配置的浏览器不存在'):
                business_browser.resolve_browser()

    def test_chrome_then_edge_and_no_download_fallback(self):
        chrome, edge = self.root / 'chrome.exe', self.root / 'msedge.exe'
        chrome.write_bytes(b'chrome')
        edge.write_bytes(b'edge')
        with patch.dict(os.environ, {}, clear=True), patch.object(business_browser, '_candidates',
                side_effect=lambda product: [chrome if product == 'chrome' else edge]):
            self.assertEqual(business_browser.resolve_browser(), chrome.resolve())
            chrome.unlink()
            self.assertEqual(business_browser.resolve_browser(), edge.resolve())
            edge.unlink()
            with self.assertRaisesRegex(business_browser.BrowserUnavailable, '未找到 Chrome 或 Edge'):
                business_browser.resolve_browser()

    def test_launch_keeps_the_existing_platform_profile(self):
        from unittest.mock import Mock
        chromium = Mock()
        profile = self.root / '旧资料' / 'XiaohongshuProfile'
        browser = self.root / 'chrome.exe'
        with patch.object(business_browser, 'resolve_browser', return_value=browser):
            business_browser.launch_persistent_context(chromium, profile, headless=True, channel='chrome')
        chromium.launch_persistent_context.assert_called_once_with(
            str(profile), headless=True, executable_path=str(browser))


class LocalBusiness(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='MediaSail 业务 中文 ')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / '自定义 安装位置'
        (self.root / 'web').mkdir(parents=True)
        (self.root / 'easel').mkdir()
        (self.root / 'easel' / '__init__.py').write_text('', encoding='utf8')
        shutil.copy2(SOURCE / 'easel' / 'persona.py', self.root / 'easel' / 'persona.py')
        shutil.copy2(SOURCE / 'web' / 'app.py', self.root / 'web' / 'app.py')
        (self.root / '.env').write_text('PRIVATE_KEY=isolated-test-only\n', encoding='utf8')
        bootstrap.prepare(self.root)
        self.saved_modules = {key: value for key, value in sys.modules.items()
                              if key == 'easel' or key.startswith('easel.')}
        for key in list(self.saved_modules):
            del sys.modules[key]
        self.old_path = list(sys.path)
        self.web = load_module('mediasail_lite_test_app', self.root / 'web' / 'app.py')
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.web.app,
            client=('127.0.0.1', 45678)), base_url='http://127.0.0.1:7860')
        self.no_run = patch.object(self.web.subprocess, 'run', side_effect=AssertionError('no business process in isolated HTTP tests'))
        self.no_popen = patch.object(self.web.subprocess, 'Popen', side_effect=AssertionError('no login process in isolated HTTP tests'))
        self.no_run.start()
        self.no_popen.start()

    async def asyncTearDown(self):
        self.no_popen.stop()
        self.no_run.stop()
        await self.client.aclose()
        for key in list(sys.modules):
            if key == 'easel' or key.startswith('easel.') or key == 'mediasail_lite_test_app':
                del sys.modules[key]
        sys.modules.update(self.saved_modules)
        sys.path[:] = self.old_path

    async def test_status_is_local_and_old_execution_routes_are_gone(self):
        state = (await self.client.get('/api/status')).json()
        self.assertTrue(state['serviceReady'])
        self.assertFalse(state['gateway'])
        self.assertNotIn('PRIVATE_KEY', json.dumps(state))
        for method, paths in self.web._RETIRED_ROUTES.items():
            for template in paths:
                path = template.replace('{job_id}', 'old').replace('{session_id}', 'old').replace('{turn_id}', 'old').replace('{session_key}', 'old')
                response = await self.client.request(method, path)
                self.assertEqual(response.status_code, 410, path)
                self.assertEqual(response.json()['detail']['code'], 'external-agent-required')
        self.assertFalse(any('/api/chat' in path for path in self.web.app.openapi()['paths']))

    async def test_baseline_and_external_profile_result_are_visible(self):
        form = {'direction': '认真研究产品', 'platforms': ['小红书'], 'tone': '温和',
                'links': {'小红书': 'https://example.invalid/test'}}
        response = await self.client.post('/api/profile/build', json={'name': '运营 画像', 'form': form})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'created': True, 'name': '运营 画像', 'async': False, 'status': 'baseline-ready'})
        profile = self.root / 'profiles' / '运营 画像'
        self.assertEqual(len(list(profile.glob('*.md'))), 6)
        self.assertIn('认真研究产品', (profile / 'identity.md').read_text(encoding='utf8'))
        (profile / 'memory.md').write_text('# 外部 Agent 的分析结果\n样本来自测试。', encoding='utf8')
        files = (await self.client.get('/api/persona/运营 画像/files')).json()['files']
        self.assertTrue(any('外部 Agent' in item['content'] for item in files))
        state = (await self.client.get('/api/profile/build/status/运营 画像')).json()
        self.assertEqual(state['state'], 'baseline-ready')
        duplicate = await self.client.post('/api/profile/build', json={'name': '运营 画像', 'form': form})
        self.assertEqual(duplicate.status_code, 409)

    async def test_old_enhancement_status_is_archived_without_overwrite(self):
        directory = self.root / 'outputs' / '_profile_build'
        directory.mkdir()
        old = directory / '旧画像.json'
        before = json.dumps({'state': 'running', 'log': 'old pending'}, ensure_ascii=False)
        old.write_text(before, encoding='utf8')
        state = (await self.client.get('/api/profile/build/status/旧画像')).json()
        self.assertEqual(state['state'], 'archived')
        self.assertEqual(old.read_text(encoding='utf8'), before)

    async def test_external_deliverable_and_business_data_are_reread(self):
        project = self.root / 'outputs' / '测试项目'
        project.mkdir()
        (project / '成品.md').write_text('测试成品', encoding='utf8')
        (project / '.easel.json').write_text(json.dumps({'title': '外部 Agent 成品',
            'deliverables': ['成品.md'], 'status': 'done'}, ensure_ascii=False), encoding='utf8')
        tree = (await self.client.get('/api/outputs')).json()
        self.assertEqual(tree[0]['meta']['deliverablePaths'], ['测试项目/成品.md'])
        response = await self.client.post('/api/schedule', json={'title': '测试排期', 'date': '2026-10-15'})
        self.assertEqual(response.status_code, 200, response.text)
        (self.root / 'outputs' / '_schedule.json').write_text(json.dumps([{'id': 'agent-result', 'title': '外部回存'}]), encoding='utf8')
        self.assertEqual((await self.client.get('/api/schedule')).json()[0]['id'], 'agent-result')
        self.assertEqual((await self.client.get('/api/accounts')).status_code, 200)

    async def test_no_browser_fails_before_login_and_keeps_core_service(self):
        with patch.object(self.web, 'resolve_browser', side_effect=business_browser.BrowserUnavailable('未找到 Chrome 或 Edge')):
            for method, path in [('POST', '/api/login/douyin'), ('GET', '/api/analytics/douyin'),
                                 ('GET', '/api/accounts/zhihu/whoami'), ('POST', '/api/accounts/wechat-oa/mp-login')]:
                response = await self.client.request(method, path)
                self.assertEqual(response.status_code, 503, response.text)
                self.assertIn('Chrome', response.json()['detail'])
            self.assertTrue((await self.client.get('/api/status')).json()['serviceReady'])


class SkillDiscovery(unittest.IsolatedAsyncioTestCase):
    async def test_connection_and_copy_text_follow_the_latest_selection(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail Skill 中文 ') as temp:
            root = Path(temp)
            skill = root / 'skill'
            skill.mkdir()
            (skill / 'SKILL.md').write_text('# MediaSail\n测试资料', encoding='utf8')
            connection = root / 'agent-connection.json'
            info = {'product': 'MediaSail', 'version': '0.5.0', 'instanceId': 'isolated-test',
                    'baseUrl': 'http://127.0.0.1:51515', 'connectionFile': str(connection),
                    'dataDir': str(root), 'skillDir': str(skill), 'selectedProfile': None}
            connection.write_text(json.dumps(info), encoding='utf8')
            app = FastAPI()
            with patch.dict(os.environ, {'EASEL_AGENT_CONNECTION_FILE': str(connection)}):
                agent_skill.register(app, info)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=info['baseUrl']) as client:
                self.assertIsNone((await client.get('/api/agent-info')).json()['selectedProfile'])
                info['selectedProfile'] = '新选择 画像'
                connection.write_text(json.dumps(info), encoding='utf8')
                response = await client.get('/api/agent-info')
                self.assertEqual(response.json()['selectedProfile'], '新选择 画像')
                self.assertEqual(response.headers['cache-control'], 'no-store')
                self.assertIn('新选择 画像', (await client.get('/api/platform-skill?format=connect')).text)
                self.assertIn('测试资料', (await client.get('/api/platform-skill?format=markdown')).text)
                self.assertTrue((await client.get('/api/v1/skill')).content.startswith(b'PK'))
                info['instanceId'] = 'new-owner'
                connection.write_text(json.dumps(info), encoding='utf8')
                self.assertEqual((await client.get('/api/agent-info')).status_code, 409)
                connection.write_text('{interrupted', encoding='utf8')
                self.assertEqual((await client.get('/api/platform-skill?format=connect')).status_code, 503)


class WorkspaceBootstrap(unittest.TestCase):
    def test_no_agent_configuration_or_junctions_and_existing_env_survives(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 工作目录 ') as temp:
            root = Path(temp)
            (root / '.env').write_bytes(b'USER_CONFIG=keep-exactly\r\n')
            with patch.dict(os.environ, {}, clear=True):
                bootstrap.prepare(root)
            self.assertEqual((root / '.env').read_bytes(), b'USER_CONFIG=keep-exactly\r\n')
            self.assertEqual({p.name for p in root.iterdir()}, {'.env', 'profiles', 'assets', 'outputs'})


class RetainedBusinessMath(unittest.TestCase):
    def test_original_analysis_formula_and_review_denominator(self):
        analyze = load_module('mediasail_test_analyze', SOURCE / 'skills/openclaw/skill-publish-analytics/scripts/analyze.py')
        review = load_module('mediasail_test_review', SOURCE / 'skills/openclaw/skill-social-performance-review/scripts/review.py')
        metrics = {'views': 100, 'likes': 10, 'comments': 2, 'shares': 1}
        result = analyze.analyze_time([{'published_at': '2026-10-15T19:00:00', 'initial_metrics': metrics}])
        self.assertEqual(result['by_bucket']['晚间']['avg_engagement_score'], 27)
        self.assertEqual(result['by_bucket']['晚间']['count'], 1)
        score = review.score_posts({'platform': 'bilibili', 'posts': [dict(metrics, saves=4, title='样本')]})
        self.assertEqual(score['per_post'][0]['engagement_score'], 27)
        self.assertEqual(score['per_post'][0]['er_denominator'], 'views')
        self.assertEqual(score['per_post'][0]['engagement_rate_pct'], 17)
        self.assertTrue(score['warnings'])  # Small samples remain explicitly limited.

    def test_tracker_direct_call_uses_selected_workspace_and_original_delta(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 统计 中文 ') as temp, \
             patch.dict(os.environ, {'EASEL_ROOT': temp}):
            tracker = load_module('mediasail_test_tracker', SOURCE / 'skills/openclaw/skill-data-tracker/scripts/track.py')
            args = dict(profile='测试 画像', platform='bilibili', posts=None, total_likes=None, total_posts=None)
            with redirect_stdout(io.StringIO()):
                tracker.cmd_snapshot(SimpleNamespace(**args, date='2026-10-14', followers=100))
            output = io.StringIO()
            with redirect_stdout(output):
                tracker.cmd_snapshot(SimpleNamespace(**args, date='2026-10-15', followers=120))
            result = json.loads(output.getvalue())
            self.assertEqual(result['delta_vs_last']['followers'], 20)
            self.assertTrue(Path(result['path']).is_relative_to(temp))
            self.assertEqual(len(list(Path(temp).rglob('2026-10-*.json'))), 2)


if __name__ == '__main__':
    unittest.main()
