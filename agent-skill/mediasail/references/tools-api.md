# 工具与接口

先读取 agent-connection.json，通过 scripts/mediasail.ps1 check 核对实例；用当前 baseUrl 拼接 /api/...。服务只监听本机，不需要另填 API Key。平台账号和可选官方发布 API 仍需要对应登录或凭据。软件不再运行内置 Agent、模型执行循环或 OpenClaw 网关。

## 选哪种调用

- **本地业务脚本**：workspace/skills/shared/scripts/ 和对应方法的 scripts/。准确名单见 workspace/skills/business-tools.md。用内置业务 Python 或兼容的自有 Python 执行；本地计算不依赖桌面服务在线。通用创作引擎不随包提供。
- **业务 API**：调用下表接口。参数见 api-schema.json（由当前后端与连接桥实际注册的 OpenAPI 生成），运行中也可读 /openapi.json。部分旧处理函数未声明细化响应模型，不能把空 schema 误当没有结果；实际数据以当前响应为准。
- **外部 Agent 的智能工作**：研究、语义分析、画像增强、策划、创作和开发由你完成；不再使用旧 /api/chat 或 /api/skill 交回软件内模型。
- **AI 发布官网**：侧栏“AI 发布”用默认浏览器打开固定地址 https://aitoearn.cn/zh-CN。用户或 Agent 从项目成品文件读取、复制正文；用户在官网选择项目媒体、检查顺序、登录、安装所需扩展、选择账号和最终发布。官网不会自动读取本地资料库。软件不再内嵌、自动上传或创建 AitoEarn 草稿，不提供对应 HTTP API。网页发布结果不自动回写，按实际结果登记本地记录。下表的原生 `/api/publish/{platform}` 及其平台资料是独立能力，继续保留。

## 常用入口

| 方法与路径 | 输入与实际效果 |
| --- | --- |
| GET /api/agent-info | 当前版本、实例 ID、服务地址、路径、selectedProfile；不含密钥 |
| GET /api/platform-skill?format=connect | 简短接入说明；format=markdown 为完整可读 Skill |
| GET /api/v1/skill | 下载完整 Skill ZIP |
| GET /api/status | serviceReady、gateway:false、skills、personas；不要求网关 |
| GET /api/personas | 画像列表 |
| GET /api/persona/{name}、/files | 合并正文 / 分文件正文及 revision；缺少的维度 revision 为 missing |
| PUT /api/persona/{name}/file | filename、content、读取的 revision；替换一个画像文件，返回保存内容及新版本。409/revision_conflict 保留草稿并核对 detail.current；省略 revision 的旧调用不提供过期检测 |
| DELETE /api/persona/{name} | 删除画像目录 |
| POST /api/profile/build | name、form；创建表单基线，返回 baseline-ready；不调用模型 |
| GET /api/profile/build/status/{name} | 基线创建状态，不表示 Agent 已增强 |
| GET /api/skills、/api/skill/{name} | 可读业务/方法列表与正文；不是模型执行入口 |
| GET /api/outputs | 内容库目录树、项目元数据与成品路径 |
| GET /api/projects/{project}/metadata | 读取项目展示信息，返回 metadata 和 revision；project 为 URL 编码后的一级项目目录名 |
| PATCH /api/projects/{project}/metadata | revision 与 changes；增量修改 title/summary/category/kind/status/profile/platform/tags，成功返回 metadata 和新 revision；冲突时保留待改内容再核对 |
| GET /api/output/{path} | 读取 outputs 相对路径下的文本 |
| GET /api/media/{path} | 读取媒体，支持 Range |
| DELETE /api/output/{path} | 删除内容库文件或目录 |
| POST /api/upload、/api/upload/local | multipart files 与 sessionId；写入收件目录，返回 files 中 id/name/path，不接受本地路径字符串 |
| GET /api/upload/limits | 普通上传上限 |
| GET /api/accounts | 平台支持与最近已知核验状态，旧成功标记不是实时在线证明 |
| POST /api/login/{platform} | 使用系统 Chrome/Edge 打开真实平台登录 |
| GET /api/login/{platform}/status | 登录状态、二维码等 |
| POST /api/login/{platform}/sms | code；提交验证码 |
| GET /api/accounts/{platform}/whoami | 实际校验账号，可能联网；force=1 手动绕过缓存 |
| POST /api/logout/{platform} | 退出平台账号 |
| GET /api/analytics/platforms | 可分析平台与登录标记 |
| GET /api/analytics/{platform} | 真实采集；只有核验稳定账号与来源才登记快照。growthStatus/growthReason说明增长可比性，缺身份时各窗口null；可能启动浏览器，并非纯缓存 |
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

