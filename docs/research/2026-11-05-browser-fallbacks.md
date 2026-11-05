# MediaSail 的外部 Agent 浏览器备用工具调研

日期：2026-11-05（Asia/Shanghai）。范围：Windows 上接入用户已经打开、已经登录的 Edge / Chrome；只调研，不安装候选、不修改产品、不操作真实账号。结论中的「官方支持」表示文档和源码证据，不能代替 MediaSail 发行包实测。

## 结论

最小推荐是**随包提供固定版本的官方 Playwright CLI 及其 JS 依赖，以同一个官方 Playwright Extension 接入 Edge / Chrome**。需要浏览器操作时，外部 Agent 先复用自己已经连接的浏览器能力；只有缺少可用连接时，才查阅 MediaSail 提供的备用工具说明并按需引导用户安装扩展、选择浏览器/profile、批准连接。Agent 自主选择工具和执行方法，不要求所有 Agent 使用 Playwright，也不要求固定任务链。Playwright CLI 的发行版已经有显式 Chrome / Edge extension channel；不是只能在 main 分支找到的设计。[P1][P2][P3]

MCP 可以作为同一引擎的可选接入方式，但不应成为产品前提。无需同时默认打包 Chrome DevTools 和 agent-browser；用户的 Agent 已经配置这些工具时可以继续使用。备用 CLI 面向能运行本机命令的 Agent；只有远程工具、不能执行本机命令的 Agent，需要它已有的宿主连接或用户另行配置可选 MCP。复制一份 Markdown 本身不会给 Agent 增加浏览器执行能力。[P1][P4]

**运行时优先验证现有业务 Playwright 私有 `node.exe`，暂不增加另一套独立 Node。** 根线程已实测该文件可执行、版本为 `v24.21.0`，但尚未实测它运行新 CLI、CLI daemon、扩展连接和发行包路径的完整组合。复用 Electron 内置 Node 是另一项设计假设，不能写成已经成立的能力。[L1][E1][E2]

## 本次固定的上游版本

通过官方 GitHub API 和 npm registry 当日读取，不以搜索摘要的缓存版本代替发行信息。`latest` 只是 npm 当前发行标签，不表示整个依赖树都是稳定版。

| 项目 | 当前正式发布标签 / npm latest | 发行提交 | 当日 main 提交 |
| --- | --- | --- | --- |
| Playwright CLI | `v0.1.23` / `@playwright/cli@0.1.23`，2026-10-31 | `0a808078d96496cf2a8fa725143c870354f63cda` | `f50f57905b9fd3dd355330719ddf0687000c9437` |
| Playwright MCP | `v0.0.84` / `@playwright/mcp@0.0.84`，2026-10-31 | `be26c080edfae7c761db1e757c4aff9f6453b4d7` | `50b004fb3d3ee17f9710f067ed1b6d59fd16e4a1` |
| Playwright 核心稳定版 | `v1.64.1`，2026-10-14 | 以发布 tag 为准 | `1482237ae441b56b777dd128d98606fe6d26b61c` |
| Chrome DevTools MCP / CLI | `chrome-devtools-mcp-v1.12.0` / `1.12.0`，2026-10-22 | `af2834411a564d366f9cab63efb046d9084f4dba` | `0877ee00d2e43c1c04bba275e7d08cc1033e36e9` |
| agent-browser | `v0.41.2` / `0.41.2`，2026-11-03 | `d52a5e90c372ec4710c69adc3837ac14bbd852aa` | `9455ebbd0d2e0eaf1380dc75443a05350399a82e` |

CLI 0.1.23 和 MCP 0.0.84 **都锁定 `playwright` 与 `playwright-core` 的 `1.65.0-alpha-2026-10-30`**，对应 Playwright 提交 `018adb570c757898e7035f23e29ebb689d1d6ead`。因此它们虽然是已发行包，也不能宣传为「全部使用稳定 Playwright 核心」。不能随意把这两个依赖替换为现有业务 Playwright 1.63.0，或者当前稳定核心 1.64.1；应把备用工具及其依赖独立固定，现有业务包只尝试共享可执行 Node 运行时。[V1][V2][P2]

Chrome Web Store 当日显示官方 Playwright Extension **0.5.0，2026-11-02 更新**；上述 CLI 所依赖提交中的 extension manifest 是 **0.4.0**。需验证「CLI 0.1.23 + 当前商店扩展 0.5.0」，不能只依据 npm 版本号推导兼容。main 文档中新出现的 `--background` 等功能，不能当作 CLI 0.1.23 已发行能力；本建议只使用已核验的 `attach`、`snapshot`、`detach`。[X1][P3][P5]

