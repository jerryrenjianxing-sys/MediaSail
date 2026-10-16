"""Automatic platform growth never borrows an unowned/foreign baseline. No IO to platforms."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

SHARED = Path(__file__).resolve().parents[1] / 'vendor/easel/skills/shared/scripts'
sys.path.insert(0, str(SHARED))
import account_stats as stats
import bili_login as bili
import weixin_mp_stats as wechat


class GrowthIdentity(unittest.TestCase):
    def sample(self, **changes):
        return dict({'ts': 100000, 'platform': 'xiaohongshu', 'source': 'xiaohongshu-creator',
                     'accountId': 'account-a', 'verificationStatus': 'verified', 'loggedIn': True,
                     'followers': 120, 'likes': None, 'posts': 3}, **changes)

    def test_all_identity_dimensions_and_time_are_required_without_changing_arithmetic(self):
        current = self.sample()
        good = self.sample(ts=100, followers=100, posts=2)
        foreign = [self.sample(ts=101, followers=900, accountId='account-b'),
                   self.sample(ts=102, followers=800, source='other-page'),
                   self.sample(ts=103, followers=700, platform='douyin'),
                   self.sample(ts=104, followers=600, verificationStatus='unknown'),
                   self.sample(ts=100001, followers=500), {'ts': 105, 'followers': 400}]
        growth = stats.growth_windows([good, *foreign], current)
        self.assertEqual(growth['last']['followers'], 20)
        self.assertIsNone(growth['last']['likes'])
        self.assertEqual(growth['last']['posts'], 1)
        self.assertIsNone(stats.growth_windows(foreign, current)['last'])
        for missing in ('platform', 'accountId', 'source', 'verificationStatus'):
            row = dict(current); row.pop(missing)
            self.assertTrue(all(value is None for value in stats.growth_windows([good], row).values()))

    def test_unidentified_partial_counts_and_failed_collections_never_rewrite_history(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 未归属 ') as temporary, patch.object(stats, 'ANALYTICS_DIR', Path(temporary)):
            for platform in stats.PLATFORMS:
                history = Path(temporary) / (platform + '.jsonl')
                original = b' {"ts": 1, "followers": 999} \r\n{"ts":2,"likes":null}'
                history.write_bytes(original)
                base = {'nickname': 'same nickname', 'followers': 12, 'likes': None, 'following': None,
                        'posts': None, 'metrics': [], 'notes': [], 'logged_in': True}
                for fields in ({}, {'verificationStatus': 'unknown', 'accountId': 'a', 'source': 'creator'},
                               {'verificationStatus': 'login_required', 'accountId': 'a', 'source': 'creator', 'logged_in': False}):
                    args = SimpleNamespace(platform=platform, headed=False, profile_base=temporary, no_proxy=True, proxy=None)
                    output = io.StringIO()
                    with patch.object(stats, '_scrape', return_value={**base, **fields}), contextlib.redirect_stdout(output):
                        stats.cmd_fetch(args)
                    result = json.loads(output.getvalue())
                    self.assertEqual(result['followers'], 12)
                    self.assertIsNone(result['likes'])
                    self.assertEqual(result['growthStatus'], 'identity_unverified')
                    self.assertTrue(result['growthReason'])
                    self.assertTrue(all(value is None for value in result['growth'].values()))
                    self.assertEqual(history.read_bytes(), original)

    def test_verified_append_keeps_legacy_bytes_and_changed_accounts_separate(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 旧行 ') as temporary, patch.object(stats, 'ANALYTICS_DIR', Path(temporary)):
            history = Path(temporary) / 'xiaohongshu.jsonl'
            original = b' {"ts": 1, "followers": 999} '
            history.write_bytes(original)
            for account, count in [('a', 10), ('b', 900), ('a', 15)]:
                result = self.sample(accountId=account, followers=count)
                stats.attach_growth(result, 'xiaohongshu', source='xiaohongshu-creator', now=100000 + count)
                if account == 'b':
                    self.assertEqual(result['growthStatus'], 'no_history')
                    self.assertIsNone(result['growth']['last'])
            self.assertEqual(result['growth']['last']['followers'], 5)
            self.assertTrue(history.read_bytes().startswith(original + b'\n'))
            rows = stats.load_history('xiaohongshu')
            self.assertEqual(len(rows), 4)
            self.assertTrue(all(row['platform'] == 'xiaohongshu' and row['source'] and row['accountId'] for row in rows[1:]))
            # Even a direct writer must not add unknown or wrong-platform rows.
            before = history.read_bytes()
            stats.record_snapshot('xiaohongshu', self.sample(verificationStatus='unknown'))
            stats.record_snapshot('xiaohongshu', self.sample(platform='douyin'))
            self.assertEqual(history.read_bytes(), before)

    def test_wechat_counts_without_stable_identity_stay_visible_without_new_snapshot(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail 公众号 ') as temporary, patch.object(stats, 'ANALYTICS_DIR', Path(temporary)):
            history = Path(temporary) / 'wechat-oa.jsonl'; original = b'{"ts":1,"followers":100}\r\n'; history.write_bytes(original)
            result = {'loggedIn': True, 'followers': 200, 'likes': None, 'posts': 2}
            wechat._attach_growth(result)
            self.assertEqual(result['followers'], 200)
            self.assertEqual(result['growthStatus'], 'identity_unverified')
            self.assertTrue(all(value is None for value in result['growth'].values()))
            self.assertEqual(history.read_bytes(), original)

    def test_bilibili_uses_existing_authenticated_nav_id_and_no_fake_zero_growth(self):
        with tempfile.TemporaryDirectory(prefix='MediaSail B站 ') as temporary, patch.object(stats, 'ANALYTICS_DIR', Path(temporary)):
            args = SimpleNamespace(cookie=None)
            def collect(account, followers, failure=False):
                def response(url, _cookie):
                    if url.endswith('/nav'): return {'data': {'isLogin': True, 'mid': account, 'uname': 'same nickname'}}
                    if failure: raise RuntimeError('synthetic collection failure')
                    if url.endswith('/nav/stat'): return {'data': {'follower': followers}}
                    return {'data': {}}
                output = io.StringIO()
                with patch.object(bili, '_load_cookie', return_value=('synthetic-cookie', 999)), patch.object(bili, '_api', side_effect=response), contextlib.redirect_stdout(output):
                    bili.cmd_stats(args)
                return json.loads(output.getvalue())
            first = collect(123, 100)
            self.assertEqual(first['accountId'], '123')
            self.assertEqual(first['growthStatus'], 'no_history')
            second = collect(123, 120)
            self.assertEqual(second['growth']['last']['followers'], 20)
            self.assertIsNone(collect(456, 900)['growth']['last'])
            before = (Path(temporary) / 'bilibili.jsonl').read_bytes()
            self.assertEqual(collect(None, 50)['growthStatus'], 'identity_unverified')
            self.assertEqual(collect(123, 140, failure=True)['growthStatus'], 'identity_unverified')
            self.assertEqual((Path(temporary) / 'bilibili.jsonl').read_bytes(), before)
            output = io.StringIO()
            with patch.object(bili, '_load_cookie', return_value=('', None)), contextlib.redirect_stdout(output): bili.cmd_stats(args)
            self.assertTrue(all(value is None for value in json.loads(output.getvalue())['growth'].values()))


if __name__ == '__main__': unittest.main()
