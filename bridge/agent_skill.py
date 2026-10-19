"""Local skill distribution. No credentials, user documents, or command execution."""
import io
import json
import os
import zipfile
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import Response, PlainTextResponse, JSONResponse

def register(app, info):
    initial = dict(info)
    connection_file = os.environ.get("EASEL_AGENT_CONNECTION_FILE") or initial.get("connectionFile")

    def current_info():
        # Profile selection/status changes while this process stays alive. Do
        # not serve a boot-time snapshot or impersonate a different instance.
        if connection_file:
            try:
                value = json.loads(Path(connection_file).read_text(encoding="utf-8-sig"))
            except (OSError, ValueError) as error:
                raise HTTPException(503, "连接资料暂不可读，请稍后重试。") from error
            if not isinstance(value, dict):
                raise HTTPException(503, "连接资料格式无效，请重新打开 MediaSail。")
            if initial.get("instanceId") and value.get("instanceId") != initial["instanceId"]:
                raise HTTPException(409, "连接资料已属于其他实例，请重新读取当前服务地址。")
        else:
            value = dict(initial)
        value.setdefault("selectedProfile", None)
        return value

    def files(directory):
        return sorted(p for p in directory.rglob("*") if p.is_file()
                      and "__pycache__" not in p.parts and p.suffix != ".pyc")

    def connect(info):
        directory = Path(info["skillDir"])
        discovery = info.get('discoveryFile') or info['connectionFile']
        literal = str(discovery).replace("'", "''")
        return f"""# 使用本机 MediaSail 与我协作

MediaSail 保存我的画像、受众、运营分析、历史内容和素材；你可以结合这些背景发挥自己的研究、策划、创作与开发能力，并把有用成果和经验整理回软件。

发现入口：{discovery}
本机完整 Skill：{directory / 'SKILL.md'}
复制时资料库：{info.get('libraryRoot') or info.get('workspace') or info.get('dataDir')}
复制时界面画像：{info.get('selectedProfile') or '尚未选择'}（具体任务使用任务指定的画像）

Windows 轻量连接命令（可直接运行，使用软件提供的运行环境）：

```powershell
$discovery = '{literal}'
$info = Get-Content -LiteralPath $discovery -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $info.skillDir) {{ throw '请先打开 MediaSail 并选择资料库。' }}
& (Join-Path $info.skillDir 'scripts/mediasail.ps1') check --data-dir (Split-Path -Parent $discovery)
```

软件重启或切库后，以发现入口和连接结果中的当前路径为准，再读取对应 SKILL.md。它说明工具、方法与资料在何处，相关 references 按任务查阅。画像、素材、成品和方法直接读写同一工作区。

初次接入时简短反馈实际服务状态、资料是否找到和能帮我做什么；已有任务就自然继续。不需要为接入遍历画像、测试平台或运行全量自检，也不需要每轮重复检查。未检测的状态如实说明；离线仍可读本机资料和执行本地业务计算，在线动作需启动软件。

仅在本机文件无法访问时，备用完整 Skill ZIP：{info['baseUrl']}/api/v1/skill（地址也是复制时快照）。云端或其他电脑上的 Agent 需要本机执行能力，不能靠反复访问自己的 localhost 连接这台电脑。
"""

    @app.get("/api/agent-info")
    async def agent_info():
        return JSONResponse(current_info(), headers={"Cache-Control": "no-store"})

    @app.get("/api/platform-skill")
    @app.get("/api/v1/skill")
    async def skill(format: str = "zip"):
        info = current_info()
        directory = Path(info["skillDir"])
        if not (directory / "SKILL.md").is_file():
            raise HTTPException(503, "Skill 文件缺失，请修复安装。")
        if format == "connect":
            return PlainTextResponse(connect(info), headers={"Cache-Control": "no-store"})
        if format == "markdown":
            body = "\n\n".join("<!-- "+p.relative_to(directory).as_posix()+" -->\n"+p.read_text(encoding="utf-8-sig")
                               for p in files(directory) if p.suffix in (".md", ".ps1", ".py", ".yaml"))
            return PlainTextResponse(body, headers={"Cache-Control": "no-store"})
        if format != "zip":
            raise HTTPException(400, "format 支持 connect、markdown 或 zip")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for p in files(directory):
                archive.write(p, Path("mediasail") / p.relative_to(directory))
        return Response(buffer.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="mediasail-skill.zip"',
                                 "Cache-Control": "no-store"})
