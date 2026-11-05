# MediaSail 内置浏览器工具：重新选型

日期：2026-11-05（Asia/Shanghai）。本轮按用户最新要求先找工具，未改产品、未安装候选、未连接或授权用户浏览器。使用 matt research 方法及 Exa 搜索，核对官方 GitHub 源码、发行元数据、许可证与官方商店页面。

## 本轮确定的责任范围

MediaSail 可以随包提供少量开源执行工具，只测试和维护自己分发的固定组合。外部 Agent 已有可用工具或连接时直接沿用；Skill 说明如何按需读取软件背景、取数和回存。外部工具自身的安装、版本和操作方式不纳入 MediaSail 的兼容承诺，也不要求用户先迁移到内置工具。

这次是候选筛选，尚未决定最终发行哪几套。原 0.5.12 的 Playwright CLI 固定选型及“双工具真实回存”验收需要在选定方案后更新；既有观测存储、业务含义和成果回存继续复用。

## 建议

优先把 **Tencent BrowserSkill、Vercel agent-browser、Playwriter** 作为三个核心候选；Browser Harness 和 chrome-use 留作有条件备选。先试最符合 Edge/Chrome、Windows 与包体需求的一套，再决定是否发行第二套，不为了数量把全部工具塞进软件。

当前最推荐优先验证 Tencent BrowserSkill：本地 Rust CLI、明确 Edge/Chrome 支持、现有 profile 登录、数据提取及证据能力比较完整。但两家扩展商店版本存在不同步迹象，不能直接宣布 CLI/daemon/扩展配对通过。[B1][B2][B3][B4]

| 候选 | 本次固定版本/许可 | 用户真实会话与接入 | Windows 交付形态 | 建议位置 |
| --- | --- | --- | --- | --- |
| Tencent BrowserSkill | CLI/ext 0.4.1；MIT；提交 b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5 | 官方明确 Chrome/Edge 原 profile；扩展在同一 profile 打开 Agent Window，已有 tab 可显式借用；需装扩展并启用本地连接 | 原生 Rust bsk CLI/daemon；Windows x64 ZIP 6,888,737 字节（6.57 MiB）；无须为本地 CLI 另装 Node/npm | **首选验证**，兼顾原生登录与结构化数据/证据 |
| Vercel agent-browser | 0.41.2；Apache-2.0；提交 d52a5e90c372ec4710c69adc3837ac14bbd852aa | 用 CDP 连接现有浏览器；Chrome auto-connect 需先开启 remote debugging 并批准；Edge 可研究显式 CDP 端点，Windows 自动发现未枚举 Edge | 官方原生 Rust Windows x64 EXE 18,248,192 字节（17.40 MiB），无须额外 Node；默认新建浏览器路线不采用 | **无扩展路线候选**；不能把 Chrome 自动发现宣传为 Edge 已同等支持 |
| Playwriter | CLI 0.9.0，扩展 release 0.0.170；仓库 MIT；CLI提交 796e5716c64329c4c6a772ea62fa58216a24fe97 | 主打已有 Chrome 会话；扩展连接 + 本地 relay；CLI 执行有状态 Playwright 片段，支持快照、页面操作、网络/CDP | 发布为 npm JS 包，需 Node 与 JS 依赖；不能称独立 Windows EXE。Edge 仍需实测，不以 Chromium 兼容性推定通过 | **可编程备用候选**，适合复杂网页取数；比纯原生 CLI 增加运行环境 |
| Browser Harness（Browser Use 的底层 CLI） | 0.1.13；完整 Browser Use 当前0.13.14。许可与源提交见补充研究 | 本地 CDP，无需扩展；Windows 源码枚举 Chrome/Edge 多渠道；官方主要演示 Chrome。无需模型或云 key 来做本地页面操作 | Python>=3.11；可与现有3.11.15研究复用，但需完整依赖解析/隔离验证；独立升级期间 Python 文件占用需另测 | **有条件备选**；不打包整套 Browser Use Agent/模型框架 |
| chrome-use | 1.5.281；Apache-2.0；提交722b84f05403204e598af0de83b2ffcd4536b247 | 真实浏览器扩展 + Native Messaging，不导出 Cookie 来假装原生；需注册 Native Host，Windows用HKCU。主要文档以Chrome为主，Edge支持深度需核对 | 官方预编译 Windows x64 tar.gz 19,923,231字节（19.00 MiB）；本地CLI无需Node/npm | **观察备选**；注册、缓存版本/路径、附加Agent面板功能和更新频率增加维护面 |

以上大小是上游单个下载归档或 EXE，不是 MediaSail 安装包增量、完整安装占用或实测启动内存。未运行候选，不宣称它们已在本机完成连接或取数。[B2][A1][P1][C1]

