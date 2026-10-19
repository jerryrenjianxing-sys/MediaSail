# 画像、分析与经验

先从当前任务需要的背景入手，不必把所有画像和历史聊天读一遍。多画像时，可用用户提到的账号、品牌或平台判断；分不清时再问。画像提供方向，也允许探索和修订。

## 找到资料

连接信息中的 workspace 是可写工作目录。画像在 profiles/<名称>/：

| 文件 | 内容 |
| --- | --- |
| identity.md | 身份、定位、账号目标 |
| audience.md | 受众与需求 |
| style.md | 表达方式、内容风格 |
| platforms.md | 平台策略 |
| preferences.md | 创作偏好 |
| memory.md | 经验、反馈和长期记忆 |

还可存在用户自定义 Markdown 文件。GET /api/personas 返回画像列表；GET /api/persona/{name} 返回合并文本；GET /api/persona/{name}/files 返回分文件正文及 revision。revision 是文件原始字节的 SHA-256，缺少的维度为 missing；读写 API 的画像名用 URL 编码。

更新某一维度：
PUT /api/persona/{name}/file
JSON：{"filename":"memory.md","content":"完整的新文件正文","revision":"刚读取的 revision"}
成功保留 ok、filename，并返回实际保存的 content 与新 revision。这是替换该文件，不是追加；下一次更新使用新 revision。HTTP 409 的 detail.code 为 revision_conflict 时，detail.current 包含当前 filename、content、revision；保留待改正文，核对新内容后再决定如何合并，不自动用新 revision 重试覆盖。

旧请求省略 revision 仍可调用，只有串行和原子保存，不具备过期编辑检测。非法 revision 返回 422；不可读的 UTF-8 内容返回 invalid_profile_file，磁盘读写失败返回 503/profile_io_error，均不能当作保存成功。任意外部文件编辑器不共享服务端锁：直接文件操作仍可使用，这里的检查是乐观冲突检测，不承诺跨工具绝对互斥。

可执行的 PowerShell 例子（$info 从当前连接说明取得）：

