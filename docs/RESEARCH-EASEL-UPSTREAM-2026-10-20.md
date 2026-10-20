# Easel 上游变化与 MediaSail 吸收建议

研究时间：2026-10-20 17:15（Asia/Shanghai，UTC+8）。本轮用于会议讨论，只读核对上游和本地实现，不执行升级、发布、平台登录或真实发布。

## 结论

Easel 确有新内容，但最显眼的变化是把 Codex、OpenCode、ACP 等执行引擎嵌入 Easel。MediaSail 0.5.9 已选择外部 Agent 接替智能工作，这条路线不应重新引入。对 MediaSail 更有价值的是小块业务修复：发布结果判断、未知草稿结果处理、二维码与身份响应竞态、热点数据源与解析、日历日期和发布归因。

建议优先讨论三个业务切片：

1. **发布结果真实性、未知结果不自动重放。** 本地知乎回答脚本仍把含 `question` 的最终地址判为成功；保留的公众号凭证 API 草稿适配仍会自动重试创建请求。这是已核对代码的缺口，尚未用真实账号复现。分别从独立的小补丁吸收，避免把“请求结束”“草稿已建”“公开发布”混为一谈。
2. **二维码与账号身份响应的时序保护。** 本地已独立做了三态核验、浏览器资料锁和身份限定快照；上游新增的请求代次、旧响应丢弃、二维码刷新和轮询终止仍值得补齐。保留我们的认证语义，不能整文件替换。
3. **热点源、响应解析和可用性提示。** 本地仍是旧源优先和旧解析器，缺口明确、依赖少，可独立挑选。上游的 `ok` 字段仍不能完整表达旧缓存回退，建议吸收时进一步区分本次成功、缓存与不可用。

素材预览和人工发布交付放在以上修复之后：本地已有内容库 HTML/媒体预览、HTML 禁缓存和原生发布页纯文本复制；上游新增的主要是发布中心人工交付入口和聊天内多产物画廊。不能把已有公众号 HTML 复制方法宣传成最近才出现的新能力。

## 核对基线、提交与文件规模

