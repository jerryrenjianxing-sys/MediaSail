# 0.5.0：业务能力与专业方法整理

本版由外部 Agent 完整接替旧内置 Agent 的智能工作。画像、运营分析、历史资料、账号、采集、业务计算、内容库与发布适配继续属于 MediaSail；研究、画像增强、解释、策划、创作与开发由外部 Agent 自主完成。连接 Skill 主结构和开放协作方式保留，不引入固定调度、每轮仪式或创作工具限制。

## 打包规则

`scripts/curate-knowledge.cjs` 导出 `curatePayload({payloadRoot, sourceRoot})`。输入为已 stage 的 `manifest.json` 与 `easel/`，仅在该 staging 目录整理，拒绝与 sourceRoot 重叠，完成后重算所有文件 SHA256。不会扫描用户数据、删除用户历史或修改固定上游源文件。保留旧 `skills/openclaw` 技术路径以兼容脚本相对导入。

| 类别 | 处理 |
| --- | --- |
| 业务脚本 | 由 knowledge-policy.cjs 明确白名单；保留账号/浏览器/登录/采集/发布、日历、素材/模板管理、成品登记、ROI、复盘、快照、评论分析、新闻与RSS |
| 专业方法 | 保留画像建档、六维分析、评论/竞品/定位、公式、样本口径、镜头、叙事、节奏、版式与质量经验；去除固定供应商和通用工具执行绑定 |
| 纯通用工具 | 生图、音乐/视频生成、抠图、图像编辑增强、TTS/语音克隆、多声线、通用音频处理、文档转换、绿幕等19个目录不再分发或列入默认列表 |
| 混合视频产线 | 移出 SDK 与状态机，另存设计基线、质量机制、空间融合三份专业参考；主文按原片、转录、分场、构图、预览、验证和回存说明方法，不要求旧引擎、固定九步/审批链 |
| 旧系统配置 | 不搬 OpenClaw 的 AGENTS/TURN_REMINDER、安装元数据、自动路由与每轮画像注入。具体系统层由 stage 的根目录排除规则负责 |

通用工具退出不等于删除与它混在一起的专业经验。纯工具本身不做空壳入口；混合方法保留详细判断与案例。原实现可从 Git 历史或固定上游核对，不新增旧工具可选包。

## 生成资料

- `skills/KNOWLEDGE.md`：按业务与专业方法分类的可读索引，链接本包实际文档。
- `skills/knowledge-index.json`：name/title/description/layer/kind/document/scripts，前后端可使用同一真实列表。
- `skills/business-tools.md`：保留脚本与实际依赖边界。
- `skills/curation-report.json`：本次 keep/exclude/sanitize 准确清单与上游标识。

旧 redbook 的 macOS 专属安装器与命令表退出。其关键词矩阵、形态拆解、受众、评论与爆款结构等方法保留，并说明第三方 level/阈值不是平台公开保证。微信 ai_score.py 是正则与统计启发式，不调用模型；本版发布默认跳过该评分门，保留为可选参考。公式不能因工具改造而被替换成空泛目标，也不能包装成通用真理。

## 连接与接口

接入 Skill 保留能力地图与按需阅读结构。连接描述每次重读、核对实例，selectedProfile 只是界面画像提示，不是所有 Agent 的全局任务。helper 的核心检查不再要求 Node 或 gateway；离线可执行本地业务 Python，HTTP 操作才需要服务在线。通用创作依赖由外部 Agent 检测与选择，平台业务浏览器使用系统 Chrome/Edge。

`scripts/export-agent-api.py` 加载当前 patched 后端并注册 bridge/agent_skill.py，再生成 OpenAPI。导出器核对连接分发/业务入口存在，并拒绝把旧 chat/model 执行器导出为现行能力。当前为42条路径；未声明细化返回模型的旧业务接口仍可能有空 response schema，Skill 如实说明，不能声称已补全每一字段。关键基线响应及业务 Python 的 Windows 输入输出另有示例。

## 本轮已完成的验证

- knowledge.test.cjs：在真实上游 skills 的隔离副本验证完整业务脚本名单、退出实现、保留专业参考与权重公式、资料链接及 manifest SHA256。
- test_skill_helper.py：中文与空格路径/参数、离线执行、实例身份不符、无Node/网关正常连接、最新画像提示；运行真实 manifest 登记、tracker 快照/趋势和 review.py 复盘计算，无模型、无账号、无发布。
- 内置 skill-creator 验证器：以 UTF-8 模式检查主 Skill；个人 metadata 的 allow_implicit_invocation:false 保持不变。

软件整体安装、升级、平台流程与发布结果以本版最终验收记录为准；本文不将方法/脚本验证当作真实平台账号验收。