## 候选比较

| 候选 | 已开 Chrome | 已开 Edge | 首次连接与依赖 | 本次判断 |
| --- | --- | --- | --- | --- |
| **Playwright CLI + 官方 Extension** | 官方扩展复用现有 profile；显式 `attach --extension=chrome` | 官方扩展 README 列出 Edge；源码解析 `msedge`，使用对应 Edge profile / executable；显式 `attach --extension=msedge` | 每个目标浏览器/profile 安装同一个扩展；首次批准连接和选择 tab；JS CLI 需要兼容 Node 进程，不要求另下 Chromium | **最小备用推荐**。同一组件、两种浏览器 channel，CLI 供命令型 Agent 使用。[P1][P2][P3][P6] |
| **Playwright MCP + 官方 Extension** | 支持；与 CLI 共用核心扩展连接实现 | 支持；`--extension --browser=msedge` 的 channel 解析有源码依据 | 同一扩展；Node；另需 Agent 的 MCP 配置入口 | 可选适配，不要求安装成常驻远程服务，也不必与 CLI 同时默认打包。[P4][P6] |
| **Chrome DevTools MCP `autoConnect`** | 官方支持 Chrome 144+；用户先在 `chrome://inspect/#remote-debugging` 启用并批准；无需扩展 | 官方 channel 只有 `stable/beta/dev/canary`，没有 Edge。源码允许显式 `userDataDir` 读取 `DevToolsActivePort`，因此指向 Edge 路径有协议层尝试空间，但这不是官方承诺的 Edge 自动连接 | JS 包；Node 条件见下；不需要附加浏览器便可连接已有 Chrome | 可复用用户已有配置，但不作为 Edge / Chrome 统一默认备用。**1.12.0 已有 `chrome-devtools` CLI**，不能继续称它仅支持 MCP。[C1][C2][C3][C4] |
| **agent-browser** | `--auto-connect` 官方支持 Chrome；需用户启用 remote debugging 和批准连接 | CDP endpoint 可用于支持 CDP 的浏览器；但 **v0.41.2 的 Windows 自动发现目录只有 Chrome、Chrome SxS、Chromium、Brave，没有 Edge**，当日 main 也一样。显式端点接 Edge仍需实测 | 已发行 Windows x64 Rust 原生 EXE，可直接执行；已有 CDP 浏览器无需 `agent-browser install` 下载 Chrome for Testing | 原生部署有吸引力，但不满足「无需新增发现逻辑即可同等覆盖已开 Edge / Chrome」的最小方案，不默认再打一套。[A1][A2][A3] |

「支持 CDP」与「找到当前真实浏览器会话」是不同问题。用户日常 profile 已经登录，并不代表它已经暴露 CDP endpoint。不能把启动一个新 profile、导入 cookies 或重新登录描述为接入已开浏览器。Chrome 官方对传统 `--remote-debugging-port` 启动参数还要求非默认 user data directory；这条路径不能作为无损接入原有默认 profile 的通用保证。Playwright 扩展路径通过用户安装的 `debugger` 扩展连接，省去了要求用户重新启动日常浏览器并暴露调试端口的步骤。[P3][P6][C3]

## 最小部署形态与依赖

