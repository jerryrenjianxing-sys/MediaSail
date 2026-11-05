# MediaSail 浏览器工具重新选型

日期：2026-11-05（Asia/Shanghai）。用户叫停扩展商店安装方案后要求“重新选”。本轮采用 matt research 方法，核对官方文档、固定源码与发行元数据；**没有安装、运行新候选、开启调试、连接浏览器或修改用户环境**。本文件是选型建议，不是发行验收记录，不覆盖既有历史研究。

## 推荐结果

取消把 BrowserSkill 的扩展安装作为默认接入路径。先验证 **agent-browser 0.41.2 的现有浏览器 CDP 连接**，把 **sbroenne/mcp-windows 的 wincli** 留作无需浏览器扩展或调试端口的窗口操作、可见内容读取备选。两者按能力分工，不能把一次失败自动转成另一工具重新提交。

该建议基于安装成本和业务数据能力的取舍：agent-browser 有可直接分发的原生 Windows EXE，适合网页结构和网络数据；wincli 从 Windows UI Automation 读取用户已经打开的真实窗口，准备成本低，但不等价于 DOM/网络取数。[A1][A2][W1][W2]

**先说清人工步骤：** 不装扩展不代表无须浏览器授权。Chrome 官方要求先开启当前实例的原生调试，并在请求调试会话时批准；Edge 官方也有对应原生入口。Agent 可准备命令、定位浏览器和请求连接，不能承诺替用户完成全部安全授权，更不能通过更换工具绕过宿主 Agent 的限制。[C1][E1]

如果产品要求连原生调试开关也不涉及，应把 wincli 的可见内容路线先作为独立可行性门槛；必须接受没有网页内部响应、未显示字段等能力，不能宣传与完整采集等价。[W1][W2][M1]

## 固定候选与门槛

| 位置 | 固定来源 | 能提供什么 | 尚需解决的前置 |
| --- | --- | --- | --- |
| 优先验证 | Vercel agent-browser `0.41.2`，`d52a5e90c372ec4710c69adc3837ac14bbd852aa`，Apache-2.0 | 现有浏览器 CDP、快照、交互、截图与网络能力；官方 Windows x64 EXE 18,248,192 字节（17.40 MiB） | 原生调试与连接授权；其 Windows 自动发现不含 Edge，需要小范围的实际目录端点发现与实例核验；未通过本机 Edge/Chrome 连接验收。[A1][A2][A3] |
| 第二候选 | sbroenne/mcp-windows 源码 `v1.3.28`，`655b9fc92d03ad52a270067c6844ea1231c90559`，MIT；使用其 `wincli` 项目 | 命令行调用，无须配置 MCP；读取/操作已开 Edge/Chrome 的可访问控件、文字、截图；不安装浏览器扩展、不要求 CDP | **官方 Release ZIP 只含 MCP server，不含 wincli**，需我们固定源码自行构建完整自带运行时输出；CLI 大小尚未知。项目 TFM 为 `net10.0-windows10.0.22621.0`，不能只凭 README 的 Windows 10/11 就承诺最低系统兼容。中文系统、浏览器页面树、共享桌面、用户配置识别均须实测。[W1][W2][W3][W4] |

agent-browser 既有候选文件的下载来源与 SHA-256 已在上一轮核对，只有 `--version`/`--help` 通过，不是浏览器连接通过。本轮不重复把它写成四组合已通过。先测一套候选的完整准备与业务读取，再决定是否增加第二套发行负担。

## 为什么不把其他候选直接升为默认

| 项目 | 本轮核到的阻碍 |
| --- | --- |
| BrowserSkill / Playwriter / Browser MCP / OpenCLI 等扩展路线 | 仍存在首次扩展安装/启用/授权步骤。BrowserSkill 本身没有被证明不能用；本次停止点是当前 Codex 工具拒绝操作商店。不能把这一个拒绝扩大成所有扩展商店、所有 Agent 都不能安装，也不能换个扩展名称便宣称解决。[H1] |
| Browser Harness 0.1.13 | 无扩展，但仍基于 CDP，并没有消除原生调试授权；还要固定 Python 依赖，不能解决本次最关键的准备流程问题。[H2] |
| Chrome DevTools MCP / 新 CLI | 官方支持现有会话，Edge 官方也有配置。可复用 Agent 已有配置；但增加 Node/依赖闭包，原生调试授权同样存在，不为了名字有“官方”就默认额外内置。[C1][E1][H2] |
| Vercel agent-desktop 1.2.0 | 官方网页明确把网页自动化交给 agent-browser；Chromium/Electron 网页内容路线会导向 CDP。不能因为它有小体积原生程序，就当作现有网页登录和网页取数的零准备替代。[D1] |
| k4cper-g/agent-ctrl 0.1.4 | 官方 README 明确将浏览器自动化列为范围外，并推荐 agent-browser；不据原生桌面能力推导网页支持。[D2] |
| CursorTouch/Windows-MCP 0.8.8 | 有 UIA/浏览器内容视图，但当前要求 Python 3.14+、以 MCP 服务为入口；相比已有 Python 3.11 需要额外运行环境，未核到等价的直接页面操作 CLI，不作为最小默认包。[D3] |
| Microsoft WinApp CLI 0.7.1 | 有 `winapp ui`，但定位是应用开发工具且为 Public Preview，x64 ZIP 99,013,508 字节；不为浏览器取数默认带入整套开发工具。[D4] |
| deploymenttheory/windows-mcp-server 1.4.0 | 有较小的 Go 原生发行包，但主要能力以 MCP tools 服务，不是已经核实的等价页面动作 CLI；不先补一层自有常驻调度/适配服务来满足选择。[D5] |
| DSH-computer-use / windows2text 等薄 UIA 脚本 | 可以继续观察。前者为系统 PowerShell 脚本、后者有 .NET Framework 读取器；这不是网页内部数据能力的证据。本轮未证明它们在目标平台页面和生命周期上的可靠性，不因“零依赖”而直接发行。[D6][D7] |

