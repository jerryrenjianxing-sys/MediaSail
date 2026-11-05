# 软件自带专用 Chromium：技术可行性审查

日期：2026-11-05（Asia/Shanghai）。按项目指定的 mattpocock research 方法审查官方文档、固定 BrowserSkill 源码和已有静态材料。本轮未下载新的候选包、未安装或运行候选、未连接账号，未修改产品或用户环境；仅新增本研究文档。文档读取成功与源码存在均不构成运行验收。

## 决议建议

**有条件支持“可见专用浏览器 + 独立持久配置 + 随包 BrowserSkill”的方向；建议进入隔离实测，暂缓认定可随 0.5.12 内置发行。** 扩展加载和独立配置有官方机制依据；尚未选定具有发行依据、编解码能力和补丁维护路径的具体浏览器构建，也未验证真实平台登录与首次启动体验。这些是产品成立的条件，不是打包时再补的细节。

推荐的产品构建路线是：**完整、非 Google Chrome 品牌、基于受支持 stable patch 源码 tag 的 Win64 Chromium**；自己构建或向可提供对应源码、构建配置、许可材料与补丁维护的供应方取得。此为设计建议，并非本轮已经找到或验证某个合格二进制。若团队不承担这条构建和更新责任，当前应暂缓专用浏览器内置，不能用任意 snapshot 或 Chrome for Testing（CfT）ZIP 填补发行缺口。[官方 release tag 构建方法](https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/)、[Chromium Windows 构建说明](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md)

