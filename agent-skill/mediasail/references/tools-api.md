# 工具与接口

先读取 agent-connection.json，通过 scripts/mediasail.ps1 check 核对实例；用当前 baseUrl 拼接 /api/...。服务只监听本机，不需要另填 API Key。平台账号和可选官方发布 API 仍需要对应登录或凭据。软件不再运行内置 Agent、模型执行循环或 OpenClaw 网关。

## 选哪种调用

- **本地业务脚本**：workspace/skills/shared/scripts/ 和对应方法的 scripts/。准确名单见 workspace/skills/business-tools.md。用内置业务 Python 或兼容的自有 Python 执行；本地计算不依赖桌面服务在线。通用创作引擎不随包提供。
- **业务 API**：调用下表接口。参数见 api-schema.json（由当前后端与连接桥实际注册的 OpenAPI 生成），运行中也可读 /openapi.json。部分旧处理函数未声明细化响应模型，不能把空 schema 误当没有结果；实际数据以当前响应为准。
- **外部 Agent 的智能工作**：研究、语义分析、画像增强、策划、创作和开发由你完成；不再使用旧 /api/chat 或 /api/skill 交回软件内模型。
- **桌面操作**：AitoEarn 的登录、发送面板、上传及草稿流程属于 Electron 内部界面。外部脚本没有等价 HTTP 草稿接口；准备好成品后，用户可在内容库点击「发送到 AI 发布」，在官方页面检查账号、平台和最终发布。

## 常用入口

| 方法与路径 | 输入与实际效果 |
| --- | --- |
| GET /api/agent-info | 当前版本、实例 ID、服务地址、路径、selectedProfile；不含密钥 |
| GET /api/platform-skill?format=connect | 简短接入说明；format=markdown 为完整可读 Skill |
| GET /api/v1/skill | 下载完整 Skill ZIP |
| GET /api/status | serviceReady、gateway:false、skills、personas；不要求网关 |
| GET /api/personas | 画像列表 |
| GET /api/persona/{name}、/files | 合并正文 / 分文件正文 |
| PUT /api/persona/{name}/file | filename、content；替换一个画像文件 |
| DELETE /api/persona/{name} | 删除画像目录 |
| POST /api/profile/build | name、form；创建表单基线，返回 baseline-ready；不调用模型 |
| GET /api/profile/build/status/{name} | 基线创建状态，不表示 Agent 已增强 |
| GET /api/skills、/api/skill/{name} | 可读业务/方法列表与正文；不是模型执行入口 |
| GET /api/outputs | 内容库目录树、项目元数据与成品路径 |
| GET /api/output/{path} | 读取 outputs 相对路径下的文本 |
| GET /api/media/{path} | 读取媒体，支持 Range |
| DELETE /api/output/{path} | 删除内容库文件或目录 |
| POST /api/upload、/api/upload/local | multipart files 与 sessionId；写入收件目录，返回 files 中 id/name/path，不接受本地路径字符串 |
| GET /api/upload/limits | 普通上传上限 |
| GET /api/accounts | 平台支持与登录标记 |
| POST /api/login/{platform} | 使用系统 Chrome/Edge 打开真实平台登录 |
| GET /api/login/{platform}/status | 登录状态、二维码等 |
| POST /api/login/{platform}/sms | code；提交验证码 |
| GET /api/accounts/{platform}/whoami | 实际校验账号，可能联网 |
| POST /api/logout/{platform} | 退出平台账号 |
| GET /api/analytics/platforms | 可分析平台与登录标记 |
| GET /api/analytics/{platform} | 真实采集并更新快照；可能启动浏览器，并非纯缓存 |
| POST /api/publish/{platform} | title、body、media（outputs 相对路径数组）、tags；真实业务操作，公众号分支通常为草稿，其他平台可能直接发布，按响应/平台说明核实 |
| GET /api/publish/{platform}/status | 查询发布状态 |
| POST /api/publish/{platform}/sms | code；提供发布验证码 |
| GET /api/trends | 热点结果，可能联网 |
| GET/POST /api/ideas | 查询 / title、可选 note/source/status，新增选题 |
| PUT/DELETE /api/ideas/{iid} | 更新/删除选题 |
| GET/POST /api/schedule | 日历 / title、date；可选 platform/time/status/note/kind/url/source/event_type/end_date |
| PUT/DELETE /api/schedule/{sid} | 更新/删除日历项 |
| GET /api/schedule/context | 日历上下文，参数见 schema |
| GET /api/env/tools | 业务 Python、系统浏览器等可用状态；不代表预装通用创作工具 |

旧聊天、模型配置和自动安装通用工具的接口已退出或返回 410，不从旧文档继续调用。删除、发布和配置保存都是实质业务操作，依用户任务使用；连接 check 本身只查看路径与连接，不会触发它们。请求超时不等于业务没有执行，已有状态接口可用于核对，尤其发布不要盲目重复。

## Windows 调用

DataDir 和 SkillHelper 使用复制说明中的实际绝对路径。中文、空格路径作为独立参数传递，不拼接 shell 命令：

```powershell
$DataDir = 'C:\Users\某用户\AppData\Local\ElectronEasel'
$SkillHelper = 'D:\应用目录\resources\agent-skill\mediasail\scripts\mediasail.ps1'
& $SkillHelper check --data-dir $DataDir
$info = Get-Content -LiteralPath (Join-Path $DataDir 'agent-connection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Invoke-RestMethod ($info.baseUrl + '/api/personas')
$payload = @{title='春季选题';note='结合受众反馈对比两个角度';source='external-agent'} | ConvertTo-Json
Invoke-RestMethod ($info.baseUrl + '/api/ideas') -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
```

辅助脚本为子进程设置工作目录和隔离运行环境，不修改外部 Agent 的全局配置。脚本每次读取最新连接文件；check 连接失败时仍报告找到的本地路径，python 命令仍可运行本地计算。Node 命令只寻找可选系统 Node，不是软件必要依赖，不自动安装。

## 基线响应

POST /api/profile/build 返回最小形状如下；动态值以实际响应为准：

```json
{"created":true,"name":"测试画像","async":false,"status":"baseline-ready"}
```

这只代表表单基线就绪；分析社媒、核对事实、标记来源、补充缺口和写入增强画像由外部 Agent 完成。连接 check 分开报告 connected、localToolsReady、found、selectedProfile，离线时 connected:false 不代表画像或计算不可用。读取/写入画像的结果见 context.md，内容库展示结构见 outputs.md，计算脚本输入输出见 [业务脚本示例](script-io.md)。
