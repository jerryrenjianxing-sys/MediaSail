"""Local skill distribution. No credentials, user documents, or command execution."""
import io
import json
import zipfile
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import Response, PlainTextResponse

def register(app, info):
    directory = Path(info["skillDir"])

    def files():
        return sorted(p for p in directory.rglob("*") if p.is_file()
                      and "__pycache__" not in p.parts and p.suffix != ".pyc")

    def connect():
        return f"""请使用 MediaSail Skill 与我协作。
MediaSail 保存我的画像、受众、运营分析、历史内容和素材；你可以结合这些背景发挥自己的研究、策划、创作与开发能力，并把有用成果和经验整理回软件。

本机连接资料：{info['connectionFile']}
本机完整 Skill：{directory / 'SKILL.md'}
当前服务：{info['baseUrl']}
完整 Skill 包：{info['baseUrl']}/api/v1/skill

请先读取本机 SKILL.md；也可以下载 Skill 包，解压后读取 mediasail/SKILL.md。后续需要工具、接口、数据或源码说明时，再查对应 references。
服务地址可能随重启改变，调用前通过连接资料和 scripts/mediasail.ps1 check 核对当前实例。自定义数据目录为：{info['dataDir']}。

初次接入时，简短告诉我实际连接情况、是否找到了工具与资料，然后重点介绍你能结合 MediaSail 帮我做什么。未检测的状态不要说成已连接；如果我同时给了任务，就自然继续任务。这段介绍不需要每轮重复。
"""

    @app.get("/api/agent-info")
    async def agent_info():
        return info

    @app.get("/api/platform-skill")
    @app.get("/api/v1/skill")
    async def skill(format: str = "zip"):
        if not (directory / "SKILL.md").is_file():
            raise HTTPException(503, "Skill 文件缺失，请修复安装。")
        if format == "connect":
            return PlainTextResponse(connect(), headers={"Cache-Control": "no-store"})
        if format == "markdown":
            body = "\n\n".join("<!-- "+p.relative_to(directory).as_posix()+" -->\n"+p.read_text(encoding="utf-8-sig")
                               for p in files() if p.suffix in (".md", ".ps1", ".py", ".yaml"))
            return PlainTextResponse(body, headers={"Cache-Control": "no-store"})
        if format != "zip":
            raise HTTPException(400, "format 支持 connect、markdown 或 zip")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for p in files():
                archive.write(p, Path("mediasail") / p.relative_to(directory))
        return Response(buffer.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="mediasail-skill.zip"',
                                 "Cache-Control": "no-store"})
