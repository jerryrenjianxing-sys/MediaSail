"""Isolated creator-session and attribution regression checks. No platform IO."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT / "vendor/easel/skills/shared/scripts"
sys.path.insert(0, str(SHARED))
import account_stats as stats
import creator_auth as auth
import douyin_publish as douyin
import login_state
import platform_readback as readback
from profile_lock import ProfileLock, ProfileBusyError


def arguments(root):
    return SimpleNamespace(profile_base=str(root / "平台资料"), no_proxy=True, proxy=None,
        headed=True, qr_out=str(root / "二维码.png"), status_file=str(root / "登录.json"),
        sms_code_file=None, timeout=1)


class CreatorIdentity(unittest.TestCase):
    def test_authoritative_id_and_explicit_three_states(self):
        page = SimpleNamespace(url="https://creator.douyin.com/")
        payloads = [
            ({"httpStatus": 200, "body": {"status_code": 0, "user_info": {"uid": "account-a", "nickname": "样本"}}}, "verified"),
            ({"httpStatus": 200, "body": {"status_code": 8, "status_msg": "用户未登录"}}, "login_required"),
            ({"httpStatus": 200, "body": {"status_code": 0, "user_info": {"nickname": "不能仅凭昵称"}}}, "unknown"),
            ({"httpStatus": 401, "body": {}}, "login_required"),
            ({"httpStatus": 403, "body": {}}, "unknown"),
            ({"httpStatus": 200, "fetchError": "network interrupted"}, "unknown"),
        ]
        for response, state in payloads:
            with self.subTest(state=state, response=response), patch.object(readback, "_navigation_safe_evaluate", return_value=response) as call:
                result = auth.verify_douyin(page)
                self.assertEqual(result["verificationStatus"], state)
                self.assertEqual(result["loggedIn"], state == "verified")
                self.assertEqual(result["accountId"], "account-a" if state == "verified" else None)
                self.assertIsInstance(result["checkedAt"], int)
                self.assertEqual(call.call_args.args[2][0], readback.DOUYIN_PROFILE_API)

    def test_button_cannot_replace_missing_identity(self):
        self.assertEqual(auth.result("verified", account={"display_name": "昵称"})["verificationStatus"], "unknown")
        self.assertEqual(auth.failure(ProfileBusyError("busy"))["errorCode"], "profile_busy")


class PersistentLogin(unittest.TestCase):
    def test_transient_reopen_navigation_retries_once_before_verifying(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 登录重试 ") as temp:
            args=arguments(Path(temp));page=Mock()
            page.goto.side_effect=[RuntimeError("Page.goto: net::ERR_CONNECTION_TIMED_OUT"),None]
            ctx=Mock(pages=[page]);factory=Mock()
            factory.return_value.__enter__=Mock(return_value=object())
            factory.return_value.__exit__=Mock(return_value=False)
            expected=auth.result("verified",account={"platform_account_id":"test-account"})
            with patch("playwright.sync_api.sync_playwright",factory),patch.object(douyin,"_launch",return_value=ctx),patch.object(auth,"verify_douyin",return_value=expected) as verify,contextlib.redirect_stderr(io.StringIO()):
                result=douyin._verify_persisted_login(args)
            self.assertEqual(result["verificationStatus"],"verified")
            self.assertEqual([call.kwargs["timeout"] for call in page.goto.call_args_list],[30000,15000])
            self.assertEqual(verify.call_args.args,(page,));self.assertEqual(verify.call_args.kwargs["evaluate_retries"],1)
            ctx.close.assert_called_once()

    def test_loaded_creator_origin_can_verify_after_dom_timeout_without_navigating_again(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 登录已载入 ") as temp:
            args=arguments(Path(temp));page=Mock(url="https://creator.douyin.com/")
            page.goto.side_effect=RuntimeError("Page.goto: net::ERR_CONNECTION_TIMED_OUT")
            ctx=Mock(pages=[page]);factory=Mock()
            factory.return_value.__enter__=Mock(return_value=object())
            factory.return_value.__exit__=Mock(return_value=False)
            for state in ("verified","login_required","unknown"):
                expected=auth.result(state,account={"platform_account_id":"test-account"},message="HTTP 403" if state=="unknown" else "")
                page.goto.reset_mock()
                with patch("playwright.sync_api.sync_playwright",factory),patch.object(douyin,"_launch",return_value=ctx),patch.object(auth,"verify_douyin",return_value=expected):
                    status=douyin._verify_persisted_login(args)
                self.assertEqual(status["verificationStatus"],state)
                self.assertEqual(page.goto.call_count,1)

    def test_persistent_reopen_timeout_remains_unknown_and_releases_profile(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 登录持续超时 ") as temp:
            args=arguments(Path(temp));page=Mock()
            page.goto.side_effect=RuntimeError("Page.goto: net::ERR_CONNECTION_TIMED_OUT")
            ctx=Mock(pages=[page]);factory=Mock()
            factory.return_value.__enter__=Mock(return_value=object())
            factory.return_value.__exit__=Mock(return_value=False)
            with patch("playwright.sync_api.sync_playwright",factory),patch.object(douyin,"_run_login",return_value=0),patch.object(douyin,"_launch",return_value=ctx),patch.object(auth,"verify_douyin") as verify,contextlib.redirect_stderr(io.StringIO()),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(douyin.cmd_login(args),4)
            self.assertEqual(page.goto.call_count,2);verify.assert_not_called();ctx.close.assert_called_once()
            saved=json.loads(Path(args.status_file).read_text(encoding="utf8"))
            self.assertEqual(saved["state"],"error");self.assertEqual(saved["verificationStatus"],"unknown")
            with ProfileLock(douyin._profile_dir(args.profile_base),timeout=0):
                pass

    def test_success_is_after_both_contexts_close_and_profile_unlock(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 登录 中文 ") as temp:
            root, events = Path(temp), []
            args = arguments(root)
            contexts = []
            for index in range(2):
                page = Mock()
                page.query_selector.side_effect = lambda selector: None if selector == douyin.SELECTORS["qrcode"] else object()
                ctx = Mock(pages=[page])
                ctx.close.side_effect = lambda index=index: events.append("close" + str(index))
                contexts.append(ctx)
            factory = Mock()
            factory.return_value.__enter__ = Mock(return_value=object())
            factory.return_value.__exit__ = Mock(return_value=False)
            write = login_state.write_status

            def observed_write(path, state, *positional, **extra):
                if state == "success":
                    self.assertEqual(events, ["close0", "close1"])
                    with ProfileLock(douyin._profile_dir(args.profile_base), timeout=0):
                        events.append("unlocked-before-success")
                return write(path, state, *positional, **extra)

            with patch("playwright.sync_api.sync_playwright", factory), \
                 patch.object(douyin, "_launch", side_effect=contexts), \
                 patch.object(auth, "verify_douyin", return_value=auth.result("verified", account={"platform_account_id": "a", "display_name": "测试账号"})), \
                 patch.object(login_state, "write_status", side_effect=observed_write), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(douyin.cmd_login(args), 0)
            saved = json.loads(Path(args.status_file).read_text(encoding="utf8"))
            self.assertEqual(saved["state"], "success")
            self.assertEqual(saved["accountId"], "a")
            self.assertEqual(events[-1], "unlocked-before-success")

    def test_reopen_failure_keeps_profile_and_is_not_a_false_success(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 登录失败 ") as temp:
            root = Path(temp)
            args = arguments(root)
            profile = douyin._profile_dir(args.profile_base)
            profile.mkdir(parents=True)
            sentinel = profile / "retained-session.txt"
            sentinel.write_text("unchanged", encoding="utf8")
            for failure in (auth.result("login_required", error_code="login_required", message="未登录"), auth.result(error_code="verification_failed", message="网络错误")):
                with patch.object(douyin, "_run_login", return_value=0), \
                     patch.object(douyin, "_verify_persisted_login", return_value=failure), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(douyin.cmd_login(args), 4)
                saved = json.loads(Path(args.status_file).read_text(encoding="utf8"))
                self.assertEqual(saved["state"], "error")
                self.assertEqual(saved["verificationStatus"], failure["verificationStatus"])
                self.assertEqual(sentinel.read_text(encoding="utf8"), "unchanged")

    def test_whoami_and_publish_observe_the_same_profile_lock(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 操作互斥 ") as temp:
            args = arguments(Path(temp))
            with patch.object(douyin, "_verify_persisted_login", side_effect=lambda _: self.assert_locked(args)), contextlib.redirect_stdout(io.StringIO()):
                douyin.cmd_whoami(args)
            args.exec = True
            with patch.object(douyin, "_publish_unlocked", side_effect=lambda *_: self.assert_locked(args)):
                douyin._publish(args, "video")

    def assert_locked(self, args):
        with self.assertRaises(ProfileBusyError):
            with ProfileLock(douyin._profile_dir(args.profile_base), timeout=0):
                pass
        return auth.result()


class BrowserLock(unittest.TestCase):
    def test_another_process_waits_then_can_acquire_without_deleting_any_profile(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 锁 中文 ") as temp:
            profile = Path(temp) / "空格 资料"
            code = "from profile_lock import ProfileLock; import sys;\nwith ProfileLock(sys.argv[1],timeout=0): print('acquired')"
            env = dict(__import__("os").environ, PYTHONPATH=str(SHARED), PYTHONDONTWRITEBYTECODE="1", PYTHONUTF8="1")
            with ProfileLock(profile):
                busy = subprocess.run([sys.executable, "-B", "-c", code, str(profile)], env=env, capture_output=True, text=True)
                self.assertNotEqual(busy.returncode, 0)
                self.assertIn("ProfileBusyError", busy.stderr)
            ready = subprocess.run([sys.executable, "-B", "-c", code, str(profile)], env=env, capture_output=True, text=True)
            self.assertEqual(ready.returncode, 0, ready.stderr)
            self.assertIn("acquired", ready.stdout)


class AccountSnapshots(unittest.TestCase):
    def test_foreign_legacy_and_different_source_are_not_growth_baselines(self):
        current = {"ts": 100000, "followers": 15, "likes": None, "posts": 2,
                   "accountId": "a", "source": auth.DOUYIN_SOURCE, "platform": "douyin", "verificationStatus": "verified"}
        history = [dict(current, ts=1, followers=999, accountId="b"),
                   {"ts": 2, "followers": 888},
                   dict(current, ts=3, followers=777, source="public-page"),
                   dict(current, ts=4, followers=10)]
        self.assertEqual(stats.growth_windows(history, current)["last"]["followers"], 5)
        self.assertIsNone(stats.growth_windows(history[:-1], current)["last"])

    def test_only_verified_account_records_and_old_bytes_remain(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 快照 中文 ") as temp, patch.object(stats, "ANALYTICS_DIR", Path(temp)):
            history = Path(temp) / "douyin.jsonl"
            original = '{"ts":1,"followers":null,"likes":123200,"posts":null}\n'
            history.write_text(original, encoding="utf8")
            args = SimpleNamespace(platform="douyin", headed=False, profile_base=str(Path(temp)/"profiles"), no_proxy=True, proxy=None)
            base = {"nickname": "样本", "followers": 12, "likes": None, "following": None, "posts": 2, "metrics": [], "notes": []}
            for state in ("unknown", "login_required", "verified"):
                verification = auth.result(state, account={"platform_account_id": "a", "display_name": "样本"})
                sample = dict(base, logged_in=verification["loggedIn"], source=auth.DOUYIN_SOURCE, **verification)
                with patch.object(stats, "_scrape", return_value=sample), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(stats.cmd_fetch(args), 0)
                if state != "verified":
                    self.assertEqual(history.read_text(encoding="utf8"), original)
            contents = history.read_text(encoding="utf8")
            self.assertTrue(contents.startswith(original))
            self.assertEqual(len(contents.splitlines()), 2)
            self.assertEqual(json.loads(contents.splitlines()[1])["accountId"], "a")

    def test_collector_holds_profile_lock_and_failure_returns_unknown(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 采集互斥 ") as temp:
            def scrape(*_):
                with self.assertRaises(ProfileBusyError):
                    with ProfileLock(stats._profile_dir("douyin", temp), timeout=0):
                        pass
                raise RuntimeError("network test failure")
            with patch.object(stats, "_scrape_unlocked", side_effect=scrape):
                result = stats._scrape("douyin", False, temp, None)
            self.assertEqual(result["verificationStatus"], "unknown")
            self.assertFalse(result["logged_in"])

    def test_legacy_final_row_without_newline_remains_readable(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 旧快照 ") as temp, patch.object(stats, "ANALYTICS_DIR", Path(temp)):
            history = Path(temp) / "douyin.jsonl"
            original = '{"ts":1,"followers":99}'
            history.write_text(original, encoding="utf8")
            stats.record_snapshot("douyin", {"ts": 2, "followers": 10, "verificationStatus": "verified",
                "accountId": "a", "source": auth.DOUYIN_SOURCE, "platform": "douyin"})
            self.assertTrue(history.read_bytes().startswith(original.encode()))
            self.assertEqual(len(stats.load_history("douyin")), 2)

    def test_collector_uses_douyin_launch_instead_of_different_browser_flags(self):
        with tempfile.TemporaryDirectory(prefix="MediaSail 统一浏览器 ") as temp:
            page = Mock()
            ctx = Mock(pages=[page])
            factory = Mock()
            factory.return_value.__enter__ = Mock(return_value=object())
            factory.return_value.__exit__ = Mock(return_value=False)
            with patch("playwright.sync_api.sync_playwright", factory), \
                 patch.object(douyin, "_launch", return_value=ctx) as launch, \
                 patch.object(auth, "verify_douyin", return_value=auth.result("login_required")):
                stats._scrape("douyin", True, temp, "http://test.invalid")
            self.assertEqual(launch.call_args.args[1:], (True, temp, "http://test.invalid"))
            ctx.close.assert_called_once()


class TrackerPlatform(unittest.TestCase):
    def test_snapshot_uses_earlier_same_platform_and_trend_requires_platform(self):
        path = ROOT / "vendor/easel/skills/openclaw/skill-data-tracker/scripts/track.py"
        spec = importlib.util.spec_from_file_location("account_business_tracker", path)
        tracker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tracker)
        with tempfile.TemporaryDirectory(prefix="MediaSail 多平台 ") as temp, \
             patch.object(tracker, "SNAP_ROOT", Path(temp)/"current"), \
             patch.object(tracker, "LEGACY_SNAP_ROOT", Path(temp)/"legacy"):
            args = dict(profile="测试", posts=None, total_likes=None, total_posts=None)
            for platform, date, followers in [("douyin", "2026-10-10", 10), ("xiaohongshu", "2026-10-14", 999), ("douyin", "2026-10-18", 1000)]:
                with contextlib.redirect_stdout(io.StringIO()):
                    tracker.cmd_snapshot(SimpleNamespace(**args, platform=platform, date=date, followers=followers))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                tracker.cmd_snapshot(SimpleNamespace(**args, platform="douyin", date="2026-10-15", followers=15))
            self.assertEqual(json.loads(output.getvalue())["delta_vs_last"]["followers"], 5)
            with self.assertRaisesRegex(SystemExit, "--platform"):
                tracker.cmd_trend(SimpleNamespace(profile="测试", platform=None))
            with self.assertRaisesRegex(SystemExit, "--platform"):
                tracker.cmd_lifecycle(SimpleNamespace(profile="测试", platform=None))


if __name__ == "__main__":
    unittest.main()
