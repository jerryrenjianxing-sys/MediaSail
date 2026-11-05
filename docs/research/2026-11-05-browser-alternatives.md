# 浏览器备用工具：扩展候选研究

日期：2026-11-05（Asia/Shanghai）。任务仅为选型研究：读取上游 GitHub、官方文档及包发行元数据，未安装候选、未运行候选 CLI、未连接真实浏览器、未修改用户软件或资料库。本文件补充 [首轮研究](2026-11-05-browser-fallbacks.md)，不把首轮四项当作候选范围上限。

## 结论

本补充集里，**Browser Harness 值得进入后续验证**：它是 Browser Use 当前 CLI 实际使用的较薄执行层，能供任意有本机命令能力的 Agent 调用，Python 版本声明兼容 3.11，且发行源码已经枚举 Windows Edge 的真实用户目录。它的本地路径无需云账号或浏览器扩展，但要求浏览器暴露已授权的 CDP；官方使用说明主要承诺 Chrome，**Edge 目前只有源码支持依据，尚未实测**。[BU1][BH1][BH2][BH3]

另一个值得保留的是 **Panerelay**：官方同时说明 Windows、Chrome、Edge，扩展及 Native Host 将现有会话接给多个已有引擎，还提供真正使用浏览器登录态的 Fetch。它是连接桥，页面操作仍需 agent-browser、Browser Use 或 Playwright CLI；因此不应把它误当作一份 CLI 就能替代所有执行引擎的方案。相比直接使用引擎自己的扩展，它增加一层 Node、注册与版本兼容维护。[PN1][PN2][PN3]

**BrowserOS 排除出“复用已开 Edge / Chrome 的轻量备用”**：它现在明确定位为另一个完整 Chromium 浏览器，通过导入 Chrome 登录数据开始工作。已有 Windows 安装包不改变这一点。Browser MCP、mcp-chrome 可复用用户已经配置的 MCP，但不宜为了只会执行本机命令的 Agent 额外建设统一 MCP 宿主。OpenCLI 和 chrome-bridge 有直接 CLI，适合作为进一步比较对象；其 Edge 支持或交付边界要继续核验，不能从“Chromium 扩展理论可运行”推导已经支持。[OS1][OS2][BM1][MC1][OC1][CB1]

产品边界沿用用户这次的要求：只挑少量内置工具负责测试与维护；外部 Agent 已有合适工具或连接时直接复用，Skill 说明如何选择与调用即可。一份 Markdown 是说明，不能替代命令入口、运行时、浏览器授权或 Agent 的 MCP 客户端。

## 证据口径及固定版本

- **文档支持**：上游明确写出使用方式与平台，不代表本产品已验证。
- **源码迹象**：在固定提交找到相应分支、目录枚举或注册代码，不升级为上游已承诺的完整支持。
- **未实测**：本次所有候选均如此；没有真实登录态、上传、发布、掉线恢复或发行包验收结果。

通过 GitHub API、`git ls-remote` 及固定 ref 的原文件核对。标为快照的项目不冒充已有对应发行资产。