1. **一份固定 CLI 文件及匹配 JS 依赖**：`@playwright/cli@0.1.23`、`playwright@1.65.0-alpha-2026-10-30`、`playwright-core@1.65.0-alpha-2026-10-30`，与现有 Python 业务包隔离存放。官方发行物是 JS 入口，不是独立 Windows EXE；CLI 通过 `process.execPath` 派生 daemon。不要让用户首次运行时执行 `npx ...@latest` 作为产品交付机制。[P2][P7][V1]
2. **复用已有运行时的候选**：业务 Python Playwright 私有 Node v24.21.0 的版本满足上述 Playwright/Core 声明的 Node `>=20`。CLI/MCP 顶层 package/README 虽写 `>=18`，其直接依赖实际写 `>=20`，部署应采用更严格条件。绝对路径启动私有 Node 后能否正确发现依赖、spawn daemon、在卸载/升级后继续使用，尚待验证；产品不应通过包管理器自行升级这个私有 Node。[L1][V1][V2][P7]
3. **同一个官方扩展，按浏览器/profile 安装**：官方商店 ID 为 `mmlmfjhmonkocbjadbfplnigmagldckm`。Edge 可以从 Chrome Web Store 安装；Microsoft 官方流程可能要求「允许来自其他商店的扩展」，随后确认扩展权限。扩展安装与浏览器自己的授权不能被一份复制出来的 MD 自动完成。建议随包提供官方安装入口和说明，不默认引入开发者模式加载或强制安装策略。[P3][X1][M1]
4. **不随包增加完整浏览器**：在 extension attach 路径中连接的是系统已安装浏览器，源码没有要求先安装 Playwright Chromium。用户没有可用 Edge / Chrome 时应给出明确条件提示；不要静默下载另一个 browser/profile 并称为复用。[P6]
5. **CLI launcher 可以很薄**：将随包路径、固定 Node 路径、私有工具数据目录交给一个本地命令入口；`NO_UPDATE_NOTIFIER=1` 可关闭该 CLI 自带的 npm 更新查询。源代码在 `attach/open/list/install` 等入口会尝试调用 npm 检查更新，但查询错误会被忽略；不必为了更新提示给产品增加 npm 或安装中心。实际 launcher 和目录策略属于后续实现，不在本次研究中创建。[P7]

上游命令形态示意（不是本次已经存在的 MediaSail 命令）：

```text
playwright-cli -s=mediasail-edge attach --extension=msedge
playwright-cli -s=mediasail-edge snapshot
playwright-cli -s=mediasail-edge detach

playwright-cli -s=mediasail-chrome attach --extension=chrome
```

稳定发行的部分 session-management 文档仍写 `attach --extension`；依赖提交的 CLI 源码会从 extension 字符串确定 channel 和连接目标，布尔参数不进入 targetName。故交付说明应使用上述**显式 channel**，并在后续实测中核对实际帮助输出，不照抄混杂版本的示例。[P1][P2]

Electron 运行时不能直接等同于 `node.exe`。官方确有 `ELECTRON_RUN_AS_NODE`，但受 `runAsNode` fuse 控制；Electron Node 的部分加密相关 CLI flags 与标准 Node 不同。还须验证 CLI 通过 `process.execPath` 启动子进程时的环境继承、发行后的 fuse、模块路径和 Windows 控制台行为。当前只具备「理论可以做适配」的依据，没有本产品完整运行证据；已有私有 Playwright Node 是更直接的首个验证对象。[E1][E2][P7]

Chrome DevTools MCP 1.12.0 的包声明 Node `^20.19.0 || ^22.12.0 || >=23`，JS 依赖打入发行 bundle，仍需要 Node 运行时。agent-browser 0.41.2 的 npm 安装/源码构建说明要求 Node 24+、pnpm 11+，但**直接使用官方已编译 Windows x64 EXE是另一条交付路径**：该发行资产约 18.25 MB，Rust CLI 与 daemon 不依赖 JS wrapper 来执行；不能把 npm 安装要求误写为原生 EXE 的必需运行时，也不能把原生 EXE 的存在误写为 Edge 自动接入已完成。[C1][A1][A4]

四个候选项目的官方仓库许可证均为 Apache-2.0。打包时应保留相应许可证、NOTICE（如有）和依赖的第三方声明；扩展源码的开源许可证不免除商店安装和用户授权。独立 Node / Electron 复用方案还应沿用现有发行物的第三方许可处理，不能仅留顶层工具许可证。[LIC]

## 接入与指导边界

- **已有能力先用**：已连接的宿主浏览器工具、用户自己配置的 CLI/MCP都可以完成任务。选择备用仅在当前能力缺失或不能访问所需会话时发生，不先把每个 Agent 都迁移到同一工具。
- **通用 Skill / Markdown 是指导，不是执行引擎**：说明可用命令路径、何时查帮助、连接失败时如何引导、如何读取页面证据；不要求安装某一 Agent harness 的技能，不把 `npm skills add` 当作工具本体安装。Playwright CLI 官方本身支持无 Skill 使用；真正执行的是 CLI + 运行时 + 已授权扩展。[P1]
- **按需连接**：首次让用户在要使用的 Edge / Chrome profile 中安装扩展、选对账号和 tab、批准本次连接。多个 profile 时不能仅依赖「最近使用」启发式；官方提供 `PLAYWRIGHT_MCP_PROFILE_DIR_NAME`（profile 目录名）供显式选择。[P3][P6]
- **token 是可选便捷项**：`PLAYWRIGHT_MCP_EXTENSION_TOKEN` 属于特定 profile，可绕过每次连接确认；不应写入公开或可复制 MD。默认人工授权即可工作。token 路径的源码以连接页自身作为初始受控页，不能宣称填 token 后自动拥有所有既有 tab。[P3][P5]
- **范围由真实连接决定**：扩展以 client tab group 管理连接；一个 tab 同时只属于一个 client，其他既有 tab 不会因为「已装扩展」就全部可见。断线、扩展 service worker 重启、profile 选错、用户关闭 tab、受限 URL / 其他扩展注入页面都需要可恢复提示。没有「永不掉登录」保证，也不应主动复制浏览器的认证数据。[P3][P5]

