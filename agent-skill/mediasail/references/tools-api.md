# 工具与接口

先读取 agent-connection.json，通过 scripts/mediasail.ps1 check 核对实例；用返回的 baseUrl 拼接 /api/...。服务只监听本机，不需要额外 API Key。模型或平台业务仍可能需要用户已配置的密钥、登录状态和联网条件。

## 选哪种调用

- **本地工具**：workspace/skills/shared/scripts/ 和 workspace/skills/openclaw/<技能>/ 下有现成脚本与说明。按需读取对应 SKILL.md、脚本帮助及依赖；可用内置 Python/Node 执行，或用自己的工具。
- **现有业务 API**：调用下表接口；完整方法、请求体、参数和返回结构在 api-schema.json（从本版源码生成的 OpenAPI），运行中也可读 /openapi.json。
- **内置 Agent**：POST /api/chat、/api/chat/stream、/api/skill 会调用软件配置的模型/OpenClaw，可能进一步启动制作或发布任务。这与直接运行一个确定性脚本不同，不必把你的创作能力全部转交给它。
- **桌面操作**：AitoEarn 的登录、发送面板、上传与草稿流程目前属于 Electron 内部接口。外部脚本没有同等 HTTP 接口；可准备好成品，让用户在内容库点击「发送到 AI 发布」，再在官方页面完成后续操作。

## 常用入口

| 方法与路径 | 输入与结果 / 实际效果 |
| --- | --- |
| GET /api/agent-info | 本版本、实例 ID、路径及运行环境位置；不含密钥 |
| GET /api/status | gateway、skills、personas |
| GET /api/personas | 画像列表 |
| GET /api/persona/{name}、/files | 合并正文 / 文件列表 |
| PUT /api/persona/{name}/file | filename、content；替换单个画像文件 |
| DELETE /api/persona/{name} | 删除整个画像目录 |
| GET /api/skills、/api/skill/{name} | 技能列表 / 正文、接口配置状态 |
| POST /api/chat | message；可选 persona、sessionId、turnId、attachments；返回 response |
| POST /api/chat/stream | 同上；SSE 流，事件形态见源码与现有前端 streamChat |
| GET /api/chat/last/{session_id} | 查询上一轮记录 |
| GET /api/chat/jobs/{turn_id}/stream | 接续后台轮次的 SSE |
| POST /api/chat/stop | sessionId；停止对应任务 |
| POST /api/skill | skill、input、可选 persona；交给内置 Agent 执行，返回 response |
| GET /api/outputs | 内容库目录树、项目元数据与成品路径 |
| GET /api/output/{path} | 读取相对 outputs 路径下的文本；二进制使用 media |
| GET /api/media/{path} | 读取媒体文件，支持 Range |
| DELETE /api/output/{path} | 删除文件或目录 |
| POST /api/upload、/api/upload/local | multipart：files 与 sessionId；返回 files 中的 id/name/path。local 为分块写入通道，同样上传文件字节，不接受本地文件路径字符串 |
| GET /api/upload/limits | 当前普通上传大小上限 |
| GET /api/accounts | 各平台支持与登录标记 |
| POST /api/login/{platform} | 启动真实浏览器登录 |
| GET /api/login/{platform}/status | 登录进度、二维码等状态 |
| POST /api/login/{platform}/sms | code；提交验证码 |
| GET /api/accounts/{platform}/whoami | 实际校验账号，可能访问平台 |
| POST /api/logout/{platform} | 退出对应平台账号 |
| GET /api/analytics/platforms | 可分析平台与登录标记 |
| GET /api/analytics/{platform} | 真实采集账号数据并更新分析快照 |
| POST /api/publish/{platform} | title、body、media（outputs 相对路径数组）、tags；进入真实发布流程，不是创建草稿 |
| GET /api/publish/{platform}/status | 查询发布状态 |
| POST /api/publish/{platform}/sms | code；提供发布验证码 |
| GET /api/trends | 热点结果，可能联网 |
| GET /api/ideas | 选题列表 |
| POST /api/ideas | title；可选 note/source/status，返回带 id 的选题 |
| PUT/DELETE /api/ideas/{iid} | 更新/删除指定选题 |
| GET /api/schedule | 内容与活动日历 |
| POST /api/schedule | title、date（YYYY-MM-DD）；可选 platform/time/status/note/kind/url/source/event_type/end_date |
| PUT/DELETE /api/schedule/{sid} | 更新/删除日历条目 |
| GET /api/schedule/context | 日历上下文；参数见 OpenAPI |
| POST /api/profile/build | name、form；建立基线画像并后台增强，可能使用模型 |
| GET /api/profile/build/status/{name} | 画像生成状态 |
| GET /api/env/tools | 工具及依赖状态 |
| GET /api/settings/models | 模型配置展示 |
| POST /api/settings/models/save | 保存模型设置；嵌套结构见 OpenAPI |
| POST /api/settings/models/available、/selftest | 获取模型或实际测试服务 |
| GET /api/settings/local-agents | 本地 Agent 配置状态 |

其他接口按需检索 api-schema.json，或者 workspace/web/app.py 中对应处理函数。表中的发布、删除、配置保存是实质操作，依当前用户任务使用；连接检测本身只查看连接与路径，不会触发这些业务。

## 调用例子

PowerShell；DataDir 使用复制说明给出的实际路径：

~~~powershell
$info = Get-Content -LiteralPath (Join-Path $DataDir 'agent-connection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& $SkillHelper check --data-dir $DataDir
Invoke-RestMethod ($info.baseUrl + '/api/personas')
$body = @{title='春季内容选题';note='结合受众反馈测试两个角度';source='external-agent'} | ConvertTo-Json
Invoke-RestMethod ($info.baseUrl + '/api/ideas') -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
~~~

本地脚本：
~~~powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' read --topic '春季内容'
& $SkillHelper node --data-dir $DataDir --version
~~~

辅助脚本只为子进程设置软件的工作目录、隔离 HOME、浏览器位置和运行环境，不修改外部 Agent 的全局配置。模型、网站与浏览器任务各有真实耗时；请求超时不等于任务没执行，已有状态接口可用来核对。
