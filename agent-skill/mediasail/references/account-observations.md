# 账号观测：登记、查询与回存

用于已经从真实浏览器、已有工具或可靠材料取得数据，想让 MediaSail 工作台读取的任务。旧采集工具接口仍是可选的联网动作；本页接口只操作本地观测。

## 记录的位置和含义

当前工作区 `outputs/_analytics/observations/<observationId>.json` 每条一份记录。`GET /api/account-observations` 可用 `platform`、`accountId`、`source` 查询；`GET /api/account-observations/{observation_id}` 读取完整记录。`fetched_at` 是实际取得时间的 Unix 秒，`importedAt` 是登记时间，晚导入的旧材料不会成为最新取得结果。

输入至少提供 `platform`、实际业务 `source` 和 `fetched_at`。`accountId`、`profile` 可以未知；昵称不能代替稳定账号。数值缺失为 null，确实为零则保存 0；粉丝指数单独用 followerIndex。保留原 `metrics`、`notes`、`collection` 结构，后者的缺项、问题和范围按实际取得情况填写。来源以具体页面或业务口径区分，例如 douyin-creator-home。

`notes` 指作品列表，不是文字备注。每项为作品对象，例如 `{"title":"示例作品","url":"https://example.invalid/work/1","stat":"播放 12"}`；title、url、cover、stat 若提供需为文字。未读取作品时用 `notes: []`。普通采集说明可放 `extensions.acquisitionNotes` 字符串列表，缺项和异常放 collection；不要为备注编造作品。422 会指出无效字段，保留输入、修正后只补保存即可。

其他业务字段（如顶层 views）会保存在 `extensions` 并在回执 warnings 中列出，仍参与编号哈希和同编号冲突核对。可直接把扩展放在 extensions；同名扩展值矛盾时拒绝保存，不替你选择。页面概览只展示约定字段，其他指标需要展示时放入带 label/value/口径的 metrics。根 producer 记录为 external-agent；另行提交的工具来源保留在 extensions.producer，不作为浏览器登录成功声明。导入时间、哈希与增长结果由软件计算。

建议提供 `libraryId`（当前发现信息中的资料库身份）、`identityEvidence`、`metricDefinitions`、`evidenceRefs` 和 `reportPaths`。账号身份依据可保存实际账号编号出处、可访问的账号链接或项目内摘录；证据和报告引用可用 `outputs/<项目>/...` 相对路径或来源 URL。页面提供内容库内相对路径的报告入口，不会复制任意外部文件。

`identityEvidence`、`evidenceRefs`、`reportPaths` 都是列表，不能提交成单个对象。例如身份依据为 `[{"kind":"platform-id","value":"test-account","sourceUrl":"https://creator.douyin.com/creator-micro/home"}]`；这里的 kind/value/sourceUrl 是一种可读记录形式，也可直接提供有来源的文字摘录。identityEvidence 说明“这个稳定编号从哪里取得”，本身不表示软件在线验证过账号。没有依据时用空列表，仍可回存，但不计算跨记录增长。证据或报告带说明的形式为 `[{"path":"outputs/账号研究/报告.md","description":"本次账号研究报告"}]`。

`metricDefinitions` 按字段记录 label、unit、window、scope，例如 followers 的“粉丝数/count/lifetime/account”；累计、近七日和当前筛选范围不混用。增长沿用原有窗口及减法公式，先确认同平台、稳定账号及身份依据、同业务来源和一致字段口径；缺少依据、历史或存在坏记录时给出 growthReason。外部观测与旧 `<platform>.jsonl` 分开比较，登记不验证浏览器当前是否在线。

## 可执行的合成例子

下面只演示接口，样本为虚构数据。实际任务使用真正取得时间、账号、数值和证据。`$info` 来自最新发现入口；把输入文件与报告保存在同一项目。

```powershell
$project = Join-Path $info.workspace 'outputs/账号研究示例'
[IO.Directory]::CreateDirectory((Join-Path $project 'assets')) | Out-Null
$inputFile = Join-Path $project 'assets/观测.json'
$sample = @{
  libraryId = $info.libraryId
  platform = 'douyin'; source = 'douyin-creator-home'
  fetched_at = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  accountId = $null; nickname = '合成账号'; followers = 12; likes = 0; posts = $null
  metrics = @(); notes = @()
  collection = @{status='partial'; missingFields=@('posts'); issues=@(@{field='posts'; code='not_observed'; message='示例未读取作品页'})}
  evidenceRefs = @('outputs/账号研究示例/assets/来源摘录.md')
  reportPaths = @('outputs/账号研究示例/报告.md')
}
[IO.File]::WriteAllText($inputFile, ($sample | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
& (Join-Path $info.skillDir 'scripts/mediasail.ps1') observations --data-dir $info.dataDir register --file $inputFile
& (Join-Path $info.skillDir 'scripts/mediasail.ps1') observations --data-dir $info.dataDir list --platform douyin
# 用回执的 observationId 读取：
# & (Join-Path $info.skillDir 'scripts/mediasail.ps1') observations --data-dir $info.dataDir show <observationId>
```

CLI 与 HTTP 共用实现，CLI 在桌面服务关闭时仍可读写当前库。原始命令为 `python skills/shared/scripts/account_observations.py register --file <JSON>`，另有 list/show；用连接资料的工作区作为 EASEL_ROOT。辅助脚本会重新读取发现信息，在线时核对服务实例，离线时使用当前库路径。

HTTP 登记同一份 JSON：

```powershell
$body = [IO.File]::ReadAllBytes($inputFile)
$response = Invoke-WebRequest ($info.baseUrl + '/api/account-observations') -UseBasicParsing -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
$receipt = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
$receipt | Select-Object observationId, path, duplicate, warnings
```

成功回执含编号、物理路径、libraryId、duplicate 和警告；观测登记与报告登记是两件事。报告完成后用现有 manifest.py meta 的 --category analysis、--deliverables 等参数登记，详见[素材与成品](outputs.md)，软件刷新后可见。

## 失败与重试

未给 observationId 时，由规范化输入生成稳定 SHA-256 编号。相同编号同内容复用回执；不同内容返回 HTTP 409/observation_conflict，原件保留。新增取数结果可省略编号形成新记录，不覆盖旧证据。

422 表示输入无效；409/library_mismatch 表示发往了另一资料库；503 表示读取、写入、锁或磁盘问题。损坏记录会报告 observation_unreadable 并保留文件；列表仍列出其他有效记录和错误清单。CLI 失败退出为 1，输出 JSON 原因。服务暂不可用、回执未知或磁盘失败时保留输入，以原编号向同库核对并重试登记，不自动重新取数。软件与 CLI 的跨进程锁协调它们自己的写入；任意外部编辑器不共享该锁。

切库或软件更新后，发现入口反映当前库。已在原库开展的任务保留原 libraryId、证据与文件，向原库登记或等原库重新打开；不要把任务的旧输入无意投到新库。缺账号身份或缺项可以继续形成报告，不需要为了保存先补齐全部数据。