## 已验证事实与后续验收

根线程本轮已通过当前宿主 Agent 专有的 Edge 扩展连接，在同一 profile 新标签进入抖音创作者后台，无需重新扫码，可见本人信息、明确 7 日期间、账号私有概览及最新作品指标。这支持「复用真实浏览器会话」方向；**不是**官方 Playwright Extension、Chrome DevTools 或 agent-browser 的成功记录。这项专有宿主能力不能直接打包给其他 Agent。[L2]

本研究只读取官方资料、源码和发行元数据；没有安装新软件、运行候选 CLI 或接入真实账号。下列是发布决策前剩余的关键不确定性：

1. 固定 CLI 0.1.23 与商店扩展 0.5.0，在 Windows 当前稳定 Edge 和 Chrome 各自的真实已登录 profile 中是否都能完成 `attach → snapshot → 无害交互 → detach`；记录浏览器/扩展/CLI精确版本、首次权限和复连行为。
2. 已有私有 Node v24.21.0 能否在**安装后的真实路径**启动 CLI和daemon，且无需独立 npm/Node/Chromium；含空格/中文路径、无全局 Node、无网络更新查询、应用关闭后 daemon 生命周期与升级后的路径。
3. 每个 profile 的扩展安装、用户选择账号、token 可选路径、两个浏览器同时打开时的 channel 定位是否准确；连接失败不能默认转到空 profile并要求重登。
4. 用户手动切 tab、关闭受控 tab、扩展/浏览器重启和调试器冲突后的恢复；`detach` 是否保留用户浏览器与原始会话。
5. 只在这些基础能力通过后，再由获授权任务验收具体网站和功能。抖音后台的读取证据不等同于小红书、公众号、上传/发布、验证码或后续长期登录稳定性。

不需要为了验证上述边界先建设新调度器、远程命令服务、安装中心或两套浏览器专用适配层。

## 来源