| 项目 | 本文固定版本 / 提交 | 发行形态与许可 |
| --- | --- | --- |
| Browser Use | `0.13.14`，`2cc71890e65056b67fdb29d98bb407749c15bb08`；当日 main `b49a68e4060acb226da8f784194fef301c53a6d7` | Python 包；该 GitHub Release 无独立 Windows 可执行资产；MIT。[BU1][BU2] |
| Browser Harness | `v0.1.13`，`c24e5072ee66f8499bacd663f4f4bcb089bc4492`；当日 main `be26283ee9c3dd089aefa70ffb04cf71dc6f59e1` | Python 包，`browser-harness` / 可选 `browser-harness-mcp`；MIT。[BH1][BH4] |
| Browser MCP（`browsermcp/mcp`） | 当日 main 快照 `ba7a268f6b45be4a8f7f98dd8511887d91269eb4`，源码包版本 `2.4.0` | Node MCP 服务与浏览器扩展；本次 GitHub latest-release API 返回 404，不能据此认定 npm 上没有发行；Apache-2.0。[BM1][BM2] |
| mcp-chrome（`hangwin/mcp-chrome`） | `v1.0.0`，`2e758621d51c2f9ce0060122ea21ab8afc608979`；当日 master `f48e71751e00bc09725c7e173423cff4f2ccd12a` | Release 有 `chrome-mcp-server-1.0.0.zip`；tag 中 Native Host 包版本另为 `1.0.29`，不可混用两者编号；MIT。[MC1][MC2] |
| OpenCLI | `v2.0.2`，`deca0fee85016be2e58836eeca974825e09c9076`；当日 main `97dc0cd5214b9602bcda78d7422f231ee8a803e9` | Node CLI；该 release 资产为 `opencli-extension-v1.0.26.zip`；Apache-2.0。[OC1][OC2] |
| Panerelay | `v0.11.1`，`852dcd8208f58a885187329c185df9167d45c9c3`（亦为当日 main） | Node 包与 `panerelay-extension-0.11.1.zip`；MIT。[PN1][PN2] |
| chrome-bridge（`siropkin/chrome-bridge`） | 当日 master 快照 `10d4e4c2bf96982d5114c7ff54ca21358f500b76`，源码/manifest 版本 `1.29.3` | Node 源文件与扩展；该快照未核到对应的独立 Windows EXE；MIT。[CB1][CB2] |
| BrowserOS neo（排除项） | GitHub Release tag `browserclaw/v0.52.0` 指向 `6598afeb3b3c4ebfda5fd86a0e0d2824f5c1696c`；文档读取当日 main `ee2c2945124136d6a1b8ecec447e0bf12014d7ba` | Release 后加有 `0.52.1.1` Windows x64 安装包；完整 Chromium fork；AGPL-3.0。维护资产的实际源码不是该公开 tag，见下文。[OS1][OS3] |

## 六个新增候选的比较

| 候选 | 是否真的接日常会话 | Windows 本地可打包部分 | 额外前置与 Agent 接口 | 本轮判断 |
| --- | --- | --- | --- | --- |
| **Browser Use / Browser Harness** | Chrome 144+ 本地连接由官方说明；Harness 已发行源码扫描 Windows Chrome、Edge 各 channel 的 `DevToolsActivePort` | Harness Python 包与依赖；可尝试复用现有 Python，不需随包完整 Browser Use 或 Chromium | 无扩展；用户启用远程调试并批准连接；stdin Python CLI 供命令型 Agent；MCP 可选 | 本补充集优先验证。Chrome 文档明确，Edge/多个浏览器同时打开的选定行为未实测。[BH1][BH2][BH3] |
| **Browser MCP** | 官方明确复用 Chrome / Edge / Brave profile；扩展 `chrome.debugger` 中继，不靠新 profile | Node 服务、匹配 JS 依赖及自构建扩展；已有商店扩展 | 扩展首次核对六位码并 Allow；Node；执行接口主要为 MCP stdio | 用户已有配置则复用；没有核到独立页面操作 CLI，不视为“只提供命令路径即可给任意 Agent 使用”。[BM1][BM2][BM3] |
| **mcp-chrome** | 官方说明真实 Chrome；通过 Native Messaging 接现有扩展 | Node Native Host、JS 依赖、扩展；含 `better-sqlite3` 本机模块 | Native Host 注册、扩展 Connect；MCP HTTP / stdio；管理 CLI 不是页面操作 CLI | 不作为 Edge / Chrome 统一默认。固定版注册/发现代码仅 Chrome、Chromium，未列 Edge；维护与 ABI 负担较大。[MC1][MC2][MC3] |
| **OpenCLI** | 官方说明扩展接真实 Chrome / Chromium，保留现有登录态及 profile 选择 | Node CLI、daemon、匹配依赖、扩展；本次固定 release 只核到扩展 ZIP | Node `>=20.18.1`；扩展；`opencli browser ...` 是直接页面操作 CLI，不强制 MCP | 有价值的通用 CLI 备选，但平台适配器范围大；Edge 未核到明确承诺，不把 Windows App 下载宣传等同于开源 CLI 已有独立 EXE。[OC1][OC2][OC3] |
| **Panerelay** | 官方明确 Windows Chrome / Edge；扩展在当前会话执行 Fetch，并向引擎提供被授权 tab | Node CLI、Native Host、匹配模块、扩展；Windows 注册有双浏览器分支 | Node 20+，商店扩展或手动加载；Fetch CLI 直用；页面 Connect 还依赖现成引擎 | 连接桥备选。现成引擎已能连时不必再引入；需要统一的有范围授权桥接时再评估。[PN1][PN2][PN3] |
| **chrome-bridge** | 官方明确唯一模式为真实已登录 Chrome，扩展 WebSocket 接本机服务 | `cli.mjs`、`server.mjs` 等源文件与扩展；零 npm 运行时依赖，仍需 Node `>=18` | 扩展商店/手动安装；无需 MCP、Native Host 或浏览器 remote-debugging 端口；部分操作用 `chrome.debugger` | 很薄的直接 CLI 候选。Windows Node 源码有显式兼容；官方安装脚本需 Git Bash，Edge 未获文档保证；不是无运行时的 Windows 原生 EXE。[CB1][CB2][CB3] |

