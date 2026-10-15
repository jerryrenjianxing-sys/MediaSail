"""Small local launcher; the service has no arbitrary command execution endpoint."""
import argparse
import json
import os
import shutil
from pathlib import Path
import subprocess
import sys
import urllib.request
from urllib.parse import urlsplit

def check(info):
    core = ("workspace", "skillDir", "python", "profiles", "outputs", "tools")
    found = {k: bool(info.get(k)) and Path(info[k]).exists() for k in core}
    result = {"product": "MediaSail", "version": info["version"], "connected": False,
              "paths": {k: info.get(k) for k in found}, "found": found, "baseUrl": info.get("baseUrl"),
              "selectedProfile": info.get("selectedProfile"),
              "localToolsReady": all(found.values()),
              "optional": {"node": shutil.which("node"), "ffmpeg": shutil.which("ffmpeg")}}
    try:
        url = info.get("baseUrl") or ""
        parts = urlsplit(url)
        if parts.scheme != "http" or parts.hostname != "127.0.0.1" or parts.username or parts.path not in ("", "/"):
            raise ValueError("软件未运行，或连接地址无效")
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url + "/api/agent-info", timeout=4) as response:
            live = json.load(response)
        if live.get("product") != "MediaSail" or live.get("instanceId") != info["instanceId"]:
            raise ValueError("服务身份已变化，请重新读取连接资料")
        result["connected"] = True
        result["selectedProfile"] = live.get("selectedProfile", info.get("selectedProfile"))
        with opener.open(url + "/api/status", timeout=6) as response:
            status = json.load(response)
            result["serviceReady"] = bool(status.get("serviceReady", True))
    except Exception as exc:
        result["error"] = str(exc)
    result["ok"] = result["connected"] and result["localToolsReady"] and result.get("serviceReady", False)
    return result

def main():
    parser = argparse.ArgumentParser(description="MediaSail: check | python <args> | node <args> (optional system Node)")
    parser.add_argument("--connection", required=True)
    parser.add_argument("command", choices=("check", "python", "node"), nargs="?", default="check")
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    info = json.loads(Path(args.connection).read_text(encoding="utf-8-sig"))
    if info.get("schema") != 1 or info.get("product") != "MediaSail":
        raise ValueError("Unsupported connection file")
    if args.command == "check":
        result = check(info)
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result["ok"] else 1
    # Only filesystem/runtime variables are exported by the desktop application.
    env = os.environ.copy()
    env.update(info.get("environment") or {})
    env["EASEL_ROOT"] = info["workspace"]
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    # Local business calculations remain usable while the desktop service is stopped.
    # Only HTTP operations need a live identity check. Node is an optional agent tool.
    executable = info.get("python") if args.command == "python" else shutil.which("node")
    if not executable:
        raise ValueError("当前环境未找到可选 Node.js；MediaSail 业务 Python 不依赖 Node.js")
    return subprocess.call([executable, *args.arguments], cwd=info["workspace"], env=env)

if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
