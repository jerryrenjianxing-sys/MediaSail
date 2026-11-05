# 重新选型：无扩展 CDP 接入现有浏览器

日期：2026-11-05（Asia/Shanghai）。本次只读取官方文档、固定版本源码、GitHub 发行元数据；**未安装、运行候选，未连接或控制真实浏览器，未改用户环境**。目标仍是用户已经登录的真实 Chrome / Edge 和原有 profile，不以新建空 profile、复制 cookies、导入账号或云浏览器代替。

## 选择结论

**在无扩展 CDP 路线里，优先验证 `agent-browser 0.41.2`。** 它已有 Windows x64 原生 EXE，CLI 和后台执行进程均为 Rust 程序；固定源码通过再次启动自身 EXE 创建 daemon，连接现成 CDP 的路径直接连 WebSocket，不需要先下载 Chrome for Testing，也不需要通过 npm / Node 启动。它提供 DOM / JavaScript、元素文本、截图和请求详情 / HAR 导出，适合 MediaSail 的取数与证据回存。[A1] [A2] [A3] [A4]

**它避开的是扩展商店、扩展安装和 Native Messaging 注册，不是浏览器首次授权。** Chrome 144+ 已有官方支持的原生调试开关；Microsoft 也正式文档化 Edge 的原生开关及连接真实默认 user-data 目录的方法。因此这条路具有真实依据，不必再拿 Harness 的 Edge 目录枚举当作浏览器支持证明。但用户仍须允许本次调试，当前宿主 Agent 的权限或工具策略也不会因换成 CLI 而消失。[C1] [E1] [E2]

**Edge 必须单独处理目标端点。** `agent-browser 0.41.2` 的 Windows `--auto-connect` 目录列表没有 Edge；不能宣传它已经能零配置自动发现用户 Edge。建议未来由产品在用户选定 Edge 后读取该实例现有的 `DevToolsActivePort`，把完整 WebSocket 地址交给 `--cdp`，再核对 tab 的标题、URL 和账号页面。此建议是基于协议与固定源码的实现判断，尚未实测。[A2] [A5] [E1]

## 固定研究基线

| 对象 | 版本 / 固定提交 | 本次确认的发行形态 |
| --- | --- | --- |
| Vercel agent-browser | `0.41.2` / `d52a5e90c372ec4710c69adc3837ac14bbd852aa` | 2026-11-03 UTC 发布；Windows 资产 `agent-browser-win32-x64.exe` 为 **18,248,192 bytes，约 17.40 MiB**。SHA-256：`c2eadee7b67e326dfff02d5dd51a16ce7673eb165699d134b3ea5f05b4a7a9d0`。这是发行 API 元数据，未下载复核文件。[A1] |
| Chrome DevTools MCP / CLI | 当前正式发行 `1.12.0` / `af2834411a564d366f9cab63efb046d9084f4dba` | 2026-10-22 发布，release 无独立资产；npm 包同时提供 `chrome-devtools-mcp` 和 `chrome-devtools` 两个入口。[D1] [D2] |
| Chrome DevTools MCP main | 2026-11-04 快照 `0877ee00d2e43c1c04bba275e7d08cc1033e36e9` | 仅作为当日更新情况核对，不与上述发行源码混作同一版本。[D3] |
| Browser Harness | `0.1.13` / `c24e5072ee66f8499bacd663f4f4bcb089bc4492` | Python 包；普通 CLI 与可选 MCP 入口，MIT。[H1] |
| Edge 官方接入文档 | `ade912a2a8ca99558c1b97d0bf955b53675968c6` 中的 `devtools-mcp-server.md` | Microsoft 官方文档源码快照；也现场核对现行 Learn 页面。[E1] [E2] |

## Chrome：不用重启或换 profile 的路径确实存在

Google 的正式方案是：在**已经运行的 Chrome 144+** 打开 `chrome://inspect/#remote-debugging`，启用远程调试，再由客户端请求连接。官方把它用于直接接入现有登录会话；该流程没有要求重新启动 Chrome 或创建另外一个 profile。Google 明确说明，每次客户端请求新的调试会话，Chrome 都会向用户显示允许连接的对话框；不能把首次开关与每次连接同意混成“一次配置、以后永久免操作”。[C1] [D4]