上述本地浏览器连接路径均不以购买商业云账号为前提。Browser Use 另有云浏览器、云 profile 同步与云 Fetch；不能把这些作为“本地复用”的证据。各项目依赖的第三方许可证仍须分别核对，顶层 MIT / Apache-2.0 不覆盖全部依赖。[BH2][BH5][PN1]

## Browser Use 需要单独澄清的变化

### 当前 CLI 已是另一种接口

`browser-use==0.13.14` 的入口将执行委托给 `browser_harness.run`，依赖固定 `browser-harness==0.1.13`。该发行版源码称其为 CLI 3.0：旧的 `open`、`state`、`click` 类预设子命令及 `--profile`、`--headed` 等旧接口已被移除/替换，正常调用是把 Python 从 stdin 交给预导入的页面 helpers。不要拿旧教程写产品 Skill，也不要把仓库根包版本 `0.13.14` 与“CLI 3.0”当作冲突的发布版本号。[BU1]

上游形态示意，**本次未执行**：

```powershell
@'
print(page_info())
'@ | browser-harness
```

它执行的是 Agent 提供的步骤，并不要求内部再用一个 LLM 来规划。完整 Browser Use 包含许多模型 SDK、文档处理与云 SDK 等直接依赖；若只需要这个本地 CLI 执行层，独立 Harness 是更小的候选。`browser-use install` 的源码会调用 Playwright 安装 Chromium，这不是连接已经打开的用户浏览器的必需步骤。[BU1][BH1][BH6]

### 现有 Python 3.11 的声明兼容性

Harness `0.1.13` 自身声明 Python `>=3.11`。以下四项为其固定的直接运行依赖；MCP 是另一个可选 extra。包发行元数据支持“产品现有 Python 3.11.15 满足版本条件”的判断，**不支持“已经完成产品内运行验收”**；本次没有在现有业务 Python 环境中解析、安装或导入它们。[BH1][PY1]

| 直接依赖 | Python 条件 | 本次核到的分发证据 |
| --- | --- | --- |
| `cdp-use==1.4.5` | `>=3.11` | `py3-none-any` wheel；另依赖 httpx、typing-extensions、websockets。[PY2] |
| `fetch-use==0.4.0` | `>=3.9` | `py3-none-any` wheel，无必选的额外包依赖。[PY3] |
| `Pillow==12.3.0` | `>=3.10` | 有 `cp311-cp311-win_amd64` wheel，包含本机代码。[PY4] |
| `websockets==15.0.1` | `>=3.9` | 有 `cp311-cp311-win_amd64` wheel。[PY5] |

官方安装示例推荐使用 Python 3.12，不等于该发行版 `Requires-Python` 排除了 3.11。最小部署也不能只数“四个依赖”：仍需固定传递依赖、Windows wheels、LICENSE/NOTICE，并验证与既有业务依赖的兼容性。该验证可在后续隔离环境完成，当前不改现有环境。[BH1][BH2][PY1][PY2]

### 真实浏览器、云和清理边界

