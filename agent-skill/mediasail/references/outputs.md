# 项目、素材与成品

连接资料中的 outputs 指向内容库目录。一个项目对应一个目录：

它位于当前资料库的 workspace 中，正是控制台展示的目录。可以直接创建、修改和登记成品；不必先在其他工作目录保存一份再同步。中间计算数据保留来源、账号、指标口径和采集时间，便于复盘。

~~~
outputs/
  春季内容/
    文案.md
    封面.png
    视频.mp4
    .easel.json
    assets/
      原始资料.txt
      中间文件/
~~~

成品放项目根目录；素材、中间结果和构建脚本放 assets/。这是现有内容库识别成品的结构，不是对创作方法的要求。根目录散落文件、隐藏文件和 _ 开头的系统目录不会作为正常项目展示。

## 分类与查找

分类是项目元数据，不是新的目录层级。继续使用 `outputs/<项目>/`，不用改成 `outputs/分析/<项目>/`，也不用复制同一项目到几个分类中。

| category | 用途 |
| --- | --- |
| creation | 创作内容，例如文案、图文、视频、音频、海报 |
| analysis | 分析报告，例如账号诊断、竞品研究、运营复盘与策略报告 |
| reference | 参考资料，例如资料整理、来源摘录、可复用笔记 |

一个项目可以包含文案、视频和分析附录，选择主要用途，其他信息用标题、摘要和标签表达。`kind` 仍表示体裁，与用途分类分开；Markdown 报告和 Markdown 文案可以分别归入 analysis 和 creation。没有 category 的旧项目显示“未分类”，不移动原件，也不凭扩展名自动改写它们。

内容库顶层可按标题、项目目录名、摘要与标签搜索，并组合分类、画像、平台、形态和阶段筛选；这不是文件名或正文全文检索。进入项目后仍可按图片、视频、音频、文档筛文件，与顶层项目筛选分开。补充清楚的标题、摘要、画像、平台与标签，有助于用户和其他 Agent 找到成果。`GET /api/outputs` 继续返回原项目目录树和展示信息，分类不改变文件路径或成品引用。

面向用户阅读的分析报告也是正式成果，可列入 deliverables。`_analytics/` 中的采集快照和计算历史、`_login/` 中的登录记录、`_inbox/` 中的收件附件仍是各自的原始记录，不因新增“分析报告”分类就自动变成报告。项目所用原始资料、数据和过程文件可放 assets/，保留来源、平台、稳定账号编号、指标含义与单位、采集时间和样本窗口；不要把缺失指标写成零或把推测当采集事实。

## 登记内容库

先用自己的工具写好成品，再使用现有 manifest.py 更新展示信息：
~~~powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' meta --topic '春季内容' --title '春季内容方案' --category creation --kind article --status draft --deliverables '文案.md' --summary '外部 Agent 完成的内容方案'
~~~
$SkillHelper 是 Skill 包 scripts/mediasail.ps1 的绝对路径；$DataDir 是复制说明中的数据目录。helper 已设置 EASEL_ROOT 和 cwd。

kind：article、xhs-note、video、cards、poster、audio、other。
category：creation、analysis、reference；可不填，已有项目按需补充。
status：draft（草稿）、ready（已就绪）、published（已标记发布）。这些状态适用于不同用途的项目；ready 不代表必须发布，published 也不是平台已发布的证明。
可选 --platform、--profile、--tags（逗号分隔）、--cover（项目相对文件名）。--profile 可更新归属，未传入时保留原值。
--deliverables 按逗号分隔，保持想要的成品顺序；文件名自身含逗号时可直接编辑 JSON 数组。
meta 只改传入字段，保留其他字段与步骤记录。也可 --data 指向明确的 .easel.json。

步骤记录是可选的：
~~~powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' record --topic '春季内容' --layer produce --skill external-agent --outputs '文案.md' --summary '完成两个文案角度'
~~~

GET /api/outputs 或刷新内容库可看到项目。复查 deliverablePaths 指向实际存在的成品，避免只登记名字却没有文件。

