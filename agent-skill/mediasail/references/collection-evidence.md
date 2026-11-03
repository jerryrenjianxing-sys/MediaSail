# 账号采集缺项与有据分析

适用于用户要分析本人账号、作品表现，或本地采集缺字段、返回空列表、来源相互矛盾时。MediaSail 的一次取数结果是证据的一部分，Agent 可以按任务选用软件脚本、已授权页面、已有资料或自己的只读工具继续研究；不需要让用户再说一次“抓一下”。接入本身仍只做轻量连接，不因此自动遍历账号或运行全量采集。

## 读懂采集结果

`GET /api/analytics/{platform}` 是真实取数。由 `account_stats.py` 提供的五个平台新增 `collection`，登录是否成立仍看 `verificationStatus`；两者是独立事实。其他旧采集器暂未报告完整性时，按未知理解，不从成功退出或已有数字推断完整。

| 字段 | 作用 |
| --- | --- |
| collection.status | complete：取得本次配置范围的数据；partial：仍有缺项、读取问题或样本范围未覆盖；failed：本次没有取得可用数据。不是全账号、全历史完成证明 |
| missingFields | 未取得的概览字段、metrics 或 notes。null 不是零，列表空不一定是没有作品 |
| issues | 分项 field、code、message、sourceUrl、retryable。retryable 是可重试线索，不是无限重试要求 |
| sources | 本次实际观察到字段的 URL、fetchedAt、scope。近七日、累计、当前筛选范围等不同口径分别解释 |
| notesCoverage | returned、total、limit、status、scope、hasMore。total 可为空；作品管理页总数可能包含不同状态，不能把近期样本条数当总作品数 |
| suggestions | 可选择的补查来源及其理由，不是固定执行顺序，也不是自动执行指令 |

作品列表的 empty 需要页面明确空态；unknown/partial 只代表未确认或未读全。脚本正常退出仍需解释 collection；旧字段、原快照位置和计算公式保持兼容。已验证账号的部分有效计数可以登记，缺失项仍为 null；全部失败不作为正常增长样本。

抖音的 `followerIndex` 是页面上的“粉丝指数”，不是 `followers`。`following` 是关注别人数量，也不是粉丝数。只在其他可访问的同账号页面或响应明确给出精确人数时，才以相同口径补充；某个旧地址跳到关注列表，只能说明该地址此次不可用，不能推出平台整体不提供人数。

## 选择补查办法

用户请求分析本人已登录账号时，可以在这一任务范围内继续只读取证。按结论需要补关键缺口，避免为无关字段拖延交付。可选择扩大样本、等页面真正加载、读取对应内容管理页、复用现有账号读取工具、检查可访问响应，或用已有项目中的可靠资料。来源仍不可用时，保留已经取得的事实，说明缺项、尝试范围及对结论的影响；扫码、交互验证或需要额外访问范围时再请用户协助。

软件已有 `skills/shared/scripts/platform_readback.py` 的只读账号响应读取能力，以及 `account_stats.py` 的采集能力。补抓脚本与登录/发布使用同一专用资料目录时，可复用 `profile_lock.ProfileLock`；由调用脚本持有锁、关闭浏览器再释放，避免并发打开同资料。路径由当前连接资料取得；用户普通浏览器会话和软件平台资料是不同入口。

抖音默认最多返回 6 条近期已发布作品，可按任务扩大为 1—100 条样本，仍以返回覆盖范围判断是否足够：

```powershell
# $info 来自当前发现文件；HTTP JSON 按 UTF-8 解码。
$r = Invoke-WebRequest ($info.baseUrl + '/api/analytics/douyin?notes_limit=20') -UseBasicParsing -TimeoutSec 240
$data = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
$data.collection | ConvertTo-Json -Depth 8

# 或使用现有本地 CLI；此参数当前用于抖音。
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $info.skillDir 'scripts/mediasail.ps1') python --data-dir $info.dataDir 'skills/shared/scripts/account_stats.py' fetch --platform douyin --notes-limit 20
```

这不是全量翻页承诺。平台加载、可见范围、筛选或权限可能限制数量，检查 hasMore、total、issues 和实际返回内容。采集、等待和补查方案由 Agent 自主选择，软件没有新增任务调度器、远程命令接口或外部进程托管。

## 让结论对应证据

分析稿可把观察事实、解释和待验证假设写清，形式按任务选择。重要判断应能找到同账号、同平台、时间、窗口、单位和样本范围的支持材料，原始摘录或数据回存当前研究项目，稳定经验按需回六维画像。

- 播放量少是观察值；是否未进推荐池、限流或内容疲劳，还需要分发来源、曝光、发布时间等证据。
- 缺作品列表时只能说尚未核对更新频率；读到近期作品后再判断是否断更。
- 转粉率需要可靠的新关注量及相应分母、窗口；关注别人数量、粉丝指数或累计获赞不能替代。
- 环比带 `%` 与绝对增减不同；先核对标签和比较周期，再计算或解释，保留原值。
- 一个画像里针对小红书的身份/风格约定，不自动成为抖音机构号的既定策略。先核对平台、账号角色和用户目标，将差异作为待确认选择。
- 新证据可能改变旧判断。更新报告时注明修订依据和仍未证实的部分，不把“这次读不到”写成“只能人工”或整个平台永久不开放。

例如，合成结果“近七日播放 482、作品列表尚未取得”足以描述该窗口的播放表现；不足以断言账号断更或转化链断裂。补到带日期的作品后，可以讨论更新间隔与作品差异，因果解释仍应与观察事实分开。