```powershell
$name = [uri]::EscapeDataString('测试画像')
$files = Invoke-RestMethod ($info.baseUrl + '/api/persona/' + $name + '/files')
$file = $files.files | Where-Object filename -eq 'memory.md'
$body = @{ filename = $file.filename; content = $file.content + "`n本次已核对的运营经验"; revision = $file.revision } | ConvertTo-Json
$saved = Invoke-RestMethod ($info.baseUrl + '/api/persona/' + $name + '/file') -Method Put -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
$saved | Select-Object filename, content, revision
```

新建画像也可直接建立目录及 Markdown 文件；刷新画像列表后可见。/api/profile/build 只把用户表单生成基线画像，返回 baseline-ready，不调用模型。外部 Agent 按完整建档方法继续分析链接、补充证据与完善六维文件。

连接信息的 selectedProfile 是界面当前画像提示，不是全局任务归属。用户明确指定画像时按任务指定；多 Agent 可以分别处理不同项目。更新已有文件前读当前正文，合并仍有用的内容和用户改动；不要用较早读到的全文覆盖后来的编辑。无需每轮读全部画像，也没有旧版的系统 Profile marker 自动注入。

## 看真实表现

GET /api/analytics/platforms 列出实际支持的平台及最近已知状态。旧成功标记不代表当前后台可用。
GET /api/analytics/{platform} 会真实访问平台，可能启动浏览器、耗时数秒到三分钟，并更新本地分析快照；它不是纯缓存读取。登录失败和平台改版会报错。

已有快照与相关资料可查 outputs/_analytics/ 和项目成品；字段依平台而异。把采集时间、平台、样本范围和统计口径一起看，区分实际指标、推测和创作假设，不把缺失数据当作零。

抖音登录指创作者后台，软件使用独立的浏览器资料；用户默认浏览器里能看本人主页，不等于这份后台会话已验证。同一抖音账号可用于两个入口，不需要新增两套账号配置。`verificationStatus` 为 `verified`（后台确认账号）、`login_required`（平台明确未登录）、`unknown`（网络、占用或响应变化，暂时无法核验）；`accountId` 是已验证账号编号，`checkedAt` 为 Unix 秒。unknown 不等于退出，也不能当作在线成功。手动校验可调用 `GET /api/accounts/douyin/whoami?force=1`。

自动采集的增长只比较同平台、同稳定账号编号、同来源的已核验快照。新快照带 `platform`、`accountId`、`source`、`ts`；抖音来源为 `douyin-creator`，B站复用既有已登录 nav 响应中的 mid，来源为 `bilibili-member`，不新增联网认证接口。未能从现有采集取得稳定编号的平台仍返回当前可用指标，但 `growthStatus: identity_unverified`、增长各窗口为 null，`growthReason` 说明原因，也不登记无归属快照；首个已核验样本为 `no_history`，后续有同身份可比历史时为 `available`。旧无归属或缺平台/来源的历史原字节保留，不猜昵称、浏览器目录或默认账号，不补零、不作为增长基线。部分指标缺失时如实保留 null；仅凭昵称或一个获赞数不足以宣称完整分析。

## 数据底座与口径

这些资料有关联，但不是同一张自动联动的数据表：

| 资料 | 作用与边界 |
| --- | --- |
| outputs/_analytics/ 下平台账号快照及历史 JSONL | 账号接口采集的原始平台结果；字段含义以来源为准 |
| outputs/_analytics/snapshots/<profile>/<platform>/<date>.json | data-tracker 的按画像、平台、日期快照，供粉丝趋势与生命周期分析 |
| outputs/_analytics/publish-log.json | 实际发布事件与可用归因信息；已有历史记录不一定完整 |
| 项目 .easel.json | 内容库展示、用途分类、成品清单、画像和平台归属；ready（已就绪）或 published（已标记发布）本身不是平台发布凭据 |
| 日历与旧 _publish.log | 排期和旧路径发布事实，不能直接当所有平台统一指标底座 |

账号级 likes 不能一概解读为点赞数：例如小红书旧结果的 likes 是“获赞与收藏”，公众号旧界面可能把同名字段当累计阅读。先查看 raw 数据、字段名和页面说明，记录平台、指标含义、单位、采集时间、样本窗口与画像归属；需要跨平台比较时明确映射和分母。缺字段保留 null/缺失说明，不补成零。

账号采集的 `<platform>.jsonl` 与按画像的 `snapshots/` 是两套既有历史，采集不会自动代替 tracker 建档。需要把采集结果交给 tracker 时，由 Agent 核对画像、平台、账号、日期、来源和指标映射再登记；不要把不同平台的最后一条快照拿来相减。一个画像有多个平台时，trend/lifecycle 用 `--platform` 明确选择。

data-tracker 是用户/Agent 指定画像、平台和输入数据口径的手工业务记录，不执行平台账号认证。不要把它的趋势结果宣称为软件自动验证的账号增长；同一画像在同平台换号或变更来源时，应分清记录范围，不把两个账号的数据续成同一条趋势。

内置业务计算可以直接运行，也可以由 Agent 用自己的工具复现同一口径。review.py 的月度评分按有效维度归一权重，缺基准/上月/计划就降级；social_stats 的互动率优先 reach、impressions、views，并区分全缺与部分缺。不同方法的点赞/评论/收藏权重并不相同，不能混成一个“官方爆款分”。完整公式、阈值、案例和专业判断继续保留在工作目录 skills/KNOWLEDGE.md 的各方法中；评分是可追溯的经验辅助，不是统一交付门槛。

## 让经验回到软件

把长分析放到 outputs/<项目>/ 的报告中，复用成品登记方式，可将用途 category 记为 analysis。正式报告列入 deliverables，采集原始数据与过程文件留在原记录或项目 assets/ 中，并注明来源、账号、口径与时间。把后续创作真正有用的结论整理进对应画像的 memory.md、preferences.md 或其他合适文件；需要修改定位、风格时可以更新相应维度。自然衔接当前用户任务，不要求每次创作都改画像，也不为分类调整原项目路径。

旧版聊天的桌面持久状态仍在数据目录 ui-state.json；home 下可能保留历史 OpenClaw 状态。0.5.0 不运行旧聊天与网关，也不清理用户历史。把它们当历史资料，不把文件目录或已退出的接口说成完整聊天检索服务。通常先查项目和画像就足够。