- **文档支持：** Chrome 144+，用户到 `chrome://inspect/#remote-debugging` 启用开关并点击 Allow。开关是首次前置条件；Allow 是连接授权，不能宣传为安装一次后永远不再出现。没有 Browser Use API key 也可用本地 Chrome。[BH2][BH3]
- **源码迹象：** `daemon.py` 在 Windows 枚举 Chrome stable / beta / dev / SxS、Chromium、Microsoft Edge stable / beta / dev / SxS、Brave 的真实 user-data 根目录，读取各自 `DevToolsActivePort`，也支持 `BU_CDP_WS` / `BU_CDP_URL` 显式端点。它没有通过复制 profile 来获得登录态。[BH3]
- **选定问题：** 上述发现循环按目录顺序取可用端点，不能据此保证同时打开 Chrome、Edge、多个账号时会选中用户本次想用的那一个。需要在后续验证端点绑定和 `page_info()` / tab 证据，不能只凭“发现了一个浏览器”继续写入。[BH3]
- **Windows 实现：** IPC 使用 loopback TCP 和本地 token，daemon 采用隐藏窗口的创建参数；这些是已发行源码的 Windows 分支，尚未证明在本产品安装目录中工作。[BH7]
- **退出行为：** 本地 shutdown 源码不调用 `Browser.close`；清理自己创建的 dedicated tab 和 IPC。云停止请求仅在存在 `BU_BROWSER_ID` 时发出。因此“不会把本地浏览器进程当作自己启动的进程关闭”有源码依据，但关闭具体 tab、断线恢复及 daemon 退出后的实际浏览器状态仍应验证。[BH3][BH8]
- **云 Fetch 边界：** `fetch-use` 是 Browser Use HTTP 服务的客户端，直接调用它需要云 key；Harness helper 在存在 key 时可走该服务，否则回退普通本机 urllib。两者都不能自动等同于“用当前浏览器 cookies 发请求”。需要浏览器当前登录态时，应使用页面 CDP 路径，或另评估 Panerelay 的扩展 Fetch。[BH5][PY3][PN1]
- **可选云启动：** Harness 的自动云启动要求显式 `BU_AUTOSPAWN` 等条件；仅环境中存在 API key 不足以自动建云浏览器，显式 CDP 配置也会阻止该回退。这是固定版源码行为，不应在产品备用说明中主动启用。[BH6]

## 其余候选的关键取舍

**Browser MCP 现在应读当前代码，不沿用早期印象。** 当前固定快照的 README 明确提供扩展源码、Edge/Brave、profile、多 client daemon、首次配对及浏览器停止控制。源码包声明 `2.4.0`；服务 README 说运行需 Node 20+，仓库根则要求 Node 24+、pnpm 构建。应区分运行要求与自构建要求。它面向 MCP，`mcp-server-browsermcp` 是 MCP 服务入口；没有核到等价于 `snapshot/click` 的普通命令界面。只会跑本机命令的 Agent 理论上可以再实现 MCP 客户端，但这不再是“一份工具说明就能直接用”的现成能力。[BM1][BM2][BM3]

**mcp-chrome 的 Windows 安装文档不等于 Edge 已覆盖。** 固定 tag 的 `BrowserType`、Windows Native Messaging registry keys 和安装探测都只列 Chrome / Chromium；Node 路径捕获代码还明确提到 `better-sqlite3` 的 `NODE_MODULE_VERSION` 不匹配。因此不能随便拿现有 Electron/Node 运行时替换并宣称可运行。已配好 MCP 的用户可以复用，默认内置前需承担 native module、注册与多进程的额外验证；本轮不优先。[MC2][MC3][MC4]

**OpenCLI 的通用浏览器命令和站点适配器是两个维护范围。** 官方已有导航、state、click、fill、截图、网络和 eval 等直接 CLI，不必先为每个平台写 adapter；多 profile 时支持列出、命名、显式选择。若后续选它，应只按通用浏览器能力评估，不从大量内置站点命令推导本项目的平台读写/发布已经可用。官方推荐的 OpenCLIApp 是另一个下载入口；本次只确认 `v2.0.2` 开源 CLI、Node 依赖及扩展 ZIP，未将桌面 App 认定为可直接随 MediaSail 重分发的已验证 Windows runtime。[OC1][OC2][OC3]