项目登记成功意味着本地可见，不代表发布完成。发布事实包含平台、账号、时间、实际结果/URL；排期、AitoEarn 草稿、.easel.json 的状态字段分别记录自己的含义。既有不同发布路径的历史记录可能不齐，复盘前核对，不能从“成品已存在”推断“已经发布”。

## 修改项目信息与并发编辑

控制台可编辑 title、summary、category、kind、status、profile、platform 和 tags。软件在线时，外部 Agent 也可用同一组项目元数据接口，只提交需要变更的字段：

- `GET /api/projects/{project}/metadata` 返回 `{metadata, revision}`。
- `PATCH /api/projects/{project}/metadata` 接收 `{revision, changes}`，成功返回更新后的 `{metadata, revision}`。

`project` 是 outputs 下的一级项目目录名，作为 URL 路径段编码。revision 是读取时得到的不透明版本值，原样带回，不自行生成；它不是软件版本号。

```powershell
$project = [Uri]::EscapeDataString('春季内容')
$uri = $info.baseUrl + '/api/projects/' + $project + '/metadata'
$before = Invoke-RestMethod $uri
$payload = @{revision=$before.revision;changes=@{category='creation';summary='整理完成的春季内容方案'}} | ConvertTo-Json -Depth 6
Invoke-RestMethod $uri -Method Patch -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
```

`$info` 来自[工具与接口](tools-api.md)的当前连接示例。PATCH 是增量修改，没提交的字段保持原值，不把旧版整份元数据覆盖回去；分类和展示信息的保存不应改写步骤记录、封面或成品清单。保存时会核对 revision，检测到文件在读取后已变化则返回 HTTP 409，不覆盖这份新内容。保留自己的待改内容，重新读取并核对差异，再决定如何合并；不换一个新 revision 就盲目重发原来的覆盖请求。界面也会保留未保存的编辑，方便核对。

离线时仍可用 manifest.py 维护项目，`read --revision` 和 `meta --if-revision` 提供同样的版本核对入口：

```powershell
$before = & $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' read --topic '春季内容' --revision | ConvertFrom-Json
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' meta --topic '春季内容' --category creation --if-revision $before.revision
```

可用自己的文件工具直接编辑 JSON；这种编辑器不参与版本核对，多方同时写入时先读取当前文件并协调修改范围。清空 API 文本字段用空串，清空 tags 用空数组；不提交表示保留原值。无需每次任务都重新分类或登记步骤。

## 素材导入与 AI 发布

导入接口 /api/upload 和 /api/upload/local 使用 multipart files + sessionId，返回 id/name/path。sessionId 在这里是收件目录标签，不需要启动旧聊天。把项目成果直接放进 outputs 不需要调用模型；也可以使用外部 Agent 的文件操作准备项目材料。

AI 发布用默认浏览器打开 https://aitoearn.cn/zh-CN。把正文、图片、视频及封面保存到当前项目，并在 `.easel.json` 登记实际成品；可使用现有文件工具整理有序媒体、保留清晰的文件名和发布说明，不规定创作工具。用户在内容库打开项目文件夹；用户或 Agent 用现有文件工具读取项目成品文件并复制正文，再由用户到官网选择媒体，检查顺序、账号、平台和排期。网站不能直接读取资料库或自动选中文件，软件不再上传素材或创建 AitoEarn 草稿。

默认浏览器与旧内嵌页面使用不同登录状态，可能需要重新登录，并按官网要求安装浏览器扩展。旧 Cookie 不迁移；官网现有草稿仍属于原云端账号。网页发布结果不自动回写 MediaSail，按实际结果、平台、账号、时间和 URL 补充本地发布记录，不仅将项目状态改为 published 就当作成功。MediaSail 原生平台工具的登录、采集和发布流程保持独立。

旧发送记录留在当前数据目录 `aitoearn/imports.json`，可从设置的历史存档入口打开旧 AI 发布记录目录；它可能包含尚未回存项目的标题、正文和素材顺序。旧登录分区 `Partitions` 原位保留，不自动读取或迁移。不再续传、创建或重试旧任务；若旧结果为 creating/uncertain，先在官网原账号核对是否已有草稿，保留本地记录不代表云端操作被撤销。没有等价的 AitoEarn 上传或草稿 HTTP API 可从本 Skill 调用。
