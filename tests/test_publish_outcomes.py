"""Exercise the real publisher with only the external browser replaced."""
import contextlib
import importlib.util
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

SHARED = Path(__file__).resolve().parents[1] / 'vendor/easel/skills/shared/scripts'
sys.path.insert(0, str(SHARED))
import zhihu_answer


class AnswerOutcome(unittest.TestCase):
    def publish(self, final_url, *, before='https://www.zhihu.com/question/123', dry=False):
        page = Mock(url=before)
        page.query_selector.side_effect = lambda selector: None if 'SignContainer' in selector else Mock(inner_text=lambda: '测试问题')
        def evaluate(script, *args):
            if 'const texts' in script:
                page.url = final_url
                return '发布回答'
            if 'querySelectorAll' in script and 'a[href' in script:
                return [before]
            return True
        page.evaluate.side_effect = evaluate
        ctx = Mock(); ctx.new_page.return_value = page
        chromium = Mock(); chromium.launch_persistent_context.return_value = ctx
        factory = Mock(); factory.return_value.__enter__ = Mock(return_value=SimpleNamespace(chromium=chromium))
        factory.return_value.__exit__ = Mock(return_value=False)
        with patch('playwright.sync_api.sync_playwright', factory), contextlib.redirect_stderr(io.StringIO()):
            result = zhihu_answer.publish_answer('https://www.zhihu.com/question/123', '合成回答', dry_run=dry)
        return result

    def test_staying_on_question_is_unverified_not_success(self):
        result = self.publish('https://www.zhihu.com/question/123')
        self.assertFalse(result['success'])
        self.assertEqual(result['outcome'], 'unverified')

    def test_official_new_answer_is_verified(self):
        result = self.publish('https://www.zhihu.com/question/123/answer/456')
        self.assertTrue(result['success'])
        self.assertEqual(result['outcome'], 'verified')

    def test_other_question_host_and_old_answer_are_not_verified(self):
        for url in ['https://www.zhihu.com/question/999/answer/456', 'https://www.zhihu.com.evil.invalid/question/123/answer/456',
                    'https://www.zhihu.com/question/123/answer/111']:
            with self.subTest(url=url):
                result = self.publish(url, before='https://www.zhihu.com/question/123/answer/111')
                self.assertFalse(result['success'])

    def test_login_and_dry_run_are_distinct(self):
        self.assertEqual(self.publish('https://www.zhihu.com/signin')['outcome'], 'login_required')
        result = self.publish('https://www.zhihu.com/question/123', dry=True)
        self.assertTrue(result['dry_run'])
        self.assertEqual(result['outcome'], 'dry_run')


class DraftOutcome(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='MediaSail 公众号 中文 ')
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        scripts = root / 'scripts'; scripts.mkdir()
        source = SHARED.parent.parent / 'openclaw/skill-wechat-publisher/scripts'
        for name in ['api.py', 'config.py', 'wechat_token.py']:
            shutil.copyfile(source / name, scripts / name)
        (root / 'wechat-publisher.yaml').write_text('default: test\naccounts:\n  test:\n    app_id: synthetic\n    app_secret: synthetic\n', encoding='utf-8')
        saved = {name: sys.modules.pop(name, None) for name in ['config', 'wechat_token']}
        sys.path.insert(0, str(scripts))
        def restore():
            sys.path.remove(str(scripts))
            for name, value in saved.items():
                sys.modules.pop(name, None)
                if value is not None: sys.modules[name] = value
        self.addCleanup(restore)
        spec = importlib.util.spec_from_file_location('draft_api', scripts / 'api.py')
        self.api = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.api)

    def test_timeout_creates_only_one_remote_request(self):
        import requests
        token = Mock(status_code=200); token.json.return_value = {'access_token': 'synthetic', 'expires_in': 7200}
        with patch('requests.get', return_value=token), patch('requests.request', side_effect=requests.Timeout('synthetic timeout')) as network:
            with self.assertRaisesRegex(RuntimeError, '尚未确认'):
                self.api.add_draft({'title': '合成草稿', 'content': '保留正文'})
        self.assertEqual(network.call_count, 1, 'non-idempotent draft creation must never replay')

    def test_both_draft_types_preserve_payload_without_replay_for_ambiguous_responses(self):
        token = Mock(status_code=200); token.json.return_value = {'access_token': 'synthetic', 'expires_in': 7200}
        for status, body in [(503, {}), (302, {}), (200, {}), (200, {'media_id': ''}), (200, ['invalid'])]:
            response = Mock(status_code=status); response.json.return_value = body
            for kind in ['news', 'newspic']:
                with self.subTest(status=status, kind=kind), patch('requests.get', return_value=token), patch('requests.request', return_value=response) as network:
                    with self.assertRaises(self.api.DraftOutcomeUnknown) as result:
                        if kind == 'news': self.api.add_draft({'title': '保留标题', 'content': '原稿'})
                        else: self.api.add_newspic_draft('保留标题', '原稿', ['synthetic-media'])
                    self.assertEqual(result.exception.payload['articles'][0]['title'], '保留标题')
                    self.assertEqual(network.call_count, 1)
                    self.assertFalse(network.call_args.kwargs['allow_redirects'])

    def test_explicit_rejection_and_valid_receipt_remain_distinct(self):
        token = Mock(status_code=200); token.json.return_value = {'access_token': 'synthetic', 'expires_in': 7200}
        response = Mock(status_code=200)
        with patch('requests.get', return_value=token), patch('requests.request', return_value=response):
            response.json.return_value = {'errcode': 40007, 'errmsg': 'synthetic'}
            with self.assertRaisesRegex(RuntimeError, '平台拒绝'):
                self.api.add_draft({'title': '合成'})
            response.json.return_value = {'media_id': 'confirmed'}
            self.assertEqual(self.api.add_draft({'title': '合成'}), 'confirmed')


if __name__ == '__main__':
    unittest.main()