传统 `chrome.exe --remote-debugging-port=9222` 是另一条路径。从 Chrome 136 起，`--remote-debugging-port` 和 `--remote-debugging-pipe` 对默认 Chrome 数据目录不再生效，必须使用非标准 `--user-data-dir`。官方手动端口教程还要求先退出正在运行的 Chrome。因本需求必须复用用户原有默认数据目录，**不能用重启并加一个空目录的教程充当成功方案**；也不能声称给已经运行的进程补一个启动参数就能接上。[C2] [D4]

Chrome DevTools MCP 的自动连接说明还指出：多个 profile 活跃时，连接的是 Chrome 判定的默认 profile，服务可见该选定 profile 的全部窗口。因此“发现了 Chrome”不足以证明选中了用户本次所需账号；产品仍需连接后核对具体 tab 与页面身份。[D4]

## Edge：原生开关有正式文档，但不能照抄旧启动命令

Microsoft 的官方接入指南明确支持接入**已经运行、已经登录的 Edge 会话**：在 `edge://inspect` 的左栏选择 **Remote debugging**，勾选 **Allow remote debugging for this browser instance**。然后给 Chrome DevTools MCP 指定 `--autoConnect` 和真实 Edge user-data 根目录；Windows Stable 默认位置为 `%LOCALAPPDATA%\Microsoft\Edge\User Data`。这里 `--user-data-dir` 是**交给连接客户端用于发现现有端点**的参数，不是在启动新的浏览器，也不要求换目录。[E1] [E2] [D5]

因此，Edge 原生设置的证据现在是 Microsoft 自己的文档，不是从 Chromium 相似性或第三方目录列表推导而来。官方这篇指南未给出该设置的最低 Edge 版本，不能直接把 Chrome 的“144+”当作 Edge 的保证下限。后续应核对目标机器实际 Edge 版本和页面是否存在；**本次没有进行该现场检查**。[E1] [E2]

现行 Learn 页面同时仍保留 Option A：`msedge.exe --remote-debugging-port=9222`。这个无自定义目录的示例已有官方仓库 issue #3970：报告 Edge 154 默认目录不启动调试服务器。维护者指向修订 PR #3971，但本次 GitHub API 核对结果是 **Open、未合并**，其 head 为 `e63776d62f7ee6238b3f6a954e698fcbeab11989`。不能说修订已经生效，也不能把这个旧命令当作默认 profile 的可靠路径。本选型只使用官方已写明的原生设置 Option B。[E3] [E4]

Edge 的企业策略 `RemoteDebuggingAllowed` 也可以禁止远程调试；这不是安装一个 CLI 能解决的条件。若用户机器受管，应读取实际限制并如实报告，不能替用户关闭组织策略。[E5]

## 三个客户端的实际区别

| 客户端 | Windows / 运行时 / Agent 接口 | 复用真实会话的前提 | 本次建议 |
| --- | --- | --- | --- |
| **agent-browser 0.41.2** | 官方 Rust EXE；直接命令接口，MCP 可选。原生 EXE 连接现成 CDP 不依赖 Node。npm 包的 `Node >=24` 与从源码构建的 Node / pnpm / Rust 要求不能套到直接 EXE 路径。[A1] [A2] [A3] [A6] | 浏览器先开放并批准调试。Chrome 自动发现；Edge 要显式端点。不会因连接失败就把一个新空浏览器当作原会话。[A7] [A5] | 主用取数候选；优先做真实 Chrome / Edge 的只读验收。 |
| **Chrome DevTools MCP 1.12.0** | Node 运行时：`^20.19.0 || ^22.12.0 || >=23`。已有直接 `chrome-devtools` CLI，外部 Agent **无需自带 MCP 客户端**；CLI 内部调用 daemon，Windows 用 named pipe。没有核到官方独立 Windows EXE。[D1] [D2] [D6] | `--autoConnect`；Edge 按 Microsoft 文档把客户端 user-data 目录指向现有 Edge。源码读取 `DevToolsActivePort`，构造 WebSocket 地址后 `puppeteer.connect()`。[E1] [D5] | 用户已经有此能力可复用；为轻量 Windows 软件再内置 Node 与此包，通常比 agent-browser EXE 更重。 |
| **Browser Harness 0.1.13** | Python `>=3.11`，直接依赖固定为 `cdp-use 1.4.5`、`fetch-use 0.4.0`、`Pillow 12.3.0`、`websockets 15.0.1`；MCP 为可选 extra。标准 CLI 从 stdin 执行 Agent 给的 Python，并提供页面 helpers / raw CDP。[H1] [H2] [H3] | 官方安装文档主要教 Chrome 的原生开关；Windows 源码枚举 Edge，并支持 `BU_CDP_WS` 显式端点。Microsoft 的文档证明 Edge 有机制，**不证明这个 Harness 版本已通过 Edge 验收**。[H2] [H4] [E1] | 可复用现有 Python，但需要固定整套依赖并验证 daemon、中文路径和环境兼容；没有比原生 EXE 更少的浏览器授权步骤。 |