| 项目 | 核对结果与来源 |
| --- | --- |
| 本地产品 | `package.json` 为 MediaSail **0.5.9**；`runtime-lock.json` 的 Easel 固定为 `fb80ae6dd6fc26f5553efcb293ee6d93ef253f02`，运行策略为 `business-only`。本地 `build/payload/manifest.json` 为 `0.5.9-fb80ae6`。 |
| 上游默认分支 | `main`；来自 [GitHub 仓库 API](https://api.github.com/repos/ZJU-REAL/Easel)。 |
| 本轮固定的上游最新点 | [`8d08b216105bd7c7057c84c97cd637cec44db609`](https://github.com/ZJU-REAL/Easel/commit/8d08b216105bd7c7057c84c97cd637cec44db609)，提交标题 `Fix regressions from issues 110-122`；作者与提交者时间均为 **2026-10-18 18:45:31（上海）**。来自 [commit API](https://api.github.com/repos/ZJU-REAL/Easel/commits/8d08b216105bd7c7057c84c97cd637cec44db609)。 |
| 固定 pin 的时间 | [`fb80ae6`](https://github.com/ZJU-REAL/Easel/commit/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02)，**2026-10-07 16:32:22（上海）**，标题为 Google Fonts 非阻塞加载。 |
| 相对 pin 的准确关系 | GitHub compare：`ahead_by=118`、`behind_by=0`、`total_commits=118`，merge-base 就是 pin；隔离 git 的 `rev-list --count pin..head` 同为 **118**。其中 **43** 条是合并提交、**75** 条非合并提交。见 [固定 SHA compare](https://github.com/ZJU-REAL/Easel/compare/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02...8d08b216105bd7c7057c84c97cd637cec44db609)、[compare API](https://api.github.com/repos/ZJU-REAL/Easel/compare/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02...8d08b216105bd7c7057c84c97cd637cec44db609)。 |
| 文件差异 | 隔离 git `diff -M --shortstat`：**896 files changed, 20548 insertions(+), 1688 deletions(-)**；`--name-status -M` 为 **96 A、1 D、80 M、719 R**。GitHub compare API 的文件数组最多 300 个，本轮没有拿这个截断列表当总数。 |
| 目录迁移占比 | 719 个重命名中，**715** 个是 `skills/openclaw/` → `skills/builtin/`，另 **4** 个是 `openclaw/` → `agents/`。pin 和 head 的技能一级目录均为 **114** 个；不是新增了数百项技能。迁移说明见 [agent-harnesses.md](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/docs/agent-harnesses.md)。 |
| 正式发行与主分支 | 最新正式 release 是 [v0.3.0](https://github.com/ZJU-REAL/Easel/releases/tag/v0.3.0)，API 的发布时间为 **2026-10-12 17:54:49（上海）**。本轮 head 相对该 tag 另有 **43** 条提交（含合并）。最新主分支与最新正式 release 不能混称。 |
| CHANGELOG | [固定 head 的 CHANGELOG](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/CHANGELOG.md) 最新条目仍是 2026-10-12 的 0.3.0；10 月 15–18 日的人工发布、草稿与回归修复必须继续查提交和代码。 |

以上 118 是提交拓扑差异，不是“10 月 7 日以后写出的 118 个新功能”：比较区间包含较早分支在之后合入的提交，例如热点修复作者时间为 10 月 6 日，10 月 9 日才合入 main。仓库 API 的 `pushed_at` 也不能当作最新默认分支 commit 的时间。

主要代码变化集中于 `web/app.py`、账号/发布/分析共享脚本、前端账号/发布/画像页面、`easel/harnesses/`、安装脚本与测试。新增独立业务文件包括 `easel/manual_publish.py`、`ManualPublishPage.tsx`、`PublishingPage.tsx`、`login_qr.py`、`login_transport.py`、`analytics_transport.py`；其余大批路径变化属于技能搬迁。

## 逐项判断：新增证据 → 本地状态 → 建议

| 上游变化与证据 | MediaSail 0.5.9 已有与缺口 | 建议及拆分范围 |
| --- | --- | --- |
| **内嵌多 Agent 底座**：[`0d53744`](https://github.com/ZJU-REAL/Easel/commit/0d53744c541748a3e92ce852b2236011421a8f67)，2026-10-12 16:53；新增 `easel/harnesses/`，支持 OpenClaw、Codex、OpenCode、ACP、仅聊天；另有会话续接、权限、取消与进程池。 | 本地 0.5.0 已移除内置聊天和 OpenClaw；外部 Agent 通过接入 Skill 使用业务 API/脚本。路线相似之处是使用现有 Agent，运行关系不同。 | **不吸收执行层。** 不回引聊天窗口、RPC 适配、OpenClaw、独立 Node 和环境自动安装。原生会话与权限管理继续由外部 Agent 承担。 |
| **OpenAI 兼容 API 直连与模型设置**：[`5ab3f50`](https://github.com/ZJU-REAL/Easel/commit/5ab3f50943819b0c83d472cb814b16f9c77132bb)，2026-10-05 11:23；后续合并为仅聊天模式。 | 本地已退出模型执行与配置入口；不应以“不需要 OpenClaw”为由恢复内置模型。 | **不吸收。** 自定义模型 reasoning、provider 同步、网关 restart/bootstrap 等一起留在上游。 |
| **人工审核后到官方页面发布**：[`e2d4a04`](https://github.com/ZJU-REAL/Easel/commit/e2d4a04649098434dd10c05b9ff1a69ba765e539)，2026-10-16 11:33；[PR #142 合并](https://github.com/ZJU-REAL/Easel/commit/b29d0d72d7988c7fbacd9f8c6c793c596e4854f9) 于当日 19:16，保留自动发布为默认。新增复制、素材 ZIP、公众号富文本、官方页面、人工回填日历。见 [工作流说明](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/docs/manual-publishing.md)。 | 原生自动发布与纯文本复制已有；AitoEarn 自 0.5.5 用默认浏览器打开。缺少统一的各平台官方页交付、选择媒体后导出 ZIP、明确区分人工记录的发布入口。 | **待验证后择块吸收。** `manual_publish.py` 的本地打包和官方地址表可独立研究；前端重用现有内容库/发布表单，AI 适配交外部 Agent。不照搬“AI 排版→AI 检查→审核勾选”的固定智能流程，不替代原生发布，不恢复 AitoEarn 自动上传。 |
| **多产物画廊**：0.3.0 新增 `ArtifactGallery.tsx`、`lib/artifacts.ts`，用于聊天产物；支持前后切换、键盘、多媒体、HTML 适配尺寸及归档读取。见 [源码](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/web/frontend/src/components/ArtifactGallery.tsx)。 | 本地内容库已经能看图、视频、音频、HTML和Markdown，且有项目/成品展示及筛选。已无聊天内产物展示场景。 | **暂不吸收整组件。** 错误反馈、适配容器与多文件切换可作为内容库体验候选，先证明具体痛点。聊天归档接口及产物发现层不随之引入。 |
| **画像总览、浏览与使用分开**：[`91509a9`](https://github.com/ZJU-REAL/Easel/commit/91509a93fa5f2b8de9f51fad6a47912948c1c57f)，2026-10-12 14:56；新增画像卡片列表，“查看/编辑”不切换聊天身份。 | 本地侧栏已有画像选择，选择独立持久化；已有未保存保护、revision 冲突保护、Agent 外部更新刷新。缺少画像页总览卡片；没有绑定聊天身份的需求。 | **可选界面改进。** 只研究画像浏览与选择分离的价值，保留本地编辑保护和 selectedProfile 语义；不导入画像一对一聊天逻辑。 |
| **登录二维码可靠性**：[`718f9a0`](https://github.com/ZJU-REAL/Easel/commit/718f9a04e952829dc76f04f9c26dbf5958513790)、[`c8ad1f3`](https://github.com/ZJU-REAL/Easel/commit/c8ad1f36bc7afc478abe5061c1eb838db90f0713)、[`ede33b8`](https://github.com/ZJU-REAL/Easel/commit/ede33b89bf5c48d9fb13719380a5438388449e0e)，2026-10-11 13:51–14:54；检查二维码图案与尺寸、刷新捕获、拒绝匿名跳转、处理小红书登录弹窗。`AccountsPage` 又增加请求代次、取消与轮询保护。 | 本地有二维码、短信、登录后核验、资料锁；小红书仍主要用固定选择器截图。账号页只有 aliveRef，没有上游的 `whoamiRequests` / `qrRequest`；旧 startLogin/轮询/校验响应可能回写新状态。 | **优先吸收局部。** 前端请求代次与失效、轮询防重入和终止可独立做；`login_qr.py` 可研究复用。浏览器启动继续走本地 `business_browser`，不能用上游 launch 替换。 |
| **采集与身份判断**：[`93a67b1`](https://github.com/ZJU-REAL/Easel/commit/93a67b18db39a8a8d9e36981011ae100cfee5042)、[`1419a0c`](https://github.com/ZJU-REAL/Easel/commit/1419a0c18d6d53cf5ffddc8842b135dd96b075fc) 修抖音可见 iframe 登录墙；[`eee47f8`](https://github.com/ZJU-REAL/Easel/commit/eee47f86078e1a839f696f198b1bc80a6ed79e5b)，2026-10-12 19:39，为小红书本人创作中心数据增加有界抓取与静态资源预取。 | 本地已独立加入 `creator_auth.py`、`ProfileLock`、抖音 verified/login_required/unknown、账号/来源限定增长快照。`account_stats.py` 仍缺上游的小红书专用有界采集和 `analytics_transport.py`；上游也含公开资料回退，不可直接当作创作后台登录证明。 | **优先验证、只吸收可独立部分。** 先采集实际慢/空数据证据，再挑请求预算、接口字段映射、二维码墙检测。不得退回单个 logged_in 布尔值，不能把公开粉丝与后台指标无标记混算。 |
| **热点数据源修复**：[`e944ce6`](https://github.com/ZJU-REAL/Easel/commit/e944ce6f3934c8dc470688d2e417aee19a2cd234)，作者时间 2026-10-06 16:41，[10 月 9 日合并](https://github.com/ZJU-REAL/Easel/commit/147749ec0aec960acc1c6ce3bf38a3db9a256355)；调整源顺序，知乎/头条官方源、字符串数组/大写字段/嵌套 target 解析、知乎网页 URL、前端不可用提示。 | 本地仍旧源优先，`_parse_hot` 只接对象和小写字段，`/api/trends` 无 `ok`。这是原有热点功能的修复。 | **优先吸收，范围小。** 局限于 source/parse/API字段/显示及相应 fixture；无需模型、OpenClaw、Node/FFmpeg。端点今天是否从用户网络可达仍待实测。 |
| **知乎回答成功判定**：[`3711dbd`](https://github.com/ZJU-REAL/Easel/commit/3711dbdb271f875290f18eca524118331ffcf6f2)，2026-10-16 15:50；解析 URL path，同问题且新 answer ID 才报已验证，登录页和未跳转不报成功。 | 本地 `zhihu_answer.py:282` 仍为 `'/answer/' in current_url or 'question' in current_url`；该脚本列在发行白名单。问题页本来就含 question；这是明确静态风险，未做真实平台复现。 | **优先吸收小函数与离线用例。** 还应核对最终 URL 的官方 hostname；上游只查 path，也不等同于平台回执。结果未知时不要自动重试。 |
| **公众号未知草稿结果不重放**：[`af03c7e`](https://github.com/ZJU-REAL/Easel/commit/af03c7e8b0744bff654120c6e3bdd5144aa8a098)，2026-10-15 16:47；`_create_draft_once` 单次发送、不跟重定向，区分有效 media_id、明确拒绝和 DraftOutcomeUnknown。见 [限制说明](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/docs/wechat-draft-recovery.md)。 | 本地保留 `skill-wechat-publisher/scripts/api.py`，普通图文和贴图 `draft/add` 都使用通用重试器。**这是可选凭证 API 路径**；当前 Web 默认公众号发布走 `weixin_mp_stats.py` 后台会话，不能说所有公众号发布都会经过此缺陷。 | **优先吸收独立小补丁。** 拒绝把超时当成远端未执行。上游只解决进程内重试，没有跨进程去重和自动对账，不能宣称“恰好一次”。 |
| **发布记录与分析口径**：[`8d08b21`](https://github.com/ZJU-REAL/Easel/commit/8d08b216105bd7c7057c84c97cd637cec44db609)，2026-10-18 18:45；发布请求补画像，记录转发 publish-log；`analyze.py` 统一平台别名与 UTC+8，全部缺指标不计零分。 | 本地已有独立账号/来源增长规则，但发布日志/`analyze.py` 是另一套数据，不能把前者当后者已修。当前 analyze 仍直接 fromisoformat，calendar record_publish 没有 profile；Web 成功回流直接追加日历。 | **建议小块吸收，单独核对数据契约。** 不能直接套上游的“返回码成功→published”统一回流，公众号草稿与人工标记继续区分。只对有可靠来源的记录补画像/平台/时区；不猜旧记录身份。 |
| **日历、上传、阻塞与并发修复**：[`0cb046a`](https://github.com/ZJU-REAL/Easel/commit/0cb046a9ef59627fc9fa1047985c689b39180033)，2026-10-13 12:41；日期取本地日、日历读改写加锁、普通上传分块、退出时停止残留登录进程，阻塞调用进线程池；[`7669fff`](https://github.com/ZJU-REAL/Easel/commit/7669fff7be06c8285f48bd495aa17be78f11fbc0) 有后续修正。 | 本地已将部分采集/发布子进程放入线程池、本地大文件复制通道已分块；普通 `/api/upload` 仍整读，日历无共享锁。三个前端页面仍 `toISOString().slice(0,10)`，上海 00:00–07:59 可得到前一天。 | **建议逐项小修，紧接前三项。** 日期修复边界最小；日历锁只是单服务进程保护，外部 Agent 的 CLI 写入还需一并审视。不要把整个 20-bug 提交作为一个不可拆升级。 |
| **画像路径检查**：[`d0243b8`](https://github.com/ZJU-REAL/Easel/commit/d0243b8c55664675fb33125967049050aba59cb5)，2026-10-09 17:45；共享 `valid_persona_name` 拒绝路径段、冒号和控制符，读取/列表/存在判断统一。 | 本地编辑 API 已有目录包含关系、symlink 与 revision 保护；共享 `easel/persona.py` 的 profile_exists/load_profile_text 仍旧实现。不能称本地已经完整吸收，也不能直接宣布当前 HTTP 存在已验证越界漏洞。 | **建议评估统一校验。** 保留本地更强文件写入保护；检查所有实际入口和 Windows 路径语义后小范围补齐。 |
| **媒体工具、模型和 SDK 修复**：10 月 13/18 日修 FFmpeg 截取时长、音视频边界、rembg/抠图命令、TTS/多声线参数、视频 pipeline gates 等；最新 [pyproject](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/pyproject.toml) 仍统一依赖 faster-whisper/rembg/librosa 等。 | 本地 0.5.0 已退出通用执行器、大型模型与 SDK，保留专业方法，Agent 自选工具。 | **不恢复执行器和依赖。** 内容方法文档如有事实纠正，可按实际保留范围单独核对；“修好一个旧命令”不等于新增业务能力。 |
| **安装兼容性与 CI**：10 月 7–12 日的 fail-soft、PowerShell PATH/UTF-8、跳过 OpenClaw、bootstrap/restart、静态检查、nightly 安装等，见 [0.3.0 CHANGELOG](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/CHANGELOG.md)。 | MediaSail 已有自己的 NSIS 安装、选库、差量更新、业务 Python 与系统浏览器规则，不跑上游 setup。 | **不照搬安装器。** 可借鉴能力探测/明确报错/验证门禁的思想；旧 API Key 与 OpenClaw 配置兼容修复不适用于现行产品。 |

## 公众号 HTML 预览与复制：已有什么，真缺什么

这部分最容易把原有能力算成新功能，需同时看原件和 0.5.9 的发行整理结果。

- **已有的运行支持：** 本地 [`OutputsPage.tsx:189`](../vendor/easel/web/frontend/src/components/OutputsPage.tsx) 有请求序号保护，支持媒体、Markdown、HTML；HTML iframe 为 `sandbox="allow-scripts" allow="clipboard-write"`，允许预览文件自带的复制按钮运行。后端 [`web/app.py:783`](../vendor/easel/web/app.py) 对 HTML 禁缓存，iframe URL 也带 mtime。原生 [`PublishPage.tsx:194`](../vendor/easel/web/frontend/src/components/PublishPage.tsx) 已有纯文本复制。这些都不是本轮上游新增。
- **旧原件里本来就有：** pin 的 gzh-design 提供 `wrap_preview.py`、`preview-template.html`；已有公众号富文本复制按钮、本地图 data URI 内联和 CSP。可从 [固定 pin 的模板](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/gzh-design/assets/preview-template.html)、[固定 pin 的包装脚本](https://github.com/ZJU-REAL/Easel/blob/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02/skills/openclaw/gzh-design/scripts/wrap_preview.py) 核对，不能归为 10 月的新能力。
- **当前发行边界：** `scripts/knowledge-policy.cjs` 没有把 gzh-design 的执行脚本列入白名单，`scripts/curate-knowledge.cjs` 只保留其专业方法。0.5.9 本地 staging 的 `curation-report.json` 明确列出了被排除的 `preview-template.html` 与 `wrap_preview.py`。所以不能声称当前安装包附有现成的统一预览页生成器；外部 Agent 仍可按方法生成自己的 HTML。
- **上游新页面补的是入口：** `ManualPublishPage.tsx` 在发布表单内用 `ClipboardItem` 写 `text/html`/`text/plain`，提供官方页面和素材包；`manual_publish.py` 公众号包内有 `article.html`。这比“内容库能打开一个自带按钮的 HTML”更集成，但它本身不是 gzh-design 主题排版器。其 copyRichText 使用普通 renderMarkdown，没有处理所选媒体的本地图片内联；导出 HTML 还主动移除 Markdown 图片。不能承诺复制后原图/样式都已完整迁移到公众号。

可研究的最小产品能力是：选定已完成稿件/媒体 → 内容库预览 → 清楚可见的复制或导出 → 默认浏览器打开固定官方页面 → 用户核对提交 → 按人工确认记录结果。沿用外部 Agent 创作和当前原生发布。不为复用上游页面重新加入内置 AI 排版、检查、聊天或自动安装工具。

真实粘贴效果、图片能否进入公众号编辑器、样式保留与中文大文件导出本轮均未验收；源码支持不等于目标平台通过。

## 为什么适合小块挑选

本地 vendor 早已不是未修改的 pin：包含系统 Chrome/Edge 选择、账号三态与身份快照、业务裁剪、画像/项目 revision、外部 Agent 入口、选库和安装发行适配。上游 `web/app.py`、`App.tsx`、`ProfilePage.tsx`、`PublishPage.tsx` 正好也是这些补丁密集的位置。目录又从 openclaw 改为 builtin，整体推进 pin 会把路径、发行白名单和资料引用一起带动。

建议保留现在的固定基线，以业务意图移植具体函数和用例，并记录原始 commit：

- 知乎 `classify_publish_outcome` 与离线 URL fixtures；公众号 `_create_draft_once` 与离线 HTTP fixtures。
- 账号页/缓存层的请求代次与旧响应丢弃，二维码捕获和轮询生命周期分开验证；保留 `appStorage` 和本地三态类型。
- 热点 source/parse/结果形状/前端显示可以组成独立切片。
- 日期、日历串行化、普通上传分块、归因字段分别处理；不把同一大提交中无关聊天/媒体更改带入。
- 人工交付若进入实施，优先复用 `manual_publish.py` 的本地打包思想；前端围绕本地已有内容库与外部 Agent 入口重新接线。

“小块挑选”不保证每个原始 commit 都能直接 cherry-pick：不少提交同时修改聊天/模型/业务，或依赖后来目录迁移。应移植行为并保留来源，再按 MediaSail 当前接口验收。本轮没有改 `runtime-lock.json`、vendor、补丁文件或打包配置。

## 待验证事项与证据范围

本轮完成了 GitHub 第一方 API、固定 SHA 的 git diff、CHANGELOG、提交、相关实现及本地 0.5.9 staging 裁剪结果的核对。未启动上游、未跑完整上游测试，也未将其报告的测试通过数当成 MediaSail 验收。

后续若实施，至少按切片核对这些实际行为：

- 知乎停在问题页、登录回跳、旧回答、不同问题和官方新回答 URL；未知结果不产生成功记录。代码发现目前属于静态风险，未用真实账号公开发布复现。
- 凭证 API 草稿在超时/断连/5xx/重定向/异常 JSON 时只发送一次且不泄露 token；同时确认默认后台会话发布路径另有何种未知结果处理。不会靠重跑命令证明远端未创建。
- 登录快速切平台、关闭后旧请求返回、两次校验逆序、注销时仍有登录 runner、二维码过期与扫码后刷新；保留未知与历史身份的区别。不得用“CLI 或二维码就绪”代替登录成功。
- 热点六个平台的当前用户网络可达性、真实响应、空榜、超时、旧缓存及来源时间；上游 `ok=bool(items)` 在旧缓存回退时仍为 true，顶层 updated 仍是当前请求时间，不能因此宣布内容刚更新。
- 小红书账号稳定性、创作后台与公开资料的来源边界、采集预算、平台改版；当前源和上游代码均未在本轮真实账号校准。
- 日期跨本地零点、日历读改写并发，以及外部 Agent 脚本与桌面 API 同写；上游 threading.Lock 不解决跨进程互斥。
- 普通上传的上限、分块清理、中文同名文件保留；已有大文件复制通道和当前目录保护不能回退。
- 公众号 HTML 实际复制/粘贴、图片与样式、素材包文件顺序、手工回填记录；官方浏览器会话与 MediaSail 持久化浏览器资料相互独立，不自动搬登录态。

复核命令均在 `.test-data/easel-upstream-20261020/repo` 的隔离无 checkout clone 运行，没有切换本地 vendor：`git rev-list --count pin..head`、`git diff -M --shortstat pin head`、`git diff -M --name-status pin head`、`git show <sha>:<path>`。文件规模以 git 完整树为准；API compare 用于交叉核对拓扑和提交清单。本项研究只新增本文件。
