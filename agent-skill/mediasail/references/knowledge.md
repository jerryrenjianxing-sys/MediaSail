# 业务能力与专业方法

先读取 agent-connection.json 的 workspace。可阅读索引位于 `<workspace>/skills/KNOWLEDGE.md`，机器可读索引位于 `<workspace>/skills/knowledge-index.json`，准确脚本名单与退出边界位于 `<workspace>/skills/business-tools.md`。这些路径由安装器提供，不要求安装 OpenClaw，目录名 openclaw 仅为兼容。

## 按任务查资料

| 任务 | 工作目录内的方法入口 |
| --- | --- |
| 首次建档、从链接增强画像 | skills/openclaw/skill-profile-builder/SKILL.md 及其提问、社媒链接分析参考 |
| 画像维护、长期经验、风格校对 | skill-profile-manager、skill-persona-check、skill-voice-builder |
| 小红书爆款、关键词、评论与受众 | skill-xhs-analyzer、skill-comment-insights、skill-audience-profiler |
| 竞品、定位、内容空缺、策略 | skill-competitor-analysis、skill-positioning-analysis、skill-content-gap-analysis、skill-strategy-advisor |
| 月度复盘、归因、快照趋势 | skill-social-performance-review、skill-content-postmortem、skill-publish-analytics、skill-data-tracker |
| 发布与日历、素材和成品登记 | 相应平台发布方法、skill-publish-log、skill-publish-scheduler、skill-event-calendar、asset-manager |
| 镜头、节奏、叙事与包装质量 | video-script、video-strategy、video-production、video-editing、clipify 等混合专业方法 |

除首行完整路径外，表内名称均为 `skills/openclaw/<名称>/SKILL.md`；按索引获取实际链接，不猜测命令是否存在。完整方法及其 references 保留专业细节，不是要求外部 Agent 顺序执行的固定产线。若某份参考来自历史特定案例，其尺寸、分值或比例应结合适用条件判断，不当成平台官方保证。

## 三种内容的区别

- **业务能力**：画像、账号、采集、统计、内容库、发布适配等，提供真实接口和确定性脚本；可由软件或外部 Agent 调用。
- **专业方法**：拆解什么、如何推断、用什么证据、怎样判断质量；研究、解释、创作和画像增强由外部 Agent 自主完成，工具由它选择。
- **已退出的通用工具**：生图、抠图、语音/视频生成、通用音频处理等执行器与依赖，以及旧 OpenClaw 系统指令不分发。混合方法中的镜头、平台、结构、节奏与案例知识仍保留。

明确 MediaSail API、脚本输入输出和目录结构，是让成果能被软件识别的业务契约，不限制 Agent 用什么工具创作。需要时可调用，其他步骤可用熟悉的工具完成；不要求每轮握手、评分、审批或更新画像。