**Panerelay 的 Windows / Edge 证据比一般 Chromium 推断更直接。** `host-installation.ts` 明确为 Chrome、Edge 分别写 HKCU Native Messaging 注册，生成 Windows launcher，保留特定 Node 路径。它无需用户开启浏览器远程调试端口；需用户在扩展授权域名或 tab。Browser Use 兼容指南给出 PowerShell 和 CMD 调用，并区分“最低支持版本”与“实际验证基线”：基线为 Browser Use `0.13.7` + Harness `0.1.8`，较新版本满足版本下限并不自动获得 Verified 状态。不能把这个基线直接套到本次 Harness `0.1.13`。[PN1][PN3][PN4]

**chrome-bridge 的优势是小，但有明确边界。** 固定快照只使用 Node 内建模块，CLI 以 `process.execPath` 启动隐藏的本地 server，所有页面命令可直接走 CLI 或本地 JSON HTTP；扩展连 `127.0.0.1:9333`。Windows 本体可以直接 Node 启动，`install.sh` 需要 Git Bash，不能把 Bash 安装步骤当作 Windows runtime 必需品。没有核到 Edge 明确支持或独立 EXE。README 中对竞品“只能新 profile”的比较与那些竞品当前官方资料不一致，本研究不采信该比较，仅用它自己的实现说明。[CB1][CB2][CB3]

## BrowserOS 为什么排除

当前官方 README 直接将 BrowserOS neo 定义为第二个浏览器，要求安装完整 Chromium fork，再从 Chrome 导入 logins、bookmarks、extensions。它可通过本机 `http://127.0.0.1:9200/mcp` 给任意支持 HTTP MCP 的 Agent 使用；这属于独立浏览器产品，并非桥接当前已打开的 Edge / Chrome。其本机 MCP 不要求购买 BrowserOS 云账号，但 Agent 仍需自己的模型服务和 MCP 能力。[OS1][OS2][OS4]

发行资产也需谨慎对应版本：`browserclaw/v0.52.0` 下已有 `BrowserOS_neo_v0.52.1.1_x64_installer.exe`（140,804,064 bytes）。官方 provenance 明示维护资产在私有 mirror 的 `e78abd8f7ffa117fe6113c34a3d77264d19d1f91` 构建，公开 tag 仍是 `6598afeb...`，`included_public_source_sha` 是 `ac5217c9c133b95bc6d239f2785a1121da09c81f`，并记载 `runtime_smoke_test: false`。不能把“有公开仓库 + 有 Windows 安装包”写成“此安装包就是公开 tag 已完成运行验证的构建”。这不改变它的开源定位，但本次不把该资产纳入最小内置备用。[OS3]

可本地打包的是整个浏览器及其后端，而非一个能直接复用 Edge / Chrome 的小桥；从源码构建还涉及约 100GB Chromium 工程、Python 3.12+、Windows Visual Studio 2022 和 SDK。相对于当前需求，维护面过大，且登录态导入不是原会话接入。许可证为 AGPL-3.0，后续若换目标研究分发整套浏览器，需单独评估对应源码和分发义务；本轮不展开实现或法律结论。[OS1][OS5]

## 对后续选择真正有用的验收项

本次没有新增安装、产品入口、Skill 或配置。后续只对最终选择的少量内置工具验收：

1. 固定工具与扩展版本，在 Windows 已开 Chrome、Edge 上分别读取真实已登录 tab；不能通过空 profile、cookies 导入或重新登录替代。
2. 在同时存在两个浏览器与多个 profile 时明确选中目标；首次授权、重连后授权和权限收回有准确行为。
3. 无全局 Node/Python 的用户机器上，从产品发行路径启动；复用既有 runtime 的能力需实际验证，特别是 daemon 子进程、中文/空格路径、本机 wheels/ABI 与卸载升级路径。
4. 断开工具后保留外部浏览器；只清理工具自己创建的资源，不把本地会话当云实例停止。
5. Agent 的既有连接优先；内置备用只在缺少可用能力时使用。命令型 Agent 直接读帮助并调用 CLI；MCP 型候选只有在宿主提供 MCP 客户端时才算可用。