## 1. BrowserSkill 为什么最贴合

其项目结构是外部 Agent + bsk CLI/daemon +浏览器扩展，不要求把另一个 LLM/Agent 内核装进 MediaSail。官方明确 shell-capable Agent 共用 CLI，DSH 插件仅是另一入口；可提供自己的按需资料入口，不必自动运行 bsk install-skill 安装用户全局配置。[B1][B5]

数据能力不是只截图：加载后的表格和列表可导出 JSON/CSV，带来源、列、coverage、缺失位置及文件 hash；不会自动翻页，必须由 Agent 根据任务决定继续读取。网络调试支持取得保留的请求、响应 body 和 JSON 指针，适合核对私有运营字段的证据；开始捕获之前的网络流量不能追溯恢复。[B6][B7]

上游共享控制有自己的 context/observation 调用协议，它是低层工具使用契约，不是 MediaSail 的运营工作流。自己的 Skill 仍只指导背景、数据口径和成果回存，工具具体调用资料按需展开；不要把底层协议扩成每轮会话的固定业务执行链。[B1]

部署上可设置 BSK_HOME 指向软件管理的工具状态目录；BSK_AUTO_UPDATE=off 可以关闭 daemon 自更新，避免内置版本脱离验收组合。选择此工具后再验证长期连接、断开、路径与升级行为，不把 env 开关当作已经完成的集成。[B8][B9]

### 必须先核对商店版本

本次通过官方商店页面读取，Chrome 商店显示0.4.1（11-01），Edge Add-ons页面显示0.4.0（10-29）。Edge页面也有旧 bh/Browser-hand 文案，因此仍需以实际已安装版本确认，不能只按商店介绍或 GitHub 最新 tag 推断。[B3][B4]

0.4.1发行说明明确要求 CLI/daemon/extension 协调升级，协议1.8为新 target policy 的前提。不可将0.4.1 CLI与0.4.0扩展直接当已验证组合。可能的正式路径是核对Edge商店更新，或按Edge正常流程使用Chrome商店扩展后实测；本轮没有执行这两条路径。[B2][B10]

## 2. 其他候选的关键差别

**agent-browser** 的优势是有独立 Windows 原生二进制，现有 CDP 可直接连接；无需把 MCP 设为唯一入口。其默认 Chrome for Testing/新 profile 路线不适用于“直接复用日常登录”。当前 Windows auto-connect 检测 Chrome、Chrome SxS、Chromium、Brave，源码没有 Edge 默认目录；显式 CDP 支持不能替代 Edge 自动发现测试。[A1][A2][A3]

**Playwriter** 的优势是让 Agent 直接写 Playwright 片段，适合复杂 DOM、网络和多步骤取数；本地模式不要求云账号。需要扩展、Node、relay及依赖，有可选云/远程/视频相关能力，不能仅看网站的Node18说明就忽略当前依赖声明。选择后必须按发行包锁定完整闭包，与现有业务Playwright隔离。仓库根LICENSE为MIT，子包package.json的license字段为空，发行时应纳入实际根许可证和依赖声明。[P1][P2][P3]

**Browser Harness** 需要分清本地页面操作与 fetch-use 云 helper。其本地 CDP/页面操作无需云 key，但 fetch-use.fetch 调用的是 Browser Use 在线服务，需要API Key；不能把这个 helper 称作本地带登录态fetch。只考虑底层Harness，不引入整套模型SDK。详见[补充候选研究](2026-11-05-browser-alternatives.md)。

**chrome-use** 除浏览器控制还有Agent面板、调度、录屏等大量附加功能，不能把整仓“开箱可用”当作本产品都需要。Windows Native Host 注册、现有独立安装与库内缓存路径之间的关系需要专门验证；本轮不采用它的浏览器重启/隐藏调试横幅选项。[C1][C2]

## 3. 不优先内置

- **Playwright CLI + 官方扩展**：继续保留为对照候选，不再因为之前已经研究就锁定；其0.1.23依赖预发布核心且需要Node，当前没有明显的轻量交付优势。原研究与门槛记录仍保留。[L1]
- **PinchTab**：MIT、有Windows原生EXE，但项目README明确Windows是limited/best-effort，主要测试macOS/Linux；核心是HTTP控制面/多实例管理，接真实浏览器仍需要已有CDP，不默认增加这套常驻控制面。[T1][T2]
- **BrowserRig**：MIT，CLI/扩展思路接近需要，明确宣称Chromium含Edge；本次官方API显示项目规模很小，尚无独立Windows二进制资产，运行时仍需Node。先观察，不因文案“无确认”越过首次扩展设置核验。[R1]
- **BrowserOS**：完整浏览器而不是已有Edge/Chrome的轻桥接，不符合本次轻量与原生会话目标。BrowserMCP、mcp-chrome、OpenCLI、Panerelay等额外成本与排除依据见补充研究。
- **复制 Cookie 到隔离浏览器的工具**：例如 cdt 公开README就是该实现，与当前用户直接原生登录、复用现有会话的方向不同，不能用“已登录”三个字掩盖会话复制。[D1]

