# 业务 Python 输入输出与例子

所有示例通过 mediasail.ps1 python 运行，cwd 是连接资料的 workspace，EASEL_ROOT 同步指向该目录。脚本的 --help 是当前参数契约；读写文件可使用引号包裹的中文或空格路径。本页例子不联网、不调用模型、不使用真实账号。

`$SkillHelper`、`$DataDir` 和 `$info` 使用 [工具与接口](tools-api.md) 的 Windows 示例，从本机最新连接资料取得实际值；先建立对应项目及 assets 目录再写文件，示例主题名可按任务替换。

## 项目登记

先在 outputs/春季内容/ 写好文案.md，再运行：

```powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' meta --topic '春季内容' --title '春季内容方案' --category creation --kind article --status ready --profile '测试画像' --deliverables '文案.md' --summary '完成运营内容方案'
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' read --topic '春季内容'
```

meta 更新项目的 .easel.json，read 输出其中的 JSON。登记不创造缺失文件，不代表真实发布；成品清单顺序影响展示。GET /api/outputs 或内容库刷新应能读到项目和成品路径。

`--category` 为 creation、analysis 或 reference，与 `--kind` 的体裁分开；分类不新增目录层级。status 的 draft/ready/published 是草稿、已就绪、已标记发布，后者不是平台发布凭据。软件在线且多人可能同时编辑展示信息时，可用带 revision 的项目元数据 GET/PATCH 接口，见[项目、素材与成品](outputs.md)。

## 账号快照与趋势

```powershell
& $SkillHelper python --data-dir $DataDir 'skills/openclaw/skill-data-tracker/scripts/track.py' snapshot --profile '测试画像' --platform xiaohongshu --date 2026-10-01 --followers 100
& $SkillHelper python --data-dir $DataDir 'skills/openclaw/skill-data-tracker/scripts/track.py' snapshot --profile '测试画像' --platform xiaohongshu --date 2026-10-08 --followers 120
& $SkillHelper python --data-dir $DataDir 'skills/openclaw/skill-data-tracker/scripts/track.py' trend --profile '测试画像' --platform xiaohongshu --metric followers
```

snapshot 写入 outputs/_analytics/snapshots/<profile>/<platform>/<date>.json，返回状态及保存信息；trend 从已有快照计算增长和有效日期。样本少时会提示，两个点不应解释为可靠的长期趋势。total_likes 也要注明原平台口径，不能把“获赞与收藏”改名成纯点赞。

这是按用户/Agent 自选数据口径登记的手工工具，不自动核验平台账号。画像与 platform 用于组织样本；登记前自行确认账号、来源和日期一致，换号或改口径时分开记录，不能将它冒充自动采集的身份校验。

## 月度复盘计算

先在 `outputs/复盘主题/assets/输入数据.json` 准备 UTF-8 JSON 文件，字段可以缺失：

```json
{
  "month":"2026-10", "platform":"xiaohongshu", "followers":120,
  "followers_change":20, "previous":{"avg_engagement_rate_pct":4.2,"reach":42000},
  "plan":{"planned_posts":2}, "benchmark":{"engagement_rate_avg":0.04},
  "posts":[{"title":"测试内容","date":"2026-10-01","type":"图文","pillar":"好物","reach":1000,"likes":30,"comments":4,"saves":8,"shares":2}]
}
```

JSON 输出为可追溯的计算结果，包含排序、维度分数/总分和缺值警告。互动率优先 reach→impressions→views；付费推广帖另行标记/剔除后比较有机基准。缺 benchmark/previous/plan 时对应维度降级，剩余权重归一；不是强制80分才可交付。

```powershell
& $SkillHelper python --data-dir $DataDir 'skills/openclaw/skill-social-performance-review/scripts/review.py' score --input 'outputs/复盘主题/assets/输入数据.json' | Set-Content -LiteralPath (Join-Path $info.outputs '复盘主题/assets/计算结果.json') -Encoding UTF8
```

完整月报仍需 Agent 结合业务解释 Top/Bottom、内容支柱、格式、hook、节奏与下月行动。可以用其他工具复现相同口径，不必固定调用脚本。具体参数以当前脚本 --help 为准。

## 发布与采集

相关脚本及 HTTP 接口会访问真实平台和登录态。先看平台方法、--help、登录状态及当前任务，判断是创建草稿还是正式发布；不把这类有实际效果的示例放进连接检测。系统 Chrome/Edge 不可用时明确报缺依赖，外部 Agent 可协助用户准备；软件不会为了连 Skill 自动安装浏览器或平台插件。

## 小样本与回存位置

review.py 沿用原口径：样本只有3条时 Top3 可包含全部、Bottom3 为空；这不表示没有低表现内容，可根据逐帖结果解释。内部评分只使用实际存在的维度，缺少维度时不能当作完整质量分。
方法模板中的“复盘主题”和文件名是示例。实际报告放入选定项目根目录，原始数据和计算结果放 assets/，用该项目的 .easel.json 登记真实成品路径。

例如报告已写到 `outputs/复盘主题/复盘报告.md` 后，可登记为运营分析：

```powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' meta --topic '复盘主题' --title '月度运营复盘' --category analysis --kind article --status ready --deliverables '复盘报告.md' --summary '按平台、账号和采集时间解释表现，列出下一步验证'
```

这里的 article 是文档体裁，analysis 才是项目用途；原始快照和过程数据不列为最终成品。报告保留实际来源、账号和计算口径，不把整理登记本身当作补齐了证据。