- [P1] [Playwright CLI 0.1.23 README](https://github.com/microsoft/playwright-cli/blob/0a808078d96496cf2a8fa725143c870354f63cda/README.md)；[同版 session-management](https://github.com/microsoft/playwright-cli/blob/0a808078d96496cf2a8fa725143c870354f63cda/skills/playwright-cli/references/session-management.md)。
- [P2] [CLI 0.1.23 package.json](https://github.com/microsoft/playwright-cli/blob/0a808078d96496cf2a8fa725143c870354f63cda/package.json)；[实际依赖提交的 attach 参数解析](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/cli-client/program.ts)。
- [P3] [Playwright 1.64.1 官方扩展说明](https://github.com/microsoft/playwright/blob/v1.64.1/packages/extension/README.md)。
- [P4] [Playwright MCP 0.0.84 README / extension 配置](https://github.com/microsoft/playwright-mcp/blob/be26c080edfae7c761db1e757c4aff9f6453b4d7/README.md)。
- [P5] [依赖提交 extension manifest](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/extension/manifest.json)；[连接页授权和 token 处理](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/extension/src/ui/connect.tsx)；[背景连接与 tab 处理](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/extension/src/background.ts)；[main 固定提交扩展说明](https://github.com/microsoft/playwright/blob/1482237ae441b56b777dd128d98606fe6d26b61c/packages/extension/README.md)。
- [P6] [extensionContextFactory](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/mcp/extensionContextFactory.ts)；[channel / profile 解析](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/mcp/config.ts)；[扩展发现](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/utils/extension.ts)；[CDP relay 启动浏览器连接页](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/mcp/cdpRelay.ts)。
- [P7] [CLI JS 入口 / 更新查询](https://github.com/microsoft/playwright-cli/blob/0a808078d96496cf2a8fa725143c870354f63cda/playwright-cli.js)；[daemon 派生](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/packages/playwright-core/src/tools/cli-client/session.ts)。
- [V1] [npm CLI 0.1.23 元数据](https://registry.npmjs.org/@playwright%2fcli/0.1.23)；[npm Playwright alpha 元数据](https://registry.npmjs.org/playwright/1.65.0-alpha-2026-10-30)；[npm Core alpha 元数据](https://registry.npmjs.org/playwright-core/1.65.0-alpha-2026-10-30)。
- [V2] [CLI 发布](https://github.com/microsoft/playwright-cli/releases/tag/v0.1.23)；[MCP 发布](https://github.com/microsoft/playwright-mcp/releases/tag/v0.0.84)；[Playwright稳定发布](https://github.com/microsoft/playwright/releases/tag/v1.64.1)；[npm MCP 0.0.84 元数据](https://registry.npmjs.org/@playwright%2fmcp/0.0.84)。
- [X1] [官方 Playwright Extension 商店页面](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm)，当日显示 0.5.0 / 2026-11-02。
- [M1] [Microsoft：在 Edge 中添加、关闭或删除扩展](https://support.microsoft.com/en-us/edge/add-turn-off-or-remove-extensions-in-microsoft-edge)。
- [C1] [Chrome DevTools 1.12.0 发布](https://github.com/ChromeDevTools/chrome-devtools-mcp/releases/tag/chrome-devtools-mcp-v1.12.0)；[package.json](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/package.json)；[npm 元数据](https://registry.npmjs.org/chrome-devtools-mcp/1.12.0)。
- [C2] [Chrome DevTools CLI 文档](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/docs/cli.md)。
- [C3] [Chrome DevTools 连接已有 Chrome 文档](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/docs/advanced-usage.md)；[Chrome 官方 remote-debugging-port 变更](https://developer.chrome.com/blog/remote-debugging-port)。
- [C4] [发行版 BrowserManager](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/src/BrowserManager.ts)；[发行版 browser options](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/src/config/browser-options.ts)；[main 固定提交 browser options](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/0877ee00d2e43c1c04bba275e7d08cc1033e36e9/src/config/browser-options.ts)。
- [A1] [agent-browser 0.41.2 README](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/README.md)；[安装说明](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/docs/content/docs/installation.mdx)。
- [A2] [agent-browser 0.41.2 CDP文档](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/docs/content/docs/cdp-mode.mdx)。
- [A3] [发行版 auto_connect_cdp / Windows 目录枚举](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/cli/src/native/cdp/chrome.rs#L1169)；[main 固定提交同文件](https://github.com/vercel-labs/agent-browser/blob/9455ebbd0d2e0eaf1380dc75443a05350399a82e/cli/src/native/cdp/chrome.rs)。
- [A4] [agent-browser 0.41.2 发布资产](https://github.com/vercel-labs/agent-browser/releases/tag/v0.41.2)；[JS wrapper](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/bin/agent-browser.js)；[postinstall](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/scripts/postinstall.js)。
- [E1] [Electron 官方环境变量：ELECTRON_RUN_AS_NODE](https://www.electronjs.org/docs/latest/api/environment-variables/)。
- [E2] [Electron 官方 fuses：runAsNode](https://www.electronjs.org/docs/latest/tutorial/fuses)。
- [LIC] 固定提交的许可证：[Playwright CLI](https://github.com/microsoft/playwright-cli/blob/0a808078d96496cf2a8fa725143c870354f63cda/LICENSE)、[Playwright MCP](https://github.com/microsoft/playwright-mcp/blob/be26c080edfae7c761db1e757c4aff9f6453b4d7/LICENSE)、[Playwright / Extension](https://github.com/microsoft/playwright/blob/018adb570c757898e7035f23e29ebb689d1d6ead/LICENSE)、[Chrome DevTools](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/af2834411a564d366f9cab63efb046d9084f4dba/LICENSE)、[agent-browser](https://github.com/vercel-labs/agent-browser/blob/d52a5e90c372ec4710c69adc3837ac14bbd852aa/LICENSE)。
- [L1] 根线程 2026-11-05 本机只读检查反馈：`build/runtime-business/python/cpython-3.11.15-windows-x86_64-none/Lib/site-packages/playwright/driver/node.exe --version` 为 `v24.21.0`；文件 93,580,104 字节。这里只证明现有文件与版本，不证明新工具集成。
- [L2] 根线程 2026-11-05 实时宿主 Edge 会话检查反馈：同profile进入抖音创作者后台，无需重扫码，读取本人/期间/账号与作品私有指标；本研究未重复操作账号。