## 建议下一轮只验证的内容

选定的每套内置工具固定二进制/依赖/扩展组合，测试Windows、Edge/Chrome、正确profile、读概览/结构化列表/必要响应、断开保留浏览器、中文路径、软件退出/升级时工具连续性，再核对登记到现有账号观测与内容库。外部 Agent 自带工具仅由其环境负责；自己的业务回存接口继续维护，不把外部工具纳入逐个认证矩阵。

本轮不安装、不操作浏览器，不修改个人全局Skill。若下一步内置，继续保留 `allow_implicit_invocation: false` 的个人元数据偏好，并提供自己的工具路径与按需说明。扩展的首次安装、连接开关或远程调试授权仍遵循对应浏览器正常流程；把工具本体放进软件不等于这些前置步骤已经完成。

## 一手来源

- [B1] [BrowserSkill CLI0.4.1 README](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/README.md)
- [B2] [CLI0.4.1发行及Windows资产](https://github.com/Tencent/BrowserSkill/releases/tag/cli-v0.4.1)；[ext0.4.1发行](https://github.com/Tencent/BrowserSkill/releases/tag/ext-v0.4.1)
- [B3] [Chrome官方商店BrowserSkill](https://chromewebstore.google.com/detail/hhcmgoofomhgciiibhipgmgkgnoenaoi)
- [B4] [Edge官方商店BrowserSkill](https://microsoftedge.microsoft.com/addons/detail/browserskill/emacgiaaaiojkkpkddmmdfhmokgmnikg)
- [B5] [bsk Rust crate](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/crates/bsk-cli/Cargo.toml)；[MIT](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/LICENSE)
- [B6] [结构化提取](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/crates/bsk-cli/skill/references/extraction.md)
- [B7] [请求、响应与证据](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/crates/bsk-cli/skill/references/debugging.md)
- [B8] [工具状态目录](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/crates/bsk-cli/src/daemon/paths.rs)
- [B9] [自动更新开关](https://github.com/Tencent/BrowserSkill/blob/cli-v0.4.1/crates/bsk-cli/src/cli/update.rs)
- [B10] [Microsoft：Edge扩展正规安装流程](https://support.microsoft.com/en-us/edge/add-turn-off-or-remove-extensions-in-microsoft-edge)
- [A1] [agent-browser0.41.2 README](https://github.com/vercel-labs/agent-browser/blob/v0.41.2/README.md)；[发行资产](https://github.com/vercel-labs/agent-browser/releases/tag/v0.41.2)
- [A2] [官方CDP说明](https://agent-browser.dev/cdp-mode)
- [A3] [固定提交CDP发现源码](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/native/cdp/chrome.rs#L1169)
- [P1] [Playwriter0.9.0 README](https://github.com/remorses/playwriter/blob/playwriter%400.9.0/README.md)；[发行](https://github.com/remorses/playwriter/releases/tag/playwriter%400.9.0)
- [P2] [依赖及JS入口](https://github.com/remorses/playwriter/blob/playwriter%400.9.0/playwriter/package.json)
- [P3] [Playwriter MIT](https://github.com/remorses/playwriter/blob/playwriter%400.9.0/LICENSE)
- [C1] [chrome-use1.5.281 README](https://github.com/leeguooooo/chrome-use/blob/v1.5.281/README.md)；[Windows发行](https://github.com/leeguooooo/chrome-use/releases/tag/v1.5.281)
- [C2] [Windows安装器原件（本次只读）](https://github.com/leeguooooo/chrome-use/blob/v1.5.281/install.ps1)
- [T1] [PinchTab README及Windows限制](https://github.com/pinchtab/pinchtab/blob/a6266202/README.md)
- [T2] [PinchTab0.15.2发行](https://github.com/pinchtab/pinchtab/releases/tag/v0.15.2)
- [R1] [BrowserRig仓库及许可证](https://github.com/Castor6/BrowserRig)
- [D1] [cdt：Cookie复制与隔离Edge](https://github.com/arsonist-g/cdt)
- [L1] [此前固定候选研究](2026-11-05-browser-fallbacks.md)

本机构建区 `.test-data/browser-candidates/` 留存官方元数据、tag对应提交与只读源码快照，未加入程序发行产物。外部检索结果用于发现候选，不把摘要营销承诺（如不被识别、永不确认或零失败）当验收结论。
