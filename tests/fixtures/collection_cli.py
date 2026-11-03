"""Synthetic browser boundary for the real account_stats CLI; never contacts a platform."""
import json
import os
import html
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, os.environ.get("COLLECTION_SOURCE", str(ROOT / "vendor/easel/skills/shared/scripts")))
import account_stats

case = json.loads(Path(os.environ["COLLECTION_FIXTURE"]).read_text(encoding="utf-8"))


class Page:
    url = "about:blank"
    mouse = SimpleNamespace(wheel=lambda *args: None)

    def __init__(self):
        self.reads = 0

    def goto(self, url, **kwargs):
        self.url = url
        self.reads = 0
        if "content/manage" in url and case.get("navigationError"):
            raise RuntimeError(case["navigationError"])

    def inner_text(self, selector):
        if "/creator/followers" in self.url:
            return "关注者总数\n123"
        if "content/manage" not in self.url:
            return case["home"]
        self.reads += 1
        if case.get("readSequence"):
            value = case["readSequence"][min(self.reads - 1, len(case["readSequence"]) - 1)]
            if isinstance(value, dict):
                raise RuntimeError(value["error"])
            return value
        return case.get("loading", "加载中，请稍候…") if self.reads <= case.get("delayedReads", 0) else case["content"]

    def evaluate(self, script, arg=None):
        if arg is not None:
            return {"httpStatus": 200, "body": {"status_code": 0,
                    "user": {"uid": "synthetic-account", "nickname": "合成测试账号"}}}
        # Old DOM extraction cannot see a renamed card; text remains readable.
        return case.get("notesResult", [])

    def wait_for_timeout(self, duration):
        pass

    def wait_for_selector(self, selector, **kwargs):
        pass  # An avatar already exists, exactly as in the reported loading race.

    def query_selector(self, selector):
        return None


page = Page()
context = SimpleNamespace(pages=[page], close=lambda: None)
def launch_fake(*args, **kwargs):
    if case.get("startupError"):
        raise RuntimeError(case["startupError"])
    return context
chromium = SimpleNamespace(launch_persistent_context=launch_fake)


class Browser:
    def __enter__(self):
        if os.environ.get("COLLECTION_REAL_BROWSER") == "1":
            self.manager = real_playwright()
            self.playwright = self.manager.__enter__()
            original = self.playwright.chromium.launch_persistent_context

            def launch(*args, **kwargs):
                kwargs.setdefault("timeout", 20000)
                context = original(*args, **kwargs)

                def respond(route):
                    url = route.request.url
                    if "media/user/info" in url:
                        return route.fulfill(json={"status_code": 0, "user": {"uid": "synthetic-account", "nickname": "合成测试账号"}})
                    content = "content/manage" in url
                    if content and case.get("navigationError"):
                        return route.abort("connectionreset")
                    initial = case.get("loading", "加载中，请稍候…") if content else case["home"]
                    later = case["content"] if content else case["home"]
                    document = '<html><body><img alt="avatar"><main id="sample" style="white-space:pre-wrap">' + html.escape(initial) + '</main><script>setTimeout(()=>{document.getElementById("sample").innerText=' + json.dumps(later) + '},' + str(case.get("delayMs", 1600) if content else 0) + ')</script></body></html>'
                    return route.fulfill(content_type="text/html; charset=utf-8", body=document)

                context.route("https://creator.douyin.com/**", respond)
                return context

            self.launch_patch = patch.object(self.playwright.chromium, "launch_persistent_context", launch)
            self.launch_patch.start()
            return self.playwright
        return SimpleNamespace(chromium=chromium)

    def __exit__(self, *args):
        if hasattr(self, "manager"):
            self.launch_patch.stop()
            return self.manager.__exit__(*args)
        return False


from playwright.sync_api import sync_playwright as real_playwright
with patch("playwright.sync_api.sync_playwright", Browser):
    sys.exit(account_stats.main())
