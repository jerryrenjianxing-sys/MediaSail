# 素材与成品

连接资料中的 outputs 指向内容库目录。一个项目对应一个目录：

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

## 登记内容库

先用自己的工具写好成品，再使用现有 manifest.py 更新展示信息：
~~~powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' meta --topic '春季内容' --title '春季内容方案' --kind article --status draft --deliverables '文案.md' --summary '外部 Agent 完成的内容方案'
~~~
$SkillHelper 是 Skill 包 scripts/mediasail.ps1 的绝对路径；$DataDir 是复制说明中的数据目录。helper 已设置 EASEL_ROOT 和 cwd。

kind：article、xhs-note、video、cards、poster、audio、other。
status：draft、ready、published。
可选 --platform、--profile、--tags（逗号分隔）、--cover（项目相对文件名）。
--deliverables 按逗号分隔，保持想要的成品顺序；文件名自身含逗号时可直接编辑 JSON 数组。
meta 只改传入字段，保留其他字段与步骤记录。也可 --data 指向明确的 .easel.json。

步骤记录是可选的：
~~~powershell
& $SkillHelper python --data-dir $DataDir 'skills/shared/scripts/manifest.py' record --topic '春季内容' --layer produce --skill external-agent --outputs '文案.md' --summary '完成两个文案角度'
~~~

GET /api/outputs 或刷新内容库可看到项目。复查 deliverablePaths 指向实际存在的成品，避免只登记名字却没有文件。

## 附件与 AI 发布

聊天附件接口 /api/upload 和 /api/upload/local 使用 multipart files + sessionId，返回 id/name/path，再把这些引用交给同一 sessionId 的聊天请求。把项目成果直接放进 outputs 不需要调用聊天或模型。

AitoEarn 导入支持文字配图片，或文字配单个视频及封面。准备好文案和有序媒体后，用户可在内容库项目成品区点击「发送到 AI 发布」，检查候选正文、图片顺序、视频及草稿箱。仅文字会保留待发送内容并提示补媒体。发送记录在数据目录 aitoearn/imports.json；它是软件维护的记录，不等同于可调用的草稿接口。当前外部 Skill 不提供伪造的 AitoEarn HTTP API。