## 后续可行性验收顺序

1. **完整准备流程**：从无扩展、无现成连接开始，列出 Agent 实际完成的步骤和浏览器必须人工确认的步骤，区分每个新调试会话与首次设置。不得用重建空白资料、复制 Cookie 或更换默认浏览器配置代替。
2. **正确实例**：Edge 和 Chrome 同时打开时，明确选择浏览器及用户配置；只读取所选实例的本地发现文件并验证身份，不能用“发现了一个 Chrome”代替正确账号。
3. **业务读取**：抖音真实已登录创作者后台，只读取概览、作品列表及所需证据；记录实际覆盖范围和缺项；页面点击成功不等于数据齐全或已保存。
4. **保存闭环**：沿用现有观测 CLI/HTTP、画像和内容库；实际取得时间、账号依据、指标口径、缺项和证据随数据保存。失败只补保存，不盲目重抓或重放已提交操作。
5. **免调试补位**：如验证 wincli，先构建固定源码、测实际大小和最低系统，再检验现有 Chrome/Edge 可访问树及可见指标。网站导出功能可提供额外数据，但不承诺每个平台都有，也不把 UIA 读表模式当成所有网页表格都支持。
6. **产品集成**：只有候选连接/取数门槛通过后才更新正式 Spec、实现缓存部署与会话支持、修改业务 Skill、打包及安装升级验收。本轮不发布安装包。

外部 Agent 已有合适工具时仍直接复用。自己的工具说明只说明位置、调用与事实边界，不增加固定业务执行链或每轮自检；个人 Skill 元数据保留 `allow_implicit_invocation: false`。

## 一手来源

- [A1] [agent-browser 0.41.2 原生发行](https://github.com/vercel-labs/agent-browser/releases/tag/v0.41.2)，[固定版 README](https://github.com/vercel-labs/agent-browser/blob/v0.41.2/README.md)。
- [A2] [官方 CDP mode](https://agent-browser.dev/cdp-mode)，[固定版取数与网络命令](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/docs/content/docs/commands.mdx)。
- [A3] [固定版 Windows CDP 目录发现](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/native/cdp/chrome.rs)。
- [C1] [Chrome 官方：连接当前浏览器会话及授权](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)。
- [E1] [Microsoft Edge 官方：原生 inspect 开关与 auto-connect](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server)。旧命令行调试参数与默认资料目录的边界，见独立 [CDP 复核](2026-11-05-reselection-cdp.md)；不以旧命令行示例替代原生开关路线。
- [W1] [wincli 固定版命令行说明](https://github.com/sbroenne/mcp-windows/blob/v1.3.28/src/Sbroenne.WindowsMcp.Cli/README.md)。
- [W2] [固定版浏览器与可访问内容能力](https://github.com/sbroenne/mcp-windows/blob/v1.3.28/FEATURES.md)。
- [W3] [1.3.28 Release 明确 ZIP 不含 CLI](https://github.com/sbroenne/mcp-windows/releases/tag/v1.3.28)。
- [W4] [固定版 CLI 项目/目标框架](https://github.com/sbroenne/mcp-windows/blob/v1.3.28/src/Sbroenne.WindowsMcp.Cli/Sbroenne.WindowsMcp.Cli.csproj)。
- [M1] [Microsoft UI Automation 概览](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview)。
- [H1] [此前候选研究](2026-11-05-builtin-browser-shortlist.md)；本机商店操作拒绝为当前会话实测记录，并非上游承诺。
- [H2] [本轮 CDP 独立复核](2026-11-05-reselection-cdp.md)，[此前 Harness 依赖与连接研究](2026-11-05-browser-alternatives.md)。
- [D1] [agent-desktop 官方定位与网页边界](https://agent-browser.dev/desktop)，[1.2.0 发行](https://github.com/vercel-labs/agent-desktop/releases/tag/v1.2.0)。
- [D2] [agent-ctrl 官方范围](https://github.com/k4cper-g/agent-ctrl)。
- [D3] [CursorTouch Windows-MCP 官方说明](https://github.com/CursorTouch/Windows-MCP)。
- [D4] [Microsoft WinApp CLI 官方范围/预览状态](https://github.com/microsoft/winappCli)，[0.7.1 发行](https://github.com/microsoft/winappCli/releases/tag/v0.7.1)。
- [D5] [deploymenttheory Windows MCP Server](https://github.com/deploymenttheory/windows-mcp-server)。
- [D6] [DSH-computer-use](https://github.com/rayadesune/DSH-computer-use)。
- [D7] [windows2text](https://github.com/ArronHC/windows2text)。

只读来源快照存于本机构建区 `.test-data/browser-reselection/`，未进入发行产物。上述工具自身的可用性也不代表调用它的 Agent 宿主必然允许相关操作；不设计用于绕过宿主限制的替代路径。
