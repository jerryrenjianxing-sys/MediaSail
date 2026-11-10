# MediaSail 开发交接

交接日期：2026-11-10（Asia/Singapore）。本文件用于新电脑、新会话中的 Agent 接手开发；产品使用接入仍从软件首页复制 `MediaSail 接入.md`。两份文档用途不同。

## 接手起点

- 仓库：[MediaSail](https://github.com/jerryrenjianxing-sys/MediaSail)。本次核对时 `main` 为 `2bd6a2f065acaf197a0dcc7a0701dba73865cb96`；本交接提交在其后，只修改文档。
- 已完成的最近任务为 **0.5.13**，已正式发布，非待发行候选。不要重新执行历史计划或重复发布；下一步由用户的新任务决定。
- [正式发行与全部资产](https://github.com/jerryrenjianxing-sys/MediaSail/releases/tag/v0.5.13)、[需求](https://github.com/jerryrenjianxing-sys/MediaSail/blob/main/docs/SPEC-0.5.13.md)、[验证结果及边界](https://github.com/jerryrenjianxing-sys/MediaSail/blob/main/docs/VERIFICATION-0.5.13.md)、[两轴审查](https://github.com/jerryrenjianxing-sys/MediaSail/blob/main/docs/REVIEW-0.5.13.md)是该任务的依据，不在这里复制整套计划。
- 发行标签 `v0.5.13` 指向 `f7b49435fc31a1ad6747d3c6333d1c9e29d4d2b6`；后续主分支补充证据和本交接文档，没有重打该安装包。
- 实施前重新核对远端分支、最新正式 Release 和本地工作区，以上是交接时快照，不保证以后仍为最新版。

## 新电脑如何接手

### 继续源码开发

1. 在独立开发目录克隆仓库，读取根目录 `AGENTS.md`、`docs/DEVELOPMENT.md` 和 `GLOSSARY.md`。公开克隆无需发布凭据；推送与发行需要新电脑自己的 GitHub 登录和仓库权限。
2. 按任务读取对应规范、代码和验证记录。旧电脑的绝对路径、测试浏览器会话和聊天上下文均不是开发前置条件。
3. **源码检查环境**以 `.github/workflows/check.yml` 的准备步骤和锁文件为准：准备固定 Easel 基线及补丁、Node、业务 Python、前端依赖和 BrowserSkill 源码夹具，再执行 `npm run check`。依赖准备与检查分开；克隆后直接运行检查可能因缺少依赖失败。
4. **完整 Windows 安装包**另需浏览器载荷和构建材料。先读 `integrations/browserskill/README.md`，核对 `browser-tools.lock.json`；按说明准备 `build/browser-tools`，再使用 `scripts/build.ps1`。它遇到缺失载荷会明确停止，不能把源码检查通过视为安装包已可构建。
5. Git 不包含 `vendor/`、`build/`、`node_modules/` 和私有验收资料。固定上游由脚本获取并应用 `patches/easel-desktop.patch`；匹配发行源码、BrowserSkill 改编材料和 Chromium 对应源码分卷从该 Release 获取并按清单校验。需要重建浏览器工具时按集成说明准备编译器；本次没有承诺不同机器的重编译天然逐字节相同。
6. 在隔离资料库执行改动对应的验证。涉及发行时，再执行包内、实际宿主及真实安装升级验收，按原草稿资产核验流程发布。用户日常安装和资料库保持原状。

完成接手的标准：能定位当前实现、复现相关检查、明确缺失环境及新任务范围。只有读完本文，不等于构建环境、平台登录或发布权限已经就绪。

### 换机前仍需落实的构建与发行准备

- **环境清单**：完整发行使用 Windows x64；准备 Git、uv、引导用 Python 和构建用 Node，版本读取锁文件及 CI。产品连接入口须兼容 Windows PowerShell 5.1，开发脚本的 PowerShell 环境按各入口要求准备。重编 BrowserSkill 还需集成说明中的 Rust、LLVM-MinGW、CMake/Ninja、pnpm；普通源码检查不等于已准备这些工具。matt 插件和 GitHub 身份也需在新环境确认可用。
- **恢复程度**：已完成 GitHub Windows 源码检查及真实安装验收；未完成“全新电脑仅凭此交接，从零准备所有依赖并构建全部发行资产”的演练。当前 GitHub Actions 也不是完整的一键编译发布流水线。新机成功打包及核验前，保留旧开发机的构建材料和私有备份。
- **源码材料组装**：`scripts/browser-source-kit.py` 仍接受本地 `--audit-root`、`--crate-sources`，并读取不随发行公开的本机路径映射 `audit-local-input-map.json`。新机需根据 Release 的相对材料清单、实际文件位置和校验值重新建立输入布局/映射；不能直接照抄旧机绝对路径，也不能把旧验证结论冒充新机执行结果。详细材料说明见 `docs/research/2026-11-05-browser-candidate-license-audit.md` 及 Browser Sources ZIP 内的 README。此项目前仍需准备工作，不是交接文档已自动解决的能力。
- **验收与发行参数**：`.github/workflows/verify-maintenance-upgrade.yml` 保留历史默认版本；执行时明确传入真实基线、候选版本，以及需要时的 `managed_browser=true`。候选验收要求 Release 仍为草稿；先核验资产、再验收、再正式发布。后续核对发布后更新发现。流程与既往结果从上面的验证记录进入。
- **签名与材料版本**：当前安装包没有 Windows 代码签名，换机时不存在可直接继承的签名证书。正式 Release 的源码 ZIP 是该次发行快照，本交接等后续文档在 GitHub `main`；不能把旧 ZIP 当作当前分支全部内容。构建输出位置读取 `package.json`，不依赖旧机器目录布局。

### 在新电脑使用软件或继续个人业务

- 仅使用软件：安装 Release 中的 Windows x64 Setup，无需下载巨大浏览器源码分卷。首次启动选择资料库；从首页重新复制 MD，让 Agent 得到新电脑的发现入口。
- 沿用旧内容：画像、项目、素材、分析和用户自定义方法都在**用户选定资料库**，不在 GitHub。先停止相关写入并正常关闭使用该库的程序和浏览器，以私有渠道备份/复制完整资料库，再在新电脑打开已有有效库；保留原件并核对内容。
- 跨电脑资料复制是另一项操作，**本次没有执行或验收**。旧位置和新位置可能不同，接手时核对实际路径；网站登录能否继续有效需在新机验证，可能需要重新登录。
- 命名管道凭据、进程号、浏览器回执、发现文件及旧 MD 中的路径属于旧机运行状态。由新机软件生成新的连接信息，不把旧连接当作仍在线。
- 用户资料、Cookie、账号信息、API Key、私有日志、GitHub 凭据和个人偏好不进入公开交接。个人内容生成/最终发布等偏好从用户当前指令及私有画像读取，不把单个用户要求硬编码为全体用户规则。

## 按任务查资料

| 任务 | 先读位置 |
| --- | --- |
| 理解产品和安装、资料库行为 | `README.md`、`docs/DEVELOPMENT.md`、`GLOSSARY.md` |
| Agent 接入、任务指导与业务调用 | `agent-skill/mediasail/SKILL.md` 及其按需索引；简短 MD 生成位于 `bridge/agent_skill.py` |
| 浏览器启动、WorkBuddy 兼容、代理重复键 | `desktop/browser-connector.cjs`、`desktop/main.cjs`、`desktop/agent-connection.cjs`；`agent-skill/mediasail/scripts/browser*.ps1` 和 `browser-native.cs` |
| 浏览器分发、构建和许可 | `browser-tools.lock.json`、`integrations/browserskill/README.md`、`licenses/browser-tools/`、Release 浏览器源码材料 |
| 账号观测、旧工具抽屉、报告预览、中文接口 | 先复现固定 Easel 补丁，再看 `vendor/easel/web/` 的对应实现；发行修改原件为 `patches/easel-desktop.patch`，不是临时安装目录 |
| 回归当前修复 | `tests/browser-connector.test.cjs`、`tests/browser-native.test.cjs`、`scripts/verify-observation-ui.cjs`、`scripts/verify-report-jump-ui.cjs`；其余按需求和测试目录查阅 |
| 安装、活会话覆盖与更新发现 | `docs/UPDATES.md`、`docs/VERIFICATION-0.5.13.md`、`.github/workflows/verify-maintenance-upgrade.yml`、`scripts/verify-content-upgrade-ci.cjs`、`scripts/verify-managed-browser-ci.cjs` |
| 打包、源码与资产核验 | `package.json`、`scripts/build.ps1`、`scripts/verify-payload.cjs`、`scripts/source-bundle.py`、`scripts/browser-source-kit.py`、`scripts/verify-release.cjs` |

## 容易再次误判的地方

- 软件已连接、工具可用、浏览器已连接、网站已登录是不同状态。新建内置浏览器连接由运行中的桌面进程负责；已有会话、本地文件阅读及离线计算的条件见产品 Skill。旧采集工具的登录资料与专用浏览器独立。
- 外部 Agent 已有能力可直接复用；产品方法按任务查阅，不增加每轮固定执行链。扫码或本人授权在具体需要时请求用户参与。
- 活会话升级验收要继续使用**原回执**，重连成功不能证明旧会话连续。不要通过清除真实宿主代理或更改其进程限制来取得“通过”。历史版本验收夹具与实际 WorkBuddy 证据的区别已记录在验证文档。
- 上次已验证 WorkBuddy/Codex 只读取数、证据、观测及报告回存，没有验证真实公开发布。系统 DPI 未逐档修改，页面测试记录的是应用渲染缩放；安装耗时也不是完整网络下载测速。
- 源码统一检查、可见页面验收、真实安装验收是不同结果。最近验证为历史证据，新机器或新版本仍按改动范围验证；不宣称软件不存在任何未发现问题。
- 旧 `0.5.1` 草稿是历史候选，保留即可。当前方案已经替代此前扩展商店、个人 Edge/Chrome 原生调试、agent-browser 双浏览器等候选；研究文件保留不代表这些方案仍须实现。
- 更新安装包的大文件传输辅助脚本只帮助发行，不改变用户更新源或客户端差量策略。浏览器分发继续提供相应源码及许可；不能只凭根目录许可证删掉组件义务。

## Suggested skills（建议技能）

项目使用用户指定的 **mattpocock-skills 插件**。接手 Agent 按当前任务调用可用 Skill 工具；若环境没有 Skill 工具，先读取所安装插件相应 `SKILL.md`，不要假称已调用。具体约定集中在 `docs/DEVELOPMENT.md`。

- 故障复现与根因：`mattpocock-skills:diagnosing-bugs`。
- 重要行为修复：`mattpocock-skills:tdd`；复用已确认的测试边界，逐项红绿验证。
- 模块设计或业务概念：`mattpocock-skills:codebase-design`、`mattpocock-skills:domain-modeling`。
- 接入说明与 Skill：`mattpocock-skills:writing-for-agents`。
- 交付前 Standards/Spec 审查：`mattpocock-skills:code-review`，明确比较基线和需求来源。
- 再次交接时：用户明确调用的个人 `handoff` 技能。个人技能仅在明确选择时使用，安装或更新保留 `policy.allow_implicit_invocation: false`；插件技能沿用自身元数据。

## 当前下一步

本次只交付公开开发交接，不新增软件版本、不搬运私人资料。新 Agent 先核对仓库及上述完成状态，然后承接用户下一条任务；若用户要迁移业务资料或搭建完整发行机，再分别完成对应准备。
