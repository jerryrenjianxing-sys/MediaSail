# 专用 Chromium / BrowserSkill 生命周期审查

日期：2026-11-05。范围：自带可见 Chromium、BrowserSkill CLI/ext 0.4.1、资料库内持久浏览器配置、外部 Agent 独立调用。只阅读本仓库与官方源码；未安装、启动或连接候选，未改产品代码或用户配置。本文的建议不是已完成实现或运行验收。

**判断：可以继续做小范围集成，但生命周期必须先定。** “MediaSail 帮忙启动浏览器”不能推导为“MediaSail 拥有全部浏览器任务”。退出、切库、应用升级都应允许外部 Agent 的既有浏览器任务继续使用原版本。首版需要一层集中处理启动、身份发现和版本选择的 Module，复用上游 CLI/session 能力；不需要自建任务调度、浏览器 RPC 或 MCP。

## 1. 本仓库的实际行为与适用范围

| 证据 | 当前实际行为 | 对提案的约束 |
| --- | --- | --- |
| [main.cjs](../../desktop/main.cjs#L89)、[runtime.cjs](../../desktop/runtime.cjs#L50) | 切库只查询 MediaSail 服务的 `active`，随后停止 supervisor；退出、启动重试、安装更新也会停止它。 | 这不是当前产品的 BrowserSkill bug，因为尚无该集成；但直接把新浏览器放进现有 supervisor 会与独立 Agent 的目标冲突。外部浏览器 session 不会自动计入此 `active`。 |
| [supervisor.py](../../bridge/supervisor.py#L1) | supervisor 将自身放入带 `KILL_ON_JOB_CLOSE` 的 Windows Job；收到 shutdown/EOF 时直接退出，连同其后代一起终止。 | 不把需要继续执行的浏览器/daemon 放在这棵进程树里，也不要为了接入浏览器放宽现有业务进程树的清理规则。 |
| [agent-connection.cjs](../../desktop/agent-connection.cjs#L12) | 当前发现文件标识 Electron 实例、资料库、服务和工具环境；stop 会清空 `baseUrl`。环境输出采用白名单，没有 BSK 变量。 | 应单独表达 browser 可用状态和固定工具入口。应用已退出不等于独立浏览器已退出；新增 `BSK_HOME` 等也不会凭空传播给外部 Agent。 |
| [library.cjs](../../desktop/library.cjs#L150) | 切库只提交选择，不复制、移动、删除旧库。有效资料库有稳定 `libraryId`。 | 继续沿用。旧库中的 profile、连接资料和正在运行的浏览器保留；已有 Agent 继续使用它原先绑定的库。 |
| [workspace.cjs](../../desktop/workspace.cjs#L25) | 现有同步按分发基线保留用户改动与冲突备份，并可能替换/删除未改的受管文件。 | 不把浏览器 profile 放入受管工作区清单，也不把运行中的扩展目录交给这套文件级覆盖。它不提供浏览器升级事务。 |
| [main.cjs](../../desktop/main.cjs#L215)、[installer-cache.cjs](../../desktop/installer-cache.cjs#L7)、[installer.nsh](../../scripts/installer.nsh#L119) | 安装包基线放在资料库 update-cache；安装器在 bootstrap 暂存后按 SHA-256 接纳。升级需要旧程序正常卸载，失败会中止/恢复登记。 | 当前机制能保护自己的安装包，不会自动解决新增长驻 Chromium/daemon 的程序目录占用。浏览器资产若直接从安装目录长期运行，需要另定升级位置与清理规则。 |

上表是静态可确认的现有行为；未发现“当前已经丢失 BrowserSkill 状态”等运行事实，不能把未来集成缺口写成已复现缺陷。

## 2. 扩展 ID 必须与不可变目录一起设计

BrowserSkill 原版 manifest 没有 `key`；Chromium 在没有 manifest public key 时从扩展路径计算 ID。把扩展解压到 `extension/<sha256>/`，每次内容指纹变化就会改变路径，因而可能改变扩展 ID。daemon 接受任意形状正确的扩展 Origin，只能证明新 ID 能握手，不能证明它能继续读旧扩展状态。[BrowserSkill manifest](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/wxt.config.ts)、[Chromium ID 计算](https://chromium.googlesource.com/chromium/src/+/main/extensions/common/extension.cc)、[manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)

扩展自己的持久 `instance_id`、label、开关、端口都来自 `chrome.storage.local`；Chrome 的该存储按扩展身份隔离。新 ID 会看到另一份状态，可能产生新 browser instance ID 并回到默认端口/开关。这不等于同一 Chromium profile 的所有网站 Cookie 都丢失；应分别验收扩展身份和网站登录态。[BrowserSkill instance-id.ts](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/lib/instance-id.ts)、[Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage)

**建议固定产品自有 manifest public key**，首发即记录预期扩展 ID。指纹目录继续保留，以便完整校验、并存旧文件和延后清理；manifest key 让目录变化不再承担身份变化。不要在运行中改写已加载的扩展文件，不在同一 profile 同时加载新旧两份相同 ID 的扩展。只有完成旧任务并关闭该浏览器后，才让它下次启动选择新目录。固定 key 是状态连续性的选择，不代表 Origin 是可靠的本机权限认证。产品适配后的包应有独立 build 标识和完整哈希，不冒充未经修改的官方 ZIP。

若坚持原版 ZIP 不改 manifest，就必须固定跨版本、跨应用安装目录的扩展绝对路径；这会牺牲不可变指纹目录的便利，而且资料库路径变更仍要重新验收。两者不能含糊地同时承诺。

## 3. Profile 不是可任意回退的缓存

Chromium user-data-dir 包含各 profile、Cookie 和全局 Local State；只备份 `Default` 不等于完整保全专用浏览器配置。同一 user-data-dir 也不能交给两个独立浏览器实例同时写入。[官方目录说明](https://chromium.googlesource.com/chromium/src/+/main/docs/user_data_dir.md)

Chromium 对旧数据升级有兼容目标，对新数据降级只能尽力读取：不兼容的用户数据会保留但功能可能降级，计算缓存可被丢弃重建。因此应用安装包回滚不等于 profile 可以随 Chromium 一起回滚。[官方存储策略](https://chromium.googlesource.com/chromium/src/+/main/docs/user_data_storage.md)

最小做法：

- 每库固定一个专用 user-data-dir，另存已准入的 Chromium 完整版本/资产指纹。复用现有运行实例，不因新窗口请求而启动另一个版本写同一目录。
- 新版本只在该库浏览器关闭后准入；跨 major 升级前预检空间并可保存一份关闭状态下的完整快照。浏览器仍开着时文件复制不能标成一致备份。
- 一旦新 Chromium 已打开此 profile，旧应用不得静默用较旧 Chromium 再打开它。可以继续使用已准入的新浏览器资产，或明确阻止此次启动并提供用户选择的恢复；不要删除版本标记、自动清空 profile 或用空目录冒充恢复。
- profile 快照只用于本机可恢复性，不承诺跨机器/Windows 用户复制后所有登录和加密凭据仍有效，也不承诺不会触发平台重新验证。

这里是必须规定的兼容策略，尚无候选上的升级/降级实测。

## 4. 退出、断开与升级的所有权

上游已经实现 Windows daemon 后台启动：隐藏标准句柄，使用 detached/new process group/breakaway，挂起后核实确已脱离 Job，再恢复执行；禁止 breakaway 时明确报错。这优于再写一个常驻守护调度器，但也说明在任意受限制宿主内启动都能独立存活尚不能承诺。[固定 Windows 启动源码](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/start/windows.rs)

更关键的是，**上游断线会结束 session**：后台将 transport 的 beforeDisconnect/onDisconnected 都接到清理；清理逐一执行正常 stop，归还借用的标签页、清理引用、detach CDP、关闭 Agent Window。重启 daemon、变更连接端点或加载新扩展都不能写成“Agent 无感继续”。[后台挂接](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/entrypoints/background.ts)、[断线清理](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/session-manager/disconnect-cleanup.ts)

建议的默认行为：

| 事件 | 默认行为 |
| --- | --- |
| 关 MediaSail 窗口 / 退出应用 | 窗口沿用托盘规则；应用退出只断开自己的观察，不停止独立 browser/daemon，不对其执行 stop-all。 |
| 切到另一资料库 | 更新当前库发现入口，旧库浏览器/任务继续留在旧库；新 Agent 明确选新库，新 profile 不接管旧 session。 |
| MediaSail 更新 | 应用可更新；仍在工作的浏览器、CLI、daemon、扩展继续使用已核验旧组合。新组合暂存，下次有条件启动时再切换。 |
| 用户明确停止浏览器工具 | 告知会影响哪些库/session，再对已核实归属的实例请求上游安全 stop；不能按 chrome.exe/bsk.exe 名称扫杀。 |
| 崩溃、系统注销、用户关浏览器 | 不承诺延续 session；保留文件与错误原因，下一次调用重新发现/建立 session。 |

CLI 默认 session idle 是 5 分钟；daemon idle 是 10 分钟，但仍有已连接浏览器或 live session 时 daemon 不因 idle 退出。长时间思考或等用户期间的 session 行为必须明确，不能把“当前没有 tool RPC”当成 Agent 不再需要会话。可显式选用较长有限 session timeout，并保留上游忙碌保护；不用 MediaSail 自造心跳来假装 Agent 仍工作。[默认值和参数](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/cli/daemon.rs)、[idle/reaper](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/start.rs)

## 5. 端口、BSK_HOME 与发现不能各自决定

`BSK_HOME` 分隔 daemon 元数据、lock 与 IPC；Windows pipe 名包含用户名与 home 路径的哈希。它不分隔 TCP 52800。默认 local WS 监听 loopback，同一 Windows 机器上其他用户/其他库的进程仍可能占同一端口。两份不同 BSK_HOME 的 daemon 并不能同时占 52800。[paths.rs](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/paths.rs)、[daemon 配置](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/start.rs)

最小首版可采用**每个 Windows 用户一个产品专用 daemon/home 和产品端口，多资料库各自保有浏览器 profile**，让上游负责多个 browser/session。这样切库无需切换 daemon，也无需引入跨库任务调度。外部调用必须绑定库对应的 browser instance ID；不靠“列表第一个”或可重复的显示 label。若产品选择每库一个 daemon，也成立，但必须同时实现每库端口绑定/扩展引导，不能仅分隔 home。

原扩展的本地连接端口来自 storage 偏好，未设置时才使用 build-time default。随意先 `freePort()` 再启动 daemon，不会让扩展知道该端口。固定产品端口遇占用时，首版可明确报错而不误连；若要自动改端口，需有受限的扩展偏好初始化方式，并在有 session 时禁止改接，不直接编辑 Chromium 的 LevelDB。[端口解析](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/transport/daemon-endpoint.ts)、[连接偏好](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/src/lib/daemon-connection-preference.ts)

另一个静态可确认的陷阱：business CLI 找不到 daemon 时用 `StartArgs::default()` 自动启动，会回到默认端口和 idle 参数。采用自有端口以后，应由固定产品入口显式启动/发现 daemon，并给实际 CLI 设置 `BSK_AUTO_START=0`；否则 daemon 退出后的下一次普通命令会破坏端口约定。这是设计可推导的失败路径，尚未在产品复现。[ensure_daemon.rs](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/cli/ensure_daemon.rs)

发现资料最少包含：`libraryId`、profile 绝对路径、产品固定调用入口、实际 CLI/Chromium/扩展指纹、BSK_HOME、daemon 端口、预期扩展 ID、观察到的 browser instance ID、连接状态。它是位置说明，不能作为存活证明。复用上游 IPC probe 的 metadata/实际 status/PID 一致性检查，再比对版本与 browser 身份；仅 PID 存活、端口开放或旧 JSON 存在均不足。[官方 probe](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/probe.rs)、[browser list](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/cli/browsers.rs)

`agent-connection.json` 继续说明当前 MediaSail 库/服务；另以每库固定浏览器发现文件表达独立 browser 生命周期。应用退出只撤销应用自己的状态，不能顺手抹去仍可用的浏览器入口。不要把工具凭据、Cookie 或桌面控制 token 放到这些公开发现资料中。

## 6. CLI、daemon、扩展要锁成一组

固定 0.4.1 / commit `b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5`，协议为 1.8；上游允许一定跨版本协议兼容，还会在 status 报 version skew，因此“握手成功”不是产品认证整组版本的替代。记录 Chromium 版本、CLI SHA、扩展完整目录 hash、协议、产品适配 build；使用工具完整路径，不经全局 PATH 发现用户自装的 `bsk`。[协议与状态](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/state.rs)、[status 信息](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/ipc.rs)

产品入口对所有 CLI/daemon 进程固定 `BSK_AUTO_UPDATE=off`。现有 daemon 版本与新产品包不一致时保留旧组合处理旧任务，延后切换，不能借 repair/retry 偷偷 restart。用户自装 bsk 的 home、进程、Skill 和更新设置都不应被产品接管。

**还需要一个明确的产品构建适配：禁止 daemon 启动时自动同步用户 Skill。** 0.4.1 启动直接异步调用 `sync_installed_skills(home)`，此调用和同步函数没有受 `BSK_AUTO_UPDATE` 或独立禁同步开关保护。具体资格：目标 `SKILL.md` 与来源 marker 都不存在才完全跳过、不新装；已有 bundle 可更新或恢复未完成事务；受信旧版/内容恰等于当前 bundle 的无 marker 安装可能被写入新的来源元数据；custom 标记跳过，未知或本地修改暂停，但在判断前会尝试 lock。因此不能简化为“只读检查已安装 Skill”。[启动调用](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/start.rs#L601)、[资格与写入](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/skill_install/sync.rs#L103)

只设 BSK_HOME 不影响这条 Skill 路径；其 home 使用 `dirs::home_dir()`，锁定 dirs 5.0.1 的 Windows 实现调用 Known Folder，不应假定全局改 HOME/USERPROFILE 就能可靠隔离。建议产品构建直接不调该后台同步，保留手动 Skill 安装命令供用户另行授权；用小范围源码适配解决一个确定副作用，不为此重写用户主目录。[harness home](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/skill_install/harness.rs)、[锁定依赖](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/Cargo.lock)、[dirs 5.0.1 Windows 源码](https://docs.rs/crate/dirs/5.0.1/source/src/win.rs)

## 7. Windows 文件占用、空间与清理

运行中的 EXE/DLL 映射可阻止删除或覆盖；Electron 退出不能解除另一个仍运行 Chromium/daemon 的占用。不能用“等待主程序结束”保证旧程序目录可完整删除。[Microsoft 可执行映射说明](https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/executable-images)

建议浏览器/CLI 的运行资产从经过核验的分发包部署到**程序安装目录之外、产品拥有的不可变指纹目录**。可放资料库 runtime 下，或产品用户级 cache；profile 固定在所属资料库。资产部署采用临时目录、完整清单/hash 校验后提交，失败保留旧可用版本；运行期间不原地覆盖。若使用用户级共享 cache，它只是可恢复的二进制来源，不能把 profile 一并搬过去或在清理 cache 时删除。

空间预算应至少分别显示安装包/解压资产、运行中旧资产、新候选、profile、profile 快照、浏览器磁盘缓存、下载/录屏与审计文件。新资产+快照+更新包会同时存在，不能仅按 Chromium 下载大小估算峰值；此次未测量候选实际占用，不给虚假 MB 数值。

清理沿用现有缓存“确认产品归属和具体文件”的原则，另定浏览器规则：

- 活跃 profile、仍被进程使用的资产和未能确定归属的目录一律跳过；不能按目录年龄或“不是当前 app 版本”删除。
- 只清 manifest 登记的产品资产；检查绝对路径仍在专用根内并拒绝链接/重解析点。无法删除就记录并下次重试，不为清空间杀 Agent。
- profile 的 Cache/GPUCache 与 Cookie、Local State、Extension State、IndexedDB 属不同数据；不对 user-data-dir 做整目录通用清缓存。首版可把 profile 清理做成用户明确执行的动作。
- 快照保留策略需固定，例如仅留一次已完成升级的前态，展示占用并允许用户删除；没有成功写完的标记不得被当作可恢复快照。不要每次启动都复制完整 profile。
- 原有 update-cache 的 `installer.exe/current.blockmap` 仍是差量更新基线；不为新增 Chromium 缓存统一扫除。现有 upgrade-backups/history-archive 也不能被顺带清理。

## 8. 本地控制入口的承诺范围

保持 local WS 只在 `127.0.0.1`，不开放远程调试端口、不启用 allow-any-origin、不为了自动接入暴露无保护 HTTP 执行入口。原版 Origin gate 接受任意符合格式的扩展 ID，且该格式不是秘密；同机原生程序可以构造请求。因此 loopback、BSK_HOME、固定扩展 ID 分别提供位置/命名/身份稳定性，不能包装成对同 Windows 用户恶意程序的权限隔离。[WS gate](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/ws.rs)

Windows IPC 使用 named pipe；该版源码未显式设置产品 ACL/调用者认证。专用 home/profile 目录应确认当前用户权限，跨 Windows 用户是否可访问需单独验证，不能仅因 pipe 名含用户哈希就承诺跨用户安全。维持可信本机用户工具的最小范围即可；远程控制、强多用户隔离不在此次内置方案的承诺内。[Windows IPC](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/crates/bsk-cli/src/daemon/ipc.rs)

## 9. 先固定的决策与验收

必须先固定：①扩展 public key/预期 ID；②daemon 是用户级还是库级及端口引导；③CLI/daemon/ext/Chromium 整组版本和旧任务继续使用旧组合；④退出/切库只断开应用观察；⑤profile 禁止静默降级与快照策略；⑥运行资产不受应用卸载牵连；⑦禁掉上游启动 Skill 同步；⑧发现文件的身份检查与公开字段。只需一个本地启动/发现 Module 加很小的上游产品构建适配，工具执行仍交给原 CLI 和外部 Agent。

后续隔离 Windows 验收应覆盖：新建 profile 一次加载；扩展目录指纹改变后 ID/instance/设置保持；专用浏览器关开保留登录；用户自装 bsk 占 52800；产品端口被其他程序占用；旧库任务跨切库、MediaSail 退出与更新继续；新旧版本候选同时落盘时不抢旧进程；profile 升级后旧应用拒绝危险降级；更新磁盘不足/文件占用时保留可用组合；用户 Skill 文件在启动前后零变化。它们均未在本次只读审查执行。

不可承诺：任意 Windows Job 宿主都能后台脱离；daemon/扩展/browser 断线后原 session 不受影响；所有网站登录永久有效；跨机器/用户复制 profile 保留凭据；任意浏览器版本 profile 可双向回退；固定端口永不冲突；未经过实测即可整包自动更新且无感续跑。

## P1 / P2 简单清单

- **P1：** 不能沿用 supervisor 生命周期拥有外部 Agent 的浏览器；退出、切库、升级不得隐式 stop/restart。静态设计阻断项，未复现产品故障。
- **P1：** 指纹目录+无 manifest key 会改变扩展身份；首发即固定 ID，升级整组延后切换。上游机制已确认，具体状态丢失未实测。
- **P1：** 自有端口必须同时解决扩展偏好和 CLI 默认自启；BSK_HOME 隔离不解决 52800 冲突。上游行为已确认。
- **P1：** 产品构建禁用 daemon 启动自动 Skill 同步；`BSK_AUTO_UPDATE=off` 不覆盖该写入路径。源码已确认，未触发用户文件写入。
- **P1：** 浏览器运行资产避开应用卸载目录；profile 禁止静默降级，未准备完的候选不替换原组合。静态兼容风险。
- **P2：** 单独发现 browser 身份、明确 idle/session 结束原因；预算缓存/快照峰值并仅清理已确认无占用的产品资产；补充跨用户端口/权限验收。待实现与隔离验证。
