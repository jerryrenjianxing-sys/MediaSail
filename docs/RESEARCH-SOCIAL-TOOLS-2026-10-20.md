# 社媒工具研究与会议取舍（2026-10-20）

只研究，不实现。结论：先补专业方法；工具由外部 Agent 按需选择。最值得主动试点的是**小红书关键词搜索/筛选、竞品笔记详情与主页读取**，有明确执行价值。其余不因支持列表长就整包引入。

## 源码基线与决策表

GitHub HEAD 经提交 API 固定，随后读取固定 SHA 源码。Postiz、XHS、SAU 用浅克隆核对；baoyu 核心文件以固定 SHA raw 内容读取，其大仓克隆未完成。未用真实账号验收。

| 项目 / 固定 SHA | 根 LICENSE 实读 | 真正增量与已有重叠 | 保留方式 / 不默认捆绑 |
| --- | --- | --- | --- |
| [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills/tree/1567581c26ec29f4216c6e6835415bf30343b0e3) `1567581c26ec29f4216c6e6835415bf30343b0e3` | [MIT，2026 Jim Liu](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/LICENSE) | 卡片结构/系列一致性；文本排版与 Markdown→公众号 HTML 可作确定性工具候选。已有 card/gzh 方法和公众号 API 草稿工具 | 拆取设计判断；实际样本证明缺口后才选小工具。不开完整插件、固定生图后端、逆向工具、Node/Bun 或第二套公众号账号 |
| [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app/tree/e2be3ecba77af9f220d9025a9f90f0017a9771ba) `e2be3ecba77af9f220d9025a9f90f0017a9771ba` | [GNU AGPL v3](https://github.com/gitroomhq/postiz-app/blob/e2be3ecba77af9f220d9025a9f90f0017a9771ba/LICENSE) | 海外 API 发布/排期/团队运营；内容库、日历、日志、账号重叠，未见国内七个平台 provider | 有海外需求时独立外用 Cloud/自托管；暂不集成服务，不带数据库、Redis、Temporal、编辑器/AI、第二套日历日志 |
| [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp/tree/7797fd375aba02dcd33afe143f6bee13e5870859) `7797fd375aba02dcd33afe143f6bee13e5870859` | [Apache-2.0](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/LICENSE) | 搜索/竞品详情/主页有增量；发布已移植，本地也有评论读取/回复及自有账号采集 | 首项可选外部研究工具试点。不重复发布器，不自动装 MCP、不捆绑指纹浏览器、不另造账号态 |
| [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload/tree/0012d2c355f88f683cc38dde2a2db209e14091bc) `0012d2c355f88f683cc38dde2a2db209e14091bc` | [MIT，2023 dreammis](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/LICENSE) | 多平台 CLI；百家号/生活号/微博/虎扑/YouTube、快手图文是候选差距。抖音/XHS/快手视频/B站/视频号主要重叠 | 按需外用；需要平台修复时比较单适配器。不带整仓、历史 Web、Patchright 浏览器、自动更新链及独立 Cookie/日志 |

本地是 MediaSail 0.5.9，研究起点 `2d0d6c10400fdb7eaff4fe620e2b1f1d66b108c3`；Easel 原件固定 `fb80ae6dd6fc26f5553efcb293ee6d93ef253f02`，另有本地补丁。依据：[package.json](../package.json)、[runtime-lock.json](../runtime-lock.json)、[NOTICE](../NOTICE)。

## baoyu：能拆取设计质量，但照搬并不开放

当前卡片 Skill 把风格、信息布局、配色分开选择，含 12 种风格、8 种布局；有封面→内容页→收尾拆分、不同叙事策略，以及首图作为后页视觉参照的办法。适合吸收到“按内容选表达、信息密度、可读性、系列一致性”的方法中。[卡片源码](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-xhs-images/SKILL.md)

它**没有固定只用 baoyu-image-gen**：可以采用用户指定或运行时原生图像工具。但原 Skill 仍强制栅格生图、禁止 HTML/SVG/canvas 替代、禁止程序覆盖修补图片文字，默认生成前确认。因此只取设计判断、允许 Agent 自选排版/渲染工具，是我们的改编选择；不能把整份原 Skill 说成完全开放的工具协议。[后端与确认规则](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-xhs-images/SKILL.md#image-generation-tools)

公众号有 API 与 Chrome CDP 脚本；API 写入 `draft/add` 草稿箱，不能称为公开群发。API 需凭据/IP 白名单，浏览器需 Chrome/登录，remote-api 另需 SSH 可达且 IP 加白的服务器。脚本工作流需 Node/Bun，部分系统的剪贴板/粘贴还依赖系统工具。[公众号源码](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-post-to-wechat/SKILL.md)、[前置条件](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/README.md)

本地已有 card/gzh 方法、公众号 HTML 转换和 Python API 草稿工具；原件还保留 baoyu 生图包装，但当前打包名单排除了生图 TypeScript，只留业务 Python。建议拿真实中文文章比较微信粘贴保真后，再判断是否选用其确定性文本排版/HTML 转换器；无需先安装全套。[当前打包名单](../scripts/knowledge-policy.cjs)、[公众号来源](../vendor/easel/skills/openclaw/skill-wechat-publisher/EASEL-META.md)、[既有排版](../vendor/easel/skills/openclaw/gzh-design/SKILL.md)

## Postiz：海外/API/自托管边界

实际注册有 X、LinkedIn、Instagram、Facebook、Threads、YouTube、TikTok、Pinterest、Reddit、Bluesky、Mastodon 等，并有 WordPress、Telegram、Listmonk、Skool。固定提交未见抖音、小红书、公众号、视频号、快手、B站、知乎 provider；TikTok 不等于抖音。多数渠道走开发者 API 凭据；Skool 的 Cookie 扩展是特例。[provider 注册表](https://github.com/gitroomhq/postiz-app/blob/e2be3ecba77af9f220d9025a9f90f0017a9771ba/libraries/nestjs-libraries/src/integrations/integration.manager.ts)、[凭据配置](https://github.com/gitroomhq/postiz-app/blob/e2be3ecba77af9f220d9025a9f90f0017a9771ba/.env.example)、[扩展注册](https://github.com/gitroomhq/postiz-app/blob/e2be3ecba77af9f220d9025a9f90f0017a9771ba/apps/extension/src/providers/provider.registry.ts)

源码开发要求 Node >=22.12 且 <23、pnpm 10.6.1。官方当前安装指向独立 Compose 仓库，其当天固定提交含 Postiz、PostgreSQL、Redis、Temporal 及其数据库/搜索/管理组件；存储可用本地，R2 可选。这是完整服务栈。[版本约束](https://github.com/gitroomhq/postiz-app/blob/e2be3ecba77af9f220d9025a9f90f0017a9771ba/package.json)、[官方安装](https://docs.postiz.com/self-host/installation/docker-compose)、[固定 Compose dd4969e](https://github.com/gitroomhq/postiz-docker-compose/blob/dd4969e5e694cd009619a0d53cff14c21104580b/docker-compose.yaml)

部署成功也不等于平台可发布：TikTok 要开发者应用、HTTPS、域名验证及 scope/用户授权，未经审核的 Direct Post 限私密发布；Instagram 需 Meta 开发者配置，独立连接需专业账号，权限审核/测试者身份有区别。建议确有海外业务后独立外用，其 API 可以由外部 Agent 自行选择。[TikTok 官方条件](https://developers.tiktok.com/docs/en/content-posting-api-get-started)、[Postiz TikTok](https://docs.postiz.com/self-host/providers/tiktok)、[Instagram](https://docs.postiz.com/self-host/providers/instagram)、[外部 API](https://docs.postiz.com/public-api/introduction)

## XHS MCP：新增搜索，现有发布是移植关系

读取工具覆盖关键词搜索/筛选、Feed、笔记详情、用户主页、通知等；同时也注册发布、评论、回复、点赞/收藏写操作。详情需 feed_id+xsec_token，默认评论只取少量，额外加载也不是全量保证。现成的“搜索发现对象→竞品详情/主页”比只补分析提示词更有价值，应先做可选工具试点。[工具注册](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/mcp_server.go)、[搜索筛选](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/xiaohongshu/search.go)、[详情/评论边界](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/xiaohongshu/feed_detail.go)

本地 xhs_publish 明确移植其流程/选择器，实际跑 Python/Playwright，**没有直接运行 Go MCP**；已有 account_stats 自有账号/笔记采集，xhs_comment 读取评论和回复。因此新增不能笼统说成“小红书发布+评论采集”。[本地发布](../vendor/easel/skills/shared/scripts/xhs_publish.py)、[采集](../vendor/easel/skills/shared/scripts/account_stats.py)、[评论](../vendor/easel/skills/shared/scripts/xhs_comment.py)

当前 HEAD 编译用 Go 1.24，成品免本地 Go，但运行强制自带指纹浏览器、拒绝系统 Chrome 回退；从 cdn.one-world.ai 下载约 140–190MB 并校验 SHA256，预编译仅 Windows x64/Linux x64/macOS arm64。它还有独立 HTTP 服务（默认 18060）和 Cookie v2 JSON+seed，非 MediaSail 持久 profile 格式。[go.mod](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/go.mod)、[浏览器](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/browser/browser.go)、[下载/平台](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/browser/browser_download.go)、[Cookie](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/cookies/cookies.go)

本地锁只协调自己的脚本；上游又提醒同账号多网页端可能互踢，不能宣称账号/资料直接共用。ReadOnlyHint 也不是权限隔离；token 留空会关闭服务鉴权。建议留在 Agent 的可选外部环境，明确仅授权研究所需工具；不自动捆绑浏览器/登录状态/写操作。另一个 x-mcp 是扩展加远程账号/token 方案，不能与本地 Go MCP 混称。[上游说明](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/README.md)、[鉴权源码](https://github.com/xpzouying/xiaohongshu-mcp/blob/7797fd375aba02dcd33afe143f6bee13e5870859/middleware.go)、[本地锁](../vendor/easel/skills/shared/scripts/profile_lock.py)、[独立 x-mcp 项目](https://github.com/xpzouying/x-mcp)

## SAU：平台范围与实际依赖

当前主线为 uploader+sau CLI+四个上传 Skill；历史 Flask/Vue Web 明确不保证与当前实现同步或直接运行。[能力表](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/README.md)、[历史 Web 定位](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/docs/legacy-web.md)

| 平台 | 源码/文档边界，未做真实发布验收 |
| --- | --- |
| 抖音/小红书/快手 | CLI+Skill，视频/图文/定时；快手图文可作差距候选 |
| B站 | CLI+Skill，视频/定时；借 biliup |
| 视频号 | CLI 视频/定时，无专用 Skill；已有原生发布重叠 |
| 百家号/支付宝生活号/微博/虎扑 | CLI 视频；能力表未标图文/定时/Skill |
| YouTube | CLI/Studio 浏览器视频，播放列表/可见性；未标定时/Skill |
| TikTok | Chrome 示例实现、视频/定时；没有统一 CLI/Skill |

入口以 [sau_cli.py](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/sau_cli.py) 为准。主线 Python >=3.10,<3.13，Patchright 1.58.2、OpenCV、requests/二维码等，推荐 uv 环境与 Patchright Chromium；浏览器平台仍要登录，可能遇短信校验。B站会自动下载/更新 latest biliup 到家目录独立工具区，账号另存项目 cookies 目录。[依赖](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/pyproject.toml)、[安装](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/docs/install.md)、[biliup runtime](https://github.com/dreammis/social-auto-upload/blob/0012d2c355f88f683cc38dde2a2db209e14091bc/uploader/bilibili_uploader/runtime.py)

**本地未发现 SAU 运行依赖。** 检索 vendor、打包规则、Agent Skill 和业务依赖，只有快手 Skill 说明借鉴其网页发布思路；快手元数据标自研统一 Playwright 框架，没有 sau_cli/uploader 导入或 Patchright 依赖。抖音注明 WJZ-P 来源，XHS 注明 xpzouying 来源，B站封装 biliup。可确认“方法借鉴”，不能声称“已直接使用 SAU 整套代码”；未做完整历史/逐片段相似性审计。[快手说明](../vendor/easel/skills/openclaw/skill-kuaishou-upload/SKILL.md)、[元数据](../vendor/easel/skills/openclaw/skill-kuaishou-upload/EASEL-META.md)、[现有框架](../vendor/easel/skills/shared/scripts/web_publisher.py)、[业务依赖](../requirements-business.in)

## 本轮边界与待验证项

成果沿用用户选择的资料库、原项目与 `.easel.json`；Agent 可用自己的工具，不新增生态专用账号态/数据库/发布日志。草稿、人工状态和真实发布是不同事实。AitoEarn 继续只打开默认浏览器，由用户在官网完成操作。[现有接入 Skill](../agent-skill/mediasail/SKILL.md)、[成果契约](../agent-skill/mediasail/references/outputs.md)

未验证：真实账号下的搜索/发布稳定性；XHS 多客户端登录共存；baoyu 与当前微信 HTML 的粘贴保真比较；SAU 新平台/快手图文的实际可用性。许可结论只到已读根文件，复制实现须保留相应版权/许可；Postiz 组合分发、XHS 下载浏览器及其他依赖的再分发本轮未审计，也无必要现在扩展。

下一步会议可决定：先改哪些专业方法；是否用一个真实研究任务试 XHS 外部读取；是否确有新增国内平台或海外运营需求。本轮只新增此文档，没有安装工具、服务或修改实现。