Chrome DevTools CLI 默认可能自动启动隔离浏览器；只有显式配置连接现有实例才符合本需求。该版本 CLI 文档还提醒 `start` 并非支持所有服务端参数；不能只看 MCP JSON 示例就声称 CLI 接入参数已在产品中验证。[D6]

Harness 的本地连接不需要 Browser Use 云 key，但完整 Python 环境不是一个薄说明文件。固定源码的 Edge 发现逻辑会按候选目录顺序查找，用户同时打开 Chrome / Edge 时尤其应显式绑定端点。其网络取证能力也不宜只凭 raw CDP 宣称现成产品功能已经齐全：固定版本 `interaction-skills/network-requests.md` 仍只是待补内容；标准化网络证据回存还需另做实现和验收。[H2] [H3] [H4] [H5]

## 哪些准备 Agent 能做，哪些同意不能省略

以下为后续产品流程建议，并非本次已经执行的操作。

| 步骤 | 可由 Agent / 产品承担 | 仍需用户参与的边界 |
| --- | --- | --- |
| 工具准备 | 产品预先固定 EXE、校验摘要、准备帮助与保存路径；不要在首次任务再要求用户逛扩展商店。原生 EXE 可直接命令调用。[A1] [A2] | 发行包能否在目标系统运行、签名 / 系统拦截情况仍须验收，当前未测。 |
| 浏览器定位 | 在获准范围内核对实际版本、浏览器和 user-data 目录；可打开原生设置页面协助定位。 | 用户选定愿意授权的浏览器 / profile。关闭调试时，CDP 工具自身尚无连接，不能自举去修改该页面。[H2] [C1] |
| 调试授权 | 已配置客户端可发出连接请求、保留等待状态、明确提示下一步。 | 开启原生调试及浏览器要求的同意必须有用户授权。Chrome 官方明确每次新调试会话弹窗；不可伪造、压掉或承诺永远不再出现。Edge 若出现相应同意界面，也应保留并按实际页面处理，不能凭本文假设其频率。[C1] [E1] |
| 连接及取证 | 用户同意后，读取现有端点、核对目标 tab，再提取 DOM / 表格及网络证据并保存。 | 如果目标会话不可见或账号不符，先纠正目标；不能改用新 profile 后把它称为同一登录态。[A4] [A5] [D4] |
| 退出 | 断开自己的连接，核对外部浏览器仍在。agent-browser 固定源码对外部 CDP 连接只断开，不发 `Browser.close`。[A3] | 具体断线恢复、tab 清理及重连授权仍未在 MediaSail 实测。 |

技术上可通过经授权的桌面工具帮助用户导航设置，不等于这些同意已经取得。工具也不能自行把浏览器调试开关改成永久开放，或修改组织策略来减少这一步。**更换实现不构成绕过当前 Agent 工具限制的理由**：若宿主明确拒绝相同浏览器操作，应报告该限制，不能改走 CLI、CDP 或桌面点击来复刻被拒绝动作。

## 是否真正解决上次的问题