这些是未来验证边界，不是本次已经通过的测试，也不要求同时把所有候选接入产品。

## 来源

- [BU1] [Browser Use 0.13.14 CLI](https://github.com/browser-use/browser-use/blob/2cc71890e65056b67fdb29d98bb407749c15bb08/browser_use/cli.py)；[同版 pyproject](https://github.com/browser-use/browser-use/blob/2cc71890e65056b67fdb29d98bb407749c15bb08/pyproject.toml)。
- [BU2] [Browser Use 0.13.14 release](https://github.com/browser-use/browser-use/releases/tag/0.13.14)；[LICENSE](https://github.com/browser-use/browser-use/blob/2cc71890e65056b67fdb29d98bb407749c15bb08/LICENSE)。
- [BH1] [Harness 0.1.13 pyproject](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/pyproject.toml)。
- [BH2] [Harness 0.1.13 安装与本地/云界限](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/install.md)。
- [BH3] [Harness 0.1.13 daemon：发现目录、CDP、shutdown](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/daemon.py)。
- [BH4] [Harness v0.1.13 release](https://github.com/browser-use/browser-harness/releases/tag/v0.1.13)；[LICENSE](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/LICENSE)。
- [BH5] [Harness 0.1.13 helpers：fetch 路由](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/helpers.py)。
- [BH6] [Harness 0.1.13 CLI：执行与云 opt-in](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/run.py)。
- [BH7] [Harness 0.1.13 Windows IPC 与进程创建](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/_ipc.py)。
- [BH8] [Harness 0.1.13 admin：连接授权与 daemon 停止](https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/admin.py)。
- [PY1] [Harness 0.1.13 官方包发行元数据](https://pypi.org/pypi/browser-harness/0.1.13/json)。
- [PY2] [cdp-use 1.4.5 官方包发行元数据](https://pypi.org/pypi/cdp-use/1.4.5/json)。
- [PY3] [fetch-use 0.4.0 官方包发行元数据与 wheel 链接](https://pypi.org/pypi/fetch-use/0.4.0/json)。本次只在内存解开该 wheel 阅读客户端源文件，未安装或执行。
- [PY4] [Pillow 12.3.0 官方包发行元数据](https://pypi.org/pypi/pillow/12.3.0/json)。
- [PY5] [websockets 15.0.1 官方包发行元数据](https://pypi.org/pypi/websockets/15.0.1/json)。
- [BM1] [Browser MCP 固定快照 README / 许可说明](https://github.com/browsermcp/mcp/blob/ba7a268f6b45be4a8f7f98dd8511887d91269eb4/README.md)；[LICENSE](https://github.com/browsermcp/mcp/blob/ba7a268f6b45be4a8f7f98dd8511887d91269eb4/LICENSE)。
- [BM2] [Browser MCP 服务 package](https://github.com/browsermcp/mcp/blob/ba7a268f6b45be4a8f7f98dd8511887d91269eb4/packages/mcp/package.json)；[构建根 package](https://github.com/browsermcp/mcp/blob/ba7a268f6b45be4a8f7f98dd8511887d91269eb4/package.json)。
- [BM3] [Browser MCP 服务 README / 架构与接口](https://github.com/browsermcp/mcp/blob/ba7a268f6b45be4a8f7f98dd8511887d91269eb4/packages/mcp/README.md)。
- [MC1] [mcp-chrome v1.0.0 README](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/README.md)；[release](https://github.com/hangwin/mcp-chrome/releases/tag/v1.0.0)；[LICENSE](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/LICENSE)。
- [MC2] [Native Host package / Node / 本机依赖](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/app/native-server/package.json)。
- [MC3] [browser-config：浏览器枚举与 Windows 注册](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/app/native-server/src/scripts/browser-config.ts)；[管理 CLI](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/app/native-server/src/cli.ts)。
- [MC4] [Windows 安装说明](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/docs/WINDOWS_INSTALL_zh.md)；[Native Host Node 路径与 ABI 说明](https://github.com/hangwin/mcp-chrome/blob/2e758621d51c2f9ce0060122ea21ab8afc608979/app/native-server/src/scripts/utils.ts)。
- [OC1] [OpenCLI v2.0.2 README](https://github.com/jackwener/opencli/blob/deca0fee85016be2e58836eeca974825e09c9076/README.md)。
- [OC2] [OpenCLI v2.0.2 package](https://github.com/jackwener/opencli/blob/deca0fee85016be2e58836eeca974825e09c9076/package.json)；[release 资产](https://github.com/jackwener/opencli/releases/tag/v2.0.2)；[LICENSE](https://github.com/jackwener/opencli/blob/deca0fee85016be2e58836eeca974825e09c9076/LICENSE)。
- [OC3] [同版中文 README / Windows App 与 CLI 的分别](https://github.com/jackwener/opencli/blob/deca0fee85016be2e58836eeca974825e09c9076/README.zh-CN.md)；[扩展 manifest 1.0.26](https://github.com/jackwener/opencli/blob/deca0fee85016be2e58836eeca974825e09c9076/extension/manifest.json)。
- [PN1] [Panerelay 0.11.1 README](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/README.md)。
- [PN2] [Panerelay release](https://github.com/F-loat/panerelay/releases/tag/v0.11.1)；[bridge package](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/packages/bridge/package.json)；[CLI package](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/packages/cli/package.json)；[LICENSE](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/LICENSE)。
- [PN3] [Panerelay Native Host 安装与 Windows 双浏览器注册](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/packages/bridge/src/host-installation.ts)。
- [PN4] [Panerelay Browser Use 接入、PowerShell 示例及验证基线](https://github.com/F-loat/panerelay/blob/852dcd8208f58a885187329c185df9167d45c9c3/packages/adapters/browser-use/README.md)。
- [CB1] [chrome-bridge 固定快照 README](https://github.com/siropkin/chrome-bridge/blob/10d4e4c2bf96982d5114c7ff54ca21358f500b76/README.md)。
- [CB2] [chrome-bridge package / 版本与依赖](https://github.com/siropkin/chrome-bridge/blob/10d4e4c2bf96982d5114c7ff54ca21358f500b76/package.json)；[LICENSE](https://github.com/siropkin/chrome-bridge/blob/10d4e4c2bf96982d5114c7ff54ca21358f500b76/LICENSE)；[扩展 manifest](https://github.com/siropkin/chrome-bridge/blob/10d4e4c2bf96982d5114c7ff54ca21358f500b76/extension/manifest.json)。
- [CB3] [chrome-bridge CLI：Windows 与 server 派生](https://github.com/siropkin/chrome-bridge/blob/10d4e4c2bf96982d5114c7ff54ca21358f500b76/cli.mjs)。
- [OS1] [BrowserOS 当日固定快照 README / 许可与导入](https://github.com/browseros-ai/BrowserOS/blob/ee2c2945124136d6a1b8ecec447e0bf12014d7ba/README.md)。
- [OS2] [BrowserOS neo 安装说明](https://github.com/browseros-ai/BrowserOS/blob/ee2c2945124136d6a1b8ecec447e0bf12014d7ba/docs/neo/install.mdx)。
- [OS3] [BrowserOS release 及资产](https://github.com/browseros-ai/BrowserOS/releases/tag/browserclaw/v0.52.0)；[官方 0.52.1.1 provenance](https://github.com/browseros-ai/BrowserOS/releases/download/browserclaw/v0.52.0/build-provenance-0.52.1.1.json)。
- [OS4] [BrowserOS neo 手动 HTTP MCP 接入](https://github.com/browseros-ai/BrowserOS/blob/ee2c2945124136d6a1b8ecec447e0bf12014d7ba/docs/neo/mcp/manual.mdx)。
- [OS5] [BrowserOS Chromium 构建 README](https://github.com/browseros-ai/BrowserOS/blob/ee2c2945124136d6a1b8ecec447e0bf12014d7ba/packages/browseros/README.md)；[LICENSE](https://github.com/browseros-ai/BrowserOS/blob/ee2c2945124136d6a1b8ecec447e0bf12014d7ba/LICENSE)。
