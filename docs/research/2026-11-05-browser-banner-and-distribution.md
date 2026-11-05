# 专用浏览器提示条与发行条件研究

日期：2026-11-05。范围：讨论 MediaSail 的专用可见浏览器与 Tencent BrowserSkill 0.4.1；不改产品、不启动浏览器、不改登录数据、不构建或发布。原型版本按任务上下文为 Chrome for Testing（CfT）157.0.8103.38，使用 `--load-extension`，未设置 `--enable-automation`。

本次直接读取 Chromium 官方仓库的 **157.0.8103.38 固定标签源码**、官方文档和 Google 当前条款。以下区分源码结论、工程建议及仍需实测的项目。

## 结论

保留已经跑通的“独立可见 Chromium 内核浏览器＋BrowserSkill”技术路线。当前提示是 CfT 产品类型的说明，不能据此判断安装了 Beta。官方当前可用性表将 157.0.8103.38 列为 Stable；CfT 同时提供 Stable、Beta、Dev、Canary，是不同发布通道都能使用的测试发行变体。[官方可用性表](https://googlechromelabs.github.io/chrome-for-testing/)、[CfT 官方说明](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing)

**提示条有官方提供的隐藏方法，但隐藏成功不能直接作为正式内置发行的验收。** 157.0.8103.38 的 `--disable-infobars` 可以在可见 CfT 中过滤无操作按钮的提示条；其作用范围不是只针对 CfT 提示，BrowserSkill 调试通知也属于另一条独立路径。发行仍需确定浏览器二进制授权、更新责任与媒体功能范围。[固定版本开关逻辑](https://github.com/chromium/chromium/blob/157.0.8103.38/components/infobars/core/infobar_manager.cc#L22)、[CfT 固定版本文档](https://github.com/chromium/chromium/blob/157.0.8103.38/docs/chrome_for_testing/README.md#L42)

## 1. 三种提示不能混为一谈

| 提示类别 | 触发依据 | 对本原型的解释 |
| --- | --- | --- |
| CfT 产品说明 | 编译时启用 `CHROME_FOR_TESTING`；正常启动默认创建全局提示 | 不依赖 `--enable-automation`，所以没有该参数仍显示正常 |
| 自动化控制提示 | 启动代码检查 `--enable-automation` | 与 CfT 说明是两个独立分支；当前给定启动参数没有启用这一项 |
| 扩展调试通知 | 扩展调用 debugger API 附加调试目标 | BrowserSkill 如执行该操作，可能另行出现；去掉 CfT 说明不会改变调用来源 |

前两项来源为 [157 启动提示逻辑](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/ui/startup/infobar_utils.cc#L181)，第三项来源为 [157 debugger API 附加逻辑](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/extensions/api/debugger/debugger_api.cc#L601)。表内原型参数是任务给定事实，本次未重新启动验证。

CfT 英文资源的精确文案，把版本号代入后为：

> Chrome for Testing v157.0.8103.38 is only for automated testing. For regular browsing, use a standard version of Chrome that updates automatically.

资源键为 `IDS_CHROME_FOR_TESTING_DISCLAIMER`，旁边还有下载普通 Chrome 的链接。自动化提示使用 `IDS_CONTROLLED_BY_AUTOMATION`；扩展调试提示使用 `IDS_DEV_TOOLS_INFOBAR_LABEL`，会插入调试扩展名称。后两项分别表达自动化软件正在控制浏览器、某扩展已开始调试浏览器，不能把这三种文字归为同一个开关。[157 精确字符串资源](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/app/generated_resources.grd#L17954)、[调试文字资源引用](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/extensions/api/debugger/extension_dev_tools_infobar_delegate.cc#L83)

CfT delegate 明确设置：页面导航不令其过期，没有操作按钮，用户不能用关闭按钮移除。因而“默认不可关闭”准确；“没有任何配置办法隐藏”不准确。实际显示语言和 Windows 窗口样式本次未现场确认。[157 CfT delegate](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/ui/startup/chrome_for_testing_infobar_delegate.cc#L36)

## 2. 157.0.8103.38 的精确开关边界

1. **可见 CfT 支持 `--disable-infobars`。** `InfoBarManager::DisableInfoBars()` 在 `CHROME_FOR_TESTING` 编译条件下只检查这个开关；非 CfT 还要求 `--headless`。因此不能用“旧版本普通 Chrome 删除过这个开关”来否定该版本 CfT 的源码，也不能把 CfT 的可见模式行为直接推广给普通 Chrome 或自建 Chromium。[157 实现 L22–30](https://github.com/chromium/chromium/blob/157.0.8103.38/components/infobars/core/infobar_manager.cc#L22)、[157 开关定义](https://github.com/chromium/chromium/blob/157.0.8103.38/components/infobars/core/infobars_switches.h#L10)
2. **它过滤的是无操作按钮的提示条。** 管理器初始化读取开关；`ShouldShowInfoBar()` 保留有按钮的确认消息。CfT delegate 的按钮值为 `BUTTON_NONE`，所以会被过滤。这是针对固定版本的源码判断，本次没有执行参数实验。[157 管理器构造](https://github.com/chromium/chromium/blob/157.0.8103.38/components/infobars/core/infobar_manager.cc#L128)、[157 过滤规则](https://github.com/chromium/chromium/blob/157.0.8103.38/components/infobars/core/infobar_manager.cc#L177)、[CfT 无按钮设置](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/ui/startup/chrome_for_testing_infobar_delegate.cc#L63)
3. **扩展调试通知含取消按钮，不能承诺用上面的参数一起去掉。** debugger API 的另一个专门开关是 `--silent-debugger-extension-api`，源码还对策略安装扩展设有例外；这是改变调试披露的独立选择，不是 CfT 产品说明的设置。本研究不建议为了这次 CfT 横幅顺手加入它，也不建议为了此事写入用户全局企业策略。[157 调试通知按钮](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/extensions/api/debugger/extension_dev_tools_infobar_delegate.cc#L98)、[157 调试通知抑制条件](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/extensions/api/debugger/debugger_api.cc#L601)
4. **JSON 配置没有单独的 banner 字段。** `--chrome-for-testing-config` 的六个已公布字段控制用户引导、搜索引擎选择、虚拟剪贴板及组件准备，未提供单独关闭 CfT 提示的字段；未知字段会使配置验证失败。不能凭空添加 `disableInfobars` 配置。[157 配置及严格验证](https://github.com/chromium/chromium/blob/157.0.8103.38/docs/chrome_for_testing/chrome_for_testing_configuration.md#L26)

另有一个范围更大的条件：启动代码尊重受管理的 `CommandLineFlagSecurityWarningsEnabled` 偏好，该条件包住 CfT 和自动化启动提示。它默认显示警告，只有受管理策略才可改变；不应为了局部产品外观把该项当成普通用户设置修改。[157 启动策略条件](https://github.com/chromium/chromium/blob/157.0.8103.38/chrome/browser/ui/startup/infobar_utils.cc#L75)

## 3. CfT Stable 与正式软件发行是两个问题

Stable 表示 Chrome 发布通道，并没有把 CfT 变成带普通 Chrome 自动更新体验的消费浏览器。官方将 CfT 定位为自动化和测试，提供固定版本且不自动更新；157 源码文档还记录默认关闭普通组件自动更新、阻止注册为默认浏览器等差异。隐藏说明不改变这些行为。[CfT 官方定位与更新设计](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing)、[157 产品差异](https://github.com/chromium/chromium/blob/157.0.8103.38/docs/chrome_for_testing/README.md#L17)

这不否定 MediaSail 的专用自动化浏览器路线；它说明应用需要自己持有更新与兼容性责任，不能把“Stable”或“横幅消失”当成这些工作已经完成。此处为基于官方行为的工程判断。

## 4. 二进制再分发：不能套仓库 Apache

CfT 官方维护者在 issue #21 明确区分：仓库的 Apache 许可覆盖该仓库代码；CfT 浏览器二进制适用 Chrome 条款。提问者随后说不能分发，那是提问者的判断，不能冒充维护者给出的完整授权结论。[官方维护者答复](https://github.com/GoogleChromeLabs/chrome-for-testing/issues/21)

当前 Chrome 附加条款（页面标注 2025-09-30）明确针对可执行代码，并纳入 Google 通用条款；开源源码另依其许可证。当前通用条款（页面标注 2026-07-30）的软件章节规定个人、不可转让的许可，并限制复制、修改和分发，同时承认开源许可可能覆盖相应部分。这些材料**不能作为把整套 CfT 二进制随 MediaSail 安装包分发的明确授权依据**。确认发行条件需要定位具体产物及内含非开源组件，或取得适用的另行授权；不能只附一份 CfT 仓库 Apache 文件便放行。[Chrome 附加条款](https://www.google.com/chrome/terms/)、[Google 通用条款软件章节](https://policies.google.com/terms?hl=en#toc-software)

本次未检查原型 ZIP 内所有组件许可文件，没有对任意地区、任意合同条件作“一律允许”或“一律禁止”的法律结论。下载自官方服务器本身不证明存在随包再分发许可；改成安装时下载也仍需核对适用条款。

## 5. 官方 Chromium 与可维护的 Windows 稳定产物

| 方案 | 已有依据 | 对 MediaSail 的含义 |
| --- | --- | --- |
| CfT Stable 官方二进制 | 固定版本与各 Chrome 通道同步，无内置自动更新 | 已跑通原型可继续验证；整包发行授权与更新责任仍需确定 |
| 官方 Chromium snapshot | 官方称按尽力原则提供，来自任意修订，不一定映射用户使用的 Chrome 发布版本 | 不能把“官方 snapshot”直接叫作“官方维护的稳定版 Windows 发行” |
| 基于官方稳定版本标签或对应维护分支构建未品牌化 Chromium | 官方源码可以构建；根 BSD 许可允许按条件分发源码和二进制；需要同时遵守各依赖许可 | 如需自主随包发行，是可评估的长期路线，但必须拥有构建、补丁、签名、兼容回归和更新流程 |

来源：[官方 Chromium 下载与 snapshot 限制](https://www.chromium.org/getting-involved/download-chromium/)、[157 Chromium 根许可证](https://github.com/chromium/chromium/blob/157.0.8103.38/LICENSE)、[157 Windows 构建说明](https://github.com/chromium/chromium/blob/157.0.8103.38/docs/windows_build_instructions.md)。构建、签名和更新流程是工程建议，根 BSD 许可不代表整个产物所有依赖只有一项许可证。

“未品牌化”需要在构建期选普通 Chromium。157 的构建参数区分 `is_chrome_branded`、`is_chrome_for_testing`、`is_chrome_for_testing_branded`，公开普通 Chromium 默认不启用这些 Google 品牌或测试变体；只改应用名称或删掉图标不等同于切换发行类型。正式 Google Chrome 品牌需要 Google 内部资源。[157 构建类型定义](https://github.com/chromium/chromium/blob/157.0.8103.38/build/config/chrome_build.gni#L8)

自行构建并非一次下载 ZIP 的替换成本。官方 Windows 文档要求至少 8 GB 内存、100 GB NTFS 空间，建议更高资源；157 文档还要求 Visual Studio 2026 及对应工具链。实际耗时、制品大小和维护人力本次未测量，不估算“几小时即可完成”。正式路线应固定来源、版本、依赖及构建参数，持续跟进稳定分支安全更新；不能永远冻结当前标签。[157 Windows 前置条件](https://github.com/chromium/chromium/blob/157.0.8103.38/docs/windows_build_instructions.md#L13)

媒体与登录边界也不能忽略：

- 157 构建逻辑中，普通未品牌化桌面 Chromium 默认不启用 `proprietary_codecs`，Google CfT 品牌会启用。自行构建需单独验证目标平台的 H.264/AAC 等媒体预览、上传后回放与相关编解码能力；打开某个编译参数不等于取得专利或组件授权。[157 编解码开关默认值](https://github.com/chromium/chromium/blob/157.0.8103.38/build/config/features.gni#L23)、[157 媒体功能条件](https://github.com/chromium/chromium/blob/157.0.8103.38/media/media_options.gni#L56)、[Chrome AVC 条款](https://www.google.com/chrome/terms/)
- 普通网站登录与浏览器自身 Google 账号同步是不同功能。官方限制 Chromium 的浏览器账号登录及部分 Google API，不应因为需要保留媒体平台网站登录，便额外引入这些服务或复制 Google 内部密钥。目标网站是否正常登录、重启后是否保留会话，仍以具体产物实测为准。[Chromium API 与账号限制](https://www.chromium.org/developers/how-tos/api-keys/)

## 6. 下一步建议及未实测边界

以下是供讨论确认的后续工作，本次没有执行：

1. 保留原型技术路线。用独立临时测试资料目录，对原有启动参数仅增加官方 `--disable-infobars` 做一次对照，确认 CfT 说明消失、窗口仍可见、页面交互和 BrowserSkill 正常。随后在获准测试的站点验证关闭重开后的会话保存。源码确认支持，当前机器效果尚未实测。
2. 把 BrowserSkill 的调试通知单独验收：出现时机、取消后的连接行为、断开后的消失行为。不要承诺隐藏 CfT 提示后所有浏览器通知都消失，不自动添加静默调试开关。
3. 正式打包前确定浏览器产物方案：CfT 的具体随包许可若能明确，继续评估；若不能，评估由可追溯官方稳定分支构建、具备明确再分发条件的普通 Chromium。不要为去掉一条横幅立即改用未知第三方构建，也不要假定本轮必须更换浏览器。
4. 产品发行验收分别覆盖：浏览器与 Skill 的版本管理、下载校验与更新恢复、独立资料目录及关闭重开、工具可见范围隔离、必要媒体格式。此清单是工程建议，不是当前已经完成的能力声明。
5. 本轮只完成研究和讨论材料。没有变更启动参数、BrowserSkill、真实资料目录、安装包或版本号，也没有发布 0.5.12。