- **扩展安装问题：能避开这一类别。** 三项 CDP 接入均不需要浏览器扩展；选择原生 agent-browser EXE，还能避免让最终用户额外安装 Node / Python。安装与分发验收仍是产品开发工作。[A1] [A2] [D5] [H4]
- **完全免人工准备：不能保证。** 已开、已登录只说明会话存在，不说明它允许被调试。原生调试开关、浏览器连接同意和宿主授权是独立条件。[C1] [E1]
- **默认 profile 必须重启：不是原生开关路径的要求。** Chrome 和 Edge 官方均描述在已经运行的实例中启用并接入。传统命令行端口路径与此不同；本需求不采用换空目录的替代。[C1] [E1] [C2]
- **Chrome / Edge 统一零配置：当前不能承诺。** Edge 原生能力已有官方证据；agent-browser 0.41.2 的自动发现仍缺 Edge，需显式连接与现场核对。[A5] [E1]

建议保留 **agent-browser 原生 EXE 作为取数主候选**，把 Chrome / Edge 首次授权作为准确、短小的接入前置；Chrome DevTools MCP / CLI 或 Harness 已经可用时复用。若用户连原生调试授权也不接受，无扩展 CDP 不能满足“真实会话 + DOM / 网络证据”全部要求，应如实交回限制，由父研究比较桌面可见内容方案。不能把桌面读取结果冒充网络响应证据。

## 官方来源

[A1]: https://api.github.com/repos/vercel-labs/agent-browser/releases/tags/v0.41.2 "agent-browser 0.41.2 官方发行元数据"
[A2]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/connection.rs#L1036 "原生程序以自身 EXE 启动 daemon"
[A3]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/native/browser.rs#L789 "CDP 接入与外部连接退出行为"
[A4]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/docs/content/docs/commands.mdx "DOM、脚本、网络详情与 HAR 命令"
[A5]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/native/cdp/chrome.rs#L1169 "自动发现、等待同意与 Windows 目录列表"
[A6]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/package.json "npm 版本及 Node 要求"
[C1]: https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session "Google 官方：原会话、原生开关、每次新调试会话同意"
[C2]: https://developer.chrome.com/blog/remote-debugging-port "Google 官方：Chrome 136 默认数据目录限制"
[D1]: https://api.github.com/repos/ChromeDevTools/chrome-devtools-mcp/releases/tags/chrome-devtools-mcp-v1.12.0 "Chrome DevTools MCP 1.12.0 官方发行元数据"
[D2]: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/package.json "1.12.0 的 CLI / MCP 入口与 Node 要求"
[D3]: https://github.com/ChromeDevTools/chrome-devtools-mcp/commit/0877ee00d2e43c1c04bba275e7d08cc1033e36e9 "当日 main 固定快照"
[D4]: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/docs/advanced-usage.md#connecting-to-a-running-chrome-instance "连接现有 Chrome、profile 选择、重启端口路径"
[D5]: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/src/BrowserManager.ts#L342 "读取既有 DevToolsActivePort 并 Puppeteer connect"
[D6]: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/docs/cli.md "直接 CLI、Windows named pipe、默认隔离及参数边界"
[E1]: https://github.com/MicrosoftDocs/edge-developer/blob/ade912a2a8ca99558c1b97d0bf955b53675968c6/microsoft-edge/web-platform/devtools-mcp-server.md#auto-connect-to-a-running-edge-instance "Microsoft 官方文档固定源码：Edge 原会话、原生开关及默认目录"
[E2]: https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server#auto-connect-to-a-running-edge-instance "现场核对的 Microsoft Learn 正文"
[E3]: https://github.com/MicrosoftDocs/edge-developer/issues/3970 "Edge 154 默认目录启动命令问题及维护者回复"
[E4]: https://api.github.com/repos/MicrosoftDocs/edge-developer/pulls/3971 "截至研究日仍未合并的修订 PR 状态"
[E5]: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/RemoteDebuggingAllowed "Microsoft 官方远程调试策略"
[H1]: https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/pyproject.toml "Harness 0.1.13 的 Python、依赖及入口"
[H2]: https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/install.md "Chrome 开关的手动前置与本地无需云 key"
[H3]: https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/helpers.py "页面 helpers 与 raw CDP"
[H4]: https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/src/browser_harness/daemon.py "Windows Edge 目录、显式端点与连接行为"
[H5]: https://github.com/browser-use/browser-harness/blob/c24e5072ee66f8499bacd663f4f4bcb089bc4492/interaction-skills/network-requests.md "固定版网络工作流文档仍是待补内容"

[A7]: https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/docs/content/docs/cdp-mode.mdx "CDP 接入会话与失败时不另启本地浏览器"