外部 Agent 已有合适连接时直接复用；内置 BrowserSkill 是备用执行入口，不应成为所有研究、创作或取数的固定流程。此边界沿用 [项目兼容约定](../DEVELOPMENT.md#兼容约定)。

## 证据等级

| 等级 | 本文含义 |
| --- | --- |
| 已证实（文档/静态） | 一手文档或被读取的源码明确描述该机制；仅限所引版本和条件。 |
| 设计判断 | 从已证实机制推导的集成方向或建议；不代表上游认证 MediaSail。 |
| 待实测 | 必须在选定二进制、Windows 环境和目标账号上观察；本轮没有执行。 |

此前 [BrowserSkill 接入复核](2026-11-05-browserskill-managed-chromium.md) 中的“技术上可以内置”应按**机制层可集成**理解，不能作为浏览器选型、登录兼容或发行通过证明。此前真实 Edge 中的抖音后台读取只证明当时那套工具与会话，不能移作本方案验收。[原实测边界](2026-11-05-browser-capabilities.md)

## 浏览器分发构建怎么选

| 候选来源 | 官方已确认的性质 | 本轮判断 |
| --- | --- | --- |
| Google 存储中的 Chromium snapshot | 官方称 best-effort、来自任意 revision，不一定对应正式 Chrome release；Chromium 不自动更新。 | 可以作为机制排查样本；不能只写“官方 Chromium”便选作发行包，更不能用 `LAST_CHANGE` 浮动下载。尚未核到本产品可交付候选。[官方说明](https://www.chromium.org/getting-involved/download-chromium/) |
| CfT 的完整 `chrome` | 与 Chrome release 流程同步、可选固定版本、无自动更新；官方定位自动化与测试，并要求仅访问可信内容。 | 可作后续隔离兼容对照；**本轮不批准随产品再分发**，也不把测试定位当作长期日常浏览承诺。[官方定位](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing) |
| Playwright 附带的完整 Chromium | 官方明确它是开源 Chromium，通常领先品牌浏览器 stable；官方另指出 Chromium 不包含 Chrome/Edge 的全部媒体 codecs。 | 版本可锁仍不足以满足本产品 stable、视频与发行材料要求；不能因现有 Python 已用 Playwright 就直接复用其缓存目录。[Playwright 官方说明](https://playwright.dev/docs/browsers#chromium)、[媒体差异](https://playwright.dev/docs/browsers#media-codecs) |
| stable patch tag 的非品牌完整 Chromium | 上游支持按正式版本 tag 同步源码及匹配 DEPS 后构建。Chromium 主许可证允许带条件的二进制再分发。 | **推荐产品候选路线**，但需承担编译/供应链、第三方材料、codecs 与补丁维护；这些条件未满足前无可批准的确切包。[release 构建](https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/)、[主许可证](https://chromium.googlesource.com/chromium/src/+/main/LICENSE) |

CfT 的关键许可边界已有官方答复：维护者 Mathias Bynens 在 #21 明确，仓库中的 Apache-2.0 只覆盖仓库代码，CfT 二进制遵循 Google Chrome 条款。不能把 GitHub 许可证标签、下载接口或可以下载等同于商业软件随包再分发许可。该 issue 中“不能再分发”的最终评论来自提问者，**不是维护者的法律结论**；本文结论是发行依据尚未取得，而非宣判所有情形均禁止。[官方维护者原答复](https://github.com/GoogleChromeLabs/chrome-for-testing/issues/21)、[当前 Chrome 二进制附加条款](https://www.google.com/chrome/terms/)

必须先为唯一候选填齐以下记录，再进入运行验证；本轮这些记录中的浏览器项尚为空：

- 浏览器完整版本、release tag/commit、Windows 架构、供应方与不可变下载地址、压缩包和可执行文件 SHA-256、签名状态。
- 自构建的完整 GN 参数、DEPS/工具链版本和补丁；其中是否为非品牌、是否保留扩展能力、FFmpeg/codecs 配置必须明确。`is_official_build` 之类构建参数不表示 Google 对该产物背书。
- 同一候选的许可与第三方声明、媒体组件发行依据、资源/图标来源；保留与该版本对应的材料，而非只放一个 Chromium 根 LICENSE。
- 组件维护者、浏览器安全补丁的交付方式和时限、升级回滚及 profile 兼容验证方案。锁版本是可复现手段，不能等同于永久冻结浏览器。

## MV3、debugger 与扩展预载

**已证实（静态）：** BrowserSkill 固定为 CLI/ext 0.4.1，commit `b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5`。扩展配置要求 Chrome ≥125，并声明 `debugger`、`offscreen`、`scripting`、`tabs`、`storage` 等权限及 `<all_urls>`。CLI 与扩展协议均为 1.8。最低版本是 API 下限，不是建议选用旧版 Chrome 125。[扩展配置](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/wxt.config.ts)、[CLI 协议](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/state.rs#L20)、[扩展协议](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/transport/handshake.ts#L11)

**已证实（机制）：** Chrome 团队明确，Chrome 137 移除 `--load-extension` 针对品牌 Chrome，Chromium/CfT 保留该机制。预期做法是产品启动完整 Chromium，并把已解压扩展目录交给该机制；用户不必按商店、开发者模式、手选目录的一串操作来配置。但这仍需精确候选的首次启动实测。[官方公告](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ)

**不是无条件支持：** 当前 Chromium `main` 的 `ExtensionService::LoadExtensionsFromCommandLineFlag` 仍会在增强保护启用，或 `ExtensionInstallTypeBlocklist` 的 `command_line` 限制生效时忽略 `--load-extension`。这是当前源码机制，不是本轮已选浏览器的行为；选择固定 tag 后必须重新核对。不能只引用 2025 年公告就承诺所有构建和用户策略下必定加载，也不应靠关闭保护来假装通过。[官方当前源码](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/extension_service.cc#413)

Windows 上品牌 Chrome 的注册表“外部安装”是另一套机制：官方要求商店来源，用户仍会收到启用确认。它不构成本方案静默预载的依据；不应为此去改用户日常 Chrome/Edge 的注册表或企业策略。[官方外部安装说明](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)

`chrome.debugger` 在 MV3 下有官方 API；权限会显示宽范围警告，API 也不开放全部 CDP 域。用户打开被控制页的 DevTools 会触发调试会话断开。MV3 worker 虽有生命周期限制，Chrome 116 起 WebSocket 消息、118 起活动 debugger session 可以延长存活。这些资料只说明兼容条件，**不能证明 BrowserSkill 在待机、断网或后台恢复后持续可用**；必要提示、用户取消和重连都要实测，不承诺“安装后再无任何授权”。[debugger API 与断开](https://developer.chrome.com/docs/extensions/reference/api/debugger)、[权限警告](https://developer.chrome.com/docs/extensions/reference/permissions-list#debugger)、[worker 生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

扩展不带固定 manifest key 不会自动阻断 BrowserSkill 的本地握手，详见既有固定源码复核；但 Chromium 的无 key 扩展 ID 可由路径产生。若随版本改解压路径，扩展 ID、存储和 BrowserSkill instance 身份不能假定延续。先选稳定扩展目录并验升级；只有需求确实要求跨路径固定 ID 时再评估产品自有 key，不把加 key 当作首连必需补丁。[ID 生成源码](https://chromium.googlesource.com/chromium/src/+/main/extensions/common/extension.cc)、[路径散列](https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/id_util.cc#70)、[manifest key 官方说明](https://developer.chrome.com/docs/extensions/reference/manifest/key)

## 视频与网页登录兼容

**已证实（文档）：** Chromium 官方媒体表把 AAC、H.264/AVC 放在限 Google Chrome 的专有 codecs 下；默认 `proprietary_codecs=false`。`ffmpeg_branding` 与 `proprietary_codecs` 是不同构建控制项，其中后者还影响浏览器对 `canPlayType()` 的能力声明。MP4 是容器，支持 MP4 不等于能解码其中的 H.264/AAC，也不能只改能力声明便宣布视频可用。[官方媒体支持及构建配置](https://www.chromium.org/audio-video/)

**设计判断：** 本产品需要分别验视频上传的字节传输、网页本地预览/取时长/截帧、已发布作品播放和有声验证。上传字节不必由浏览器重新编码，因此不能仅凭缺少 decoder 断言所有上传都会失败；相反，也不能用一次上传进度完成证明整个发布页可用。给自构建 Chromium 启用有关参数只解决技术配置，不自动取得 codecs 的专利或分发授权；所选产物及其发行材料仍需确认。[Chromium 官方媒体说明](https://www.chromium.org/audio-video/)、[Chrome 的 AVC 条款边界](https://www.google.com/chrome/terms/)

**已证实（机制）：** `--user-data-dir` 可指定独立目录，目录包含 cookies 等 profile 状态；浏览器数据目录与其中 `Default` profile 不是同一层。将其放在随软件版本替换之外的产品私有持久位置，有依据支持重启后继续使用本浏览器留下的网页登录状态。[官方 user-data-dir 说明](https://chromium.googlesource.com/chromium/src/+/main/docs/user_data_dir.md)

**待实测：** 浏览器 profile 持久化不保证平台永不要求登录。当前未取得抖音等目标平台对“这个确切 Chromium 构建 + BrowserSkill”认证的官方证据。官方 Chrome DevTools MCP 文档也明确，某些账号可能阻止在 WebDriver 控制的浏览器中登录；本方案走扩展而非那个默认 WebDriver 路径，故既不能用该说明断言本方案一定失败，也不能承诺所有平台都能登录。[Chrome 团队原说明](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#connecting-to-a-running-chrome-instance)

用户应在可见专用浏览器的原生平台页面完成首次扫码/登录及平台必要验证。后续分别验证主站、创作者后台、账号权限、跨域跳转、弹窗/验证码、关闭重开及正常过期重登。平台账号身份须从页面取证；profile 名或 BrowserSkill instance 不是平台账号。此为验收建议，尚未执行。

## 发布前必须先验证的门槛

以下均为**待执行验收**，本轮没有一项可标为运行通过。先确定唯一候选，再经用户授权在隔离环境实测，不能先改产品或发版后补证据。

| 优先级 | 阻断项与最小验收 | 需要留下的证据 |
| --- | --- | --- |
| P1 | **具体分发包未定。** 唯一完整浏览器产物有固定版本/来源/哈希；非品牌完整扩展运行时、所需媒体能力及对应发行材料齐全。CfT 不得以仓库 Apache 标签代替二进制依据。 | 组件清单、浏览器来源和构建记录、许可/第三方材料、补丁负责人。 |
| P1 | **首次启动与可控性。** 干净受支持 Windows 中，启动可见浏览器、使用正确私有 profile、加载扩展、接到正确 daemon、完成 1.8 握手，并完成页面快照和一次可逆交互。记录全部真实提示；含中文/空格路径。 | 精确版本/哈希、启动参数、profile 路径、扩展 ID/版本、daemon 实例、握手及界面录证。仅看到进程或扩展图标不算通过。 |
| P1 | **目标平台登录与视频能力。** 先覆盖抖音主站、创作者后台和现有发布页；各正式支持平台各验一个实际账号。首次登录后重启保持会话；常用 H.264+AAC MP4 在目标页面能加载、看到画面并听到声音，上传预检/预览可完成。涉及其他 codec 再增对应样本。 | 账号/页面/时间、成功或被拒提示、实际媒体格式、播放和预览证据；`canPlayType` 仅作诊断。发布页验收停在用户点击发布之前。 |
| P1 | **正确实例和升级连续性。** 用户另有 BrowserSkill、默认端口占用、重复启动时不连错；更新浏览器/CLI/扩展后沿用登录、扩展身份和必要状态。 | 冲突和升级前后实例/账号/profile 对照；失败明确可恢复，不以空状态作成功。`BSK_HOME` 不能代替端口隔离。 |
| P2 | **断开、退出和回滚。** worker 休眠、网络中断、DevTools 抢占、用户停止控制后能解释状态并恢复；退出只管理本产品进程；旧浏览器不得未经验证直接重开升级后的 profile。 | 故障恢复、退出进程树、升级/回滚记录与保留用户数据的结果。 |
| P2 | **维护与发行完整性。** 浏览器、CLI、扩展不能各自漂移更新；安装/卸载保留约定的数据，随包声明与实际文件匹配。 | 固定三件套和匹配协议、依赖清单、安装/升级证据；开发检查通过不能替代这项。 |

BrowserSkill 顶层 MIT 允许带声明分发，但不覆盖浏览器、媒体专利或所有依赖。Chromium 主许可证要求二进制随附版权/许可/免责声明且不得暗示背书；官方依赖文档单独管理 shipped 第三方许可，并用 `licenses.py` 生成 credits。因此最终发行须从**实际选定产物**核对材料，不能只复用上游仓库首页许可证。[BrowserSkill MIT](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/LICENSE)、[Chromium 主许可](https://chromium.googlesource.com/chromium/src/+/main/LICENSE)、[第三方及 credits 机制](https://chromium.googlesource.com/chromium/src/+/main/docs/adding_to_third_party.md#license)

## 审查结论

当前支持的是**进入受控验证的设计方向**，不是对某个现成 Chromium ZIP 的发行批准。扩展机制成立；可发行构建与媒体能力、首次体验、真实平台登录、正确实例/升级连续性仍是 P1 门槛。通过这些门槛后再决定内置与 0.5.12 发行；若具体构建的来源、许可材料或媒体能力无法闭环，保持暂缓。资料和源码只提供下一步试验依据，不能替代这些运行结果。