项目 `category` 可为 creation（创作内容）、analysis（分析报告）、reference（参考资料），不改变 `outputs/<项目>/` 的原路径；未填写的旧项目仍可查看。`status` 的 draft/ready/published 分别展示为草稿、已就绪、已标记发布，均不能代替真实平台发布结果。元数据接口的 revision 用于核对是否发生并发修改，读取后有变更会拒绝旧 revision 的保存；完整调用与合并说明见[项目、素材与成品](outputs.md)。

## Windows 调用

DataDir 和 SkillHelper 使用复制说明中的实际绝对路径。中文、空格路径作为独立参数传递，不拼接 shell 命令：

```powershell
$DataDir = '<复制说明中的运行数据目录或发现入口所在目录>'
$SkillHelper = '<skillDir>\scripts\mediasail.ps1'
& $SkillHelper check --data-dir $DataDir
$info = Get-Content -LiteralPath (Join-Path $DataDir 'agent-connection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($info.connectionFile) { $info = Get-Content -LiteralPath $info.connectionFile -Raw -Encoding UTF8 | ConvertFrom-Json }
Invoke-RestMethod ($info.baseUrl + '/api/personas')
$payload = @{title='春季选题';note='结合受众反馈对比两个角度';source='external-agent'} | ConvertTo-Json
Invoke-RestMethod ($info.baseUrl + '/api/ideas') -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
```

辅助脚本为子进程设置工作目录和隔离运行环境，不修改外部 Agent 的全局配置。脚本每次读取最新连接文件；check 连接失败时仍报告找到的本地路径，python 命令仍可运行本地计算。Node 命令只寻找可选系统 Node，不是软件必要依赖，不自动安装。

抖音 whoami 和采集响应保留 `loggedIn`，同时提供 `verificationStatus`（verified/login_required/unknown）、`accountId`、`checkedAt`（Unix 秒）、`errorCode` 和 `message`。以三态和检查时间理解结果；unknown 时界面可显示明确标注的 lastKnown 历史身份，不能把它当本次校验成功。平台正在登录/发布时 `profile_busy` 表示资料占用，稍后重试，不另开同资料浏览器。登录收尾会关闭扫码浏览器、重开核验持久会话后才报告 success。

## 基线响应

POST /api/profile/build 返回最小形状如下；动态值以实际响应为准：

```json
{"created":true,"name":"测试画像","async":false,"status":"baseline-ready"}
```

这只代表表单基线就绪；分析社媒、核对事实、标记来源、补充缺口和写入增强画像由外部 Agent 完成。连接 check 分开报告 connected、localToolsReady、found、selectedProfile，离线时 connected:false 不代表画像或计算不可用。读取/写入画像的结果见 context.md，内容库展示结构见 outputs.md，计算脚本输入输出见 [业务脚本示例](script-io.md)。

## 热点数据状态

热点返回仍有 `trends` 与 `updated`；`updated` 只是本次响应时间。每个平台的 `status` 为 `live`（本次取得）、`cached`（缓存）或 `unavailable`；`fetchedAt` 是最近成功取得数据的 Unix 秒，失败且无缓存时为 null，不能将它当成帖子发布时间。`source` 为实际来源，`stale` 表示旧缓存刷新失败，`error` 说明本次问题。有效空榜仍可为 live；没有数据不等于平台没有热点。采集或分析使用时注明来源与实际取得时间。

## 登录轮次与校验并发

登录启动返回可选 sessionId，新调用方在 status 查询及登录短信 code 请求中带回该值；过期轮次返回 HTTP 409，不写验证码。相同平台仍在运行的扫码任务会复用，不启动第二个浏览器；上一轮收尾时稍候重试。旧调用不带 sessionId 仍可查看当前轮次。服务端 whoami 以请求代次保存结果，登录、退出和后续校验使旧结果失效，迟到响应可能带 superseded:true，不代表新一次核验。
