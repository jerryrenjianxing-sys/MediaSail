# 浏览器协作与本地回存

需要查看账号、作品、运营后台或准备浏览器连接时查本页。已有工具及连接可直接复用；业务取数和回存不绑定某个工具。普通接入、阅读画像或本地计算不必启动浏览器。

## 缺少浏览器能力时

软件提供可见的专用 Chromium 与 BrowserSkill 0.4.1 MediaSail 适配构建。浏览器、扩展、私有 daemon 和连接自动配置，无需商店安装或调试设置。它使用当前资料库的独立网站配置，首次网站登录由用户扫码等正常完成，后续沿用；平台要求重新验证时再提示。不导入个人 Edge/Chrome 或其他库的 Cookie。

发现文件中的 `browserTools` 提供可选入口、工具/浏览器版本、发行清单及本页位置。未提供时说明该安装没有此组件；不要把工具缺失当成软件业务连接失败。入口兼容 Windows PowerShell 5.1，无需全局 Node/Python，软件关闭也能使用。

```powershell
# <数据目录> 来自最新发现资料。查询与准备均不会启动浏览器。
& '<Skill目录>\scripts\mediasail.ps1' browser status --data-dir '<数据目录>'
& '<Skill目录>\scripts\mediasail.ps1' browser prepare --data-dir '<数据目录>'

# 按任务需要连接；--url 可省略，只允许 HTTP(S)。保存完整回执供本任务使用。
$connection = & '<Skill目录>\scripts\mediasail.ps1' browser connect --data-dir '<数据目录>' --name '账号研究' --url 'https://creator.douyin.com/creator-micro/home' | ConvertFrom-Json
if (!$connection.ok) { throw $connection.error }

# 后续使用回执的固定缓存入口和原库组配置，即使软件更新、切库也不改投别处。
& $connection.entry run --group-config $connection.groupConfig --session-ref $connection.sessionRef '--' observe
& $connection.entry run --group-config $connection.groupConfig --session-ref $connection.sessionRef '--' --help
& $connection.entry disconnect --group-config $connection.groupConfig --session-ref $connection.sessionRef
```

`disconnect` 只结束本任务连接，保留浏览器和登录配置。`run` 转交 BrowserSkill 原生命令，自动带本会话编号；命令参数见 `--help` 或子命令 `--help`。CLI 输出 JSON，失败退出非零。工具内的协作上下文、页面引用和动作校验按其当前回执使用：人操作后先 `cooperate sync` 阅读现场；需要 context/observation 时使用本次回执，不沿用旧页面引用。结果不明先检查现场，不重放操作。

固定组配置含本地连接信息，只供该任务使用，不放进 MD、报告或公开附件。公开发现文件不包含这些凭据。新连接从最新发现资料定位库；旧 `sessionRef` 继续属于原库，不自动改账号或资料库。

## 连接状态与恢复

- 工具已连接、网站已登录、创作者后台有权限是三件事。看到真实后台身份及页面响应后再说明可访问范围。
- `prepare/status` 不启动浏览器。`connect` 才准备和启动。端口占用或身份不匹配会明确失败，不接管其他程序。重复准备复用完整缓存；校验失败保留文件和错误，别直接运行损坏组件。
- 断线或原浏览器关闭时 `run` 报错，不启动另一份。先检查状态/现场，再按任务显式连接；不切换账号或重做结果不明的提交。
- 软件退出、更新或切库不会终止本工具组；运行中的浏览器继续使用原版本。正常关闭后新连接才启用新版。工具不并发打开同一个登录配置，不静默降级；升级浏览器前备份并校验配置，失败保留原件。
- 工具缓存位于 `runtime/cache/browser-tool/`，网站配置、组、会话及日志位于 `runtime/browser/`。首版不自动清理这些目录。PowerShell 5.1 的路径长度有限，若明确提示路径过长，选择较短的资料库位置；不移动或删除原库。
- 不修改其他 Agent 的全局配置，也不运行 BrowserSkill 原版的 Skill 安装或自行升级。组件更新由 MediaSail 发行维护。

## 取数、证据与回存

根据任务自主选择页面、可访问响应和已有资料；信息不完整时可继续补查适用来源，无需等用户再说“抓一下”。保存实际取得时间、平台、账号编号依据、指标标签/单位/窗口/范围、缺项及证据位置。未知项保留为空，真实零保留 0。公开主页、创作者后台和内容管理页口径可能不同，作品样本数不等于账号累计作品数。

原始摘录、截图和报告放当前项目，按[账号观测](account-observations.md)登记结构化资料，再用现有成品登记进入内容库；稳定经验按任务回存六维画像。观测、报告和画像分别核对回执，保存失败只补保存，不重新取数。结论指向证据，区分观察事实、推断和未知原因。更多范围判断见[采集缺项与有据分析](collection-evidence.md)。

软件暂停、更新或 HTTP 暂不可用时，保留原库证据、输入与成果；恢复后核对原库身份，再补登记。刷新软件只重读保存内容，不校验浏览器在线。

旧原生采集工具仍是可选入口，使用自己独立的登录资料，主动使用时才需要它的登录。专用 Chromium 或个人浏览器的 Cookie 不自动复制给它；外部观测不会把旧 whoami 改为已验证。
