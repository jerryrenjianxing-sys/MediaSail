"""Call the real CLI with a synthetic external browser, using no real account."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
HOME = "合成测试账号\n关注\n9\n粉丝指数\n7\n获赞\n74\n近7日\n播放量\n482\n较前7日-783\n主页访问量\n57\n较前7日+43\n作品分享\n0\n较前7日-5\n作品评论\n3\n较前7日+1"


def cards(count):
    return "内容管理\n作品 (%s)\n" % count + "\n".join(
        f"9张\n合成作品{i}\n编辑作品\n设置权限\n删除作品\n2026年11月02日 18:42\n已发布\n播放\n{500+i}\n点赞\n3\n评论\n1\n分享\n0\n收藏\n1\n划走率\n53.73%\n吸粉量\n0"
        for i in range(1, count + 1)) + "\n没有更多作品"


class CollectionCli(unittest.TestCase):
    def collect(self, **overrides):
        arguments = overrides.pop("cliArguments", [])
        with tempfile.TemporaryDirectory(prefix="MediaSail 采集 中文 ") as directory:
            root = Path(directory)
            fixture = root / "浏览器样本.json"
            fixture.write_text(json.dumps({"home": HOME, "content": cards(5), **overrides}, ensure_ascii=False), encoding="utf-8")
            env = dict(os.environ, EASEL_ROOT=str(root), EASEL_BROWSER_EXECUTABLE=sys.executable,
                       COLLECTION_FIXTURE=str(fixture), PYTHONUTF8="1", PYTHONDONTWRITEBYTECODE="1")
            run = subprocess.run([sys.executable, "-X", "utf8", "-B", str(ROOT / "tests/fixtures/collection_cli.py"),
                                  "fetch", "--platform", "douyin", "--profile-base", str(root / "浏览器资料"), *arguments],
                                 env=env, capture_output=True, text=True, encoding="utf-8", timeout=20)
            self.assertEqual(run.returncode, 0, run.stderr)
            return json.loads(run.stdout.strip().splitlines()[-1])

    def test_delayed_cards_are_collected_and_missing_follower_count_is_explained(self):
        data = self.collect(delayedReads=4)
        self.assertEqual(data["posts"], 5)
        self.assertEqual(len(data["notes"]), 5)
        self.assertIsNone(data["followers"])
        self.assertEqual(data["followerIndex"], 7)
        self.assertEqual(data["collection"]["status"], "partial")
        self.assertEqual(data["collection"]["missingFields"], ["followers"])
        self.assertEqual(data["collection"]["notesCoverage"]["total"], 5)
        self.assertTrue(data["collection"]["suggestions"])

    def test_connection_failure_preserves_home_counts_and_reports_the_failed_stage(self):
        data = self.collect(navigationError="net::ERR_CONNECTION_RESET at https://creator.douyin.com/?token=private-fixture")
        self.assertEqual(data["likes"], 74)
        self.assertTrue(data["loggedIn"])
        self.assertIsNone(data["posts"])
        problems = data["collection"]["issues"]
        failed = next(x for x in problems if x["field"] == "notes" and x["code"] != "sample_coverage")
        self.assertEqual(failed["code"], "content_navigation_failed")
        self.assertIn("ERR_CONNECTION_RESET", failed["message"])
        self.assertNotIn("private-fixture", json.dumps(data))

    def test_sample_is_not_described_as_all_and_the_caller_can_request_more(self):
        sample = self.collect(content=cards(9))
        self.assertEqual(len(sample["notes"]), 6)
        self.assertEqual(sample["posts"], 9)
        self.assertTrue(sample["collection"]["notesCoverage"]["hasMore"])
        larger = self.collect(content=cards(9), cliArguments=["--notes-limit", "12"])
        self.assertEqual(len(larger["notes"]), 9)
        self.assertFalse(larger["collection"]["notesCoverage"]["hasMore"])

    def test_explicit_zero_is_different_from_a_page_stuck_loading(self):
        empty = self.collect(content="内容管理\n作品 (0)\n暂无作品")
        self.assertEqual(empty["posts"], 0)
        self.assertEqual(empty["collection"]["notesCoverage"]["status"], "empty")
        self.assertNotIn("notes", empty["collection"]["missingFields"])
        loading = self.collect(content="内容管理\n加载中，请稍候…")
        self.assertIsNone(loading["posts"])
        self.assertIn("notes", loading["collection"]["missingFields"])
        self.assertEqual(loading["collection"]["notesCoverage"]["status"], "partial")
        self.assertTrue(any(p["code"] == "content_not_ready" for p in loading["collection"]["issues"]))

    def test_unreadable_data_is_failed_even_when_login_was_verified(self):
        data = self.collect(home="合成测试账号\n加载中", content="加载中")
        self.assertEqual(data["verificationStatus"], "verified")
        self.assertEqual(data["collection"]["status"], "failed")
        self.assertIsNone(data["followers"])
        self.assertIsNone(data["posts"])

    def test_a_stale_zero_counter_cannot_override_visible_published_cards(self):
        data = self.collect(content=cards(5).replace("作品 (5)", "作品 (0)"))
        self.assertIsNone(data["posts"])
        self.assertEqual(len(data["notes"]), 5)
        self.assertEqual(data["collection"]["status"], "partial")
        self.assertTrue(any(x["code"] == "content_count_conflict" for x in data["collection"]["issues"]))


if __name__ == "__main__":
    unittest.main()
