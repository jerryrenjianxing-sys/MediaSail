# MediaSail：上游与社媒能力讨论（2026-10-20）

本轮是用户要求的研究和子智能体讨论，未修改软件、上游pin、依赖、用户资料或发布版本。主agent已读取用户引用的聊天，随后对照实际源码；三个子智能体分别研究Easel增量、运营方法和执行工具，并相互质询优先级。静态发现不代表真实账号验收。

## 用户最新确认的边界

`social-content-engine`与Marketing Skills中的发布功能全部排除，发布交给外置AitoEarn。不引入它们的发布器、自动上传/提交、云端草稿、平台排期执行、账号授权、HubSpot/Buffer等发布服务对接或队列。保留画像、受众研究、竞品、策划、创作、素材与质量判断、效果复盘的方法。内容日历只用于选题和计划，不自动变成平台定时发布。这是新增方法的接入边界，本轮没有改动MediaSail现有业务实现。

## Easel 增量

- MediaSail 0.5.9仍固定`fb80ae6dd6fc26f5553efcb293ee6d93ef253f02`。Easel最新正式版为[v0.3.0](https://github.com/ZJU-REAL/Easel/releases/tag/v0.3.0)，2026-10-12发布；当前主分支为[8d08b216](https://github.com/ZJU-REAL/Easel/commit/8d08b216105bd7c7057c84c97cd637cec44db609)，上海时间2026-10-18 18:45:31。
- 与pin相差118个提交，896个文件变化中719个是重命名，主要是内置技能目录从openclaw搬到builtin；不能据文件数量宣称新增数百项能力。准确比较依据见[GitHub compare](https://github.com/ZJU-REAL/Easel/compare/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02...8d08b216105bd7c7057c84c97cd637cec44db609)。
- [变更记录](https://github.com/ZJU-REAL/Easel/blob/8d08b216105bd7c7057c84c97cd637cec44db609/CHANGELOG.md)包括多Agent执行引擎、可跳过OpenClaw、聊天内多产物画廊、登录和账号校验修复；主分支另有人工发布工作流。多执行引擎仍由软件内调度，不能直接等同于MediaSail完全外部Agent的产品方向。

优先挑选可验证的小修复，不整体合并重命名和Agent调度：

1. 发布结果真实性与不重放结果不明的创建请求。本地知乎脚本仍以URL包含`question`判成功；[上游3711dbd](https://github.com/ZJU-REAL/Easel/commit/3711dbd)已单独修复。本地公众号可选凭证API适配对`draft/add`超时/5xx会重试；[上游af03c7e](https://github.com/ZJU-REAL/Easel/commit/af03c7e)避免重放结果不明的创建。公众号默认Web后台会话是另一条路径，不能把此问题夸大到所有公众号发布。
2. 二维码有效性、登录结束后的持久会话校验、旧身份响应竞态；挑选时保留MediaSail已实现的资料锁和三态核验。
3. 热点源/解析可靠性与错误说明；另外核对日历本地日期，当前发布/选题排期仍有`toISOString().slice(0,10)`。

人工发布中的预览、富文本复制、官方页面和媒体包在此仅记录上游存在，不列为本轮新增发布链。现有软件已能预览HTML及复制部分内容，不应重复宣传为全新能力。新上游页面也不能直接视为主题排版、图片可靠迁移和发布回读都已解决。

## 外部项目取舍

| 项目 | 会议建议 | 接入方式 |
| --- | --- | --- |
| [Anthropic social-content-engine](https://github.com/anthropics/knowledge-work-plugins/tree/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine)与marketing | 取运营差额方法，不重复导入整套日历、语气和复用Skill；发布部分全部排除 | 补现有专业方法的reference与索引；不绑定Canva/Shopify，不接入HubSpot等发布链 |
| [Marketing Skills](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b) | 取真实受众调研、竞品证据、文风属性及复盘知识；发布部分全部排除 | 与六维画像和项目资料映射，不另建`.agents/product-marketing.md`为第二份事实源，不接发布服务或平台执行排期 |
| [baoyu-skills](https://github.com/JimLiu/baoyu-skills/tree/1567581c26ec29f4216c6e6835415bf30343b0e3) | 借鉴卡片信息结构、配图布局及排版检查；确定性排版工具遇到真缺口时单独评估 | 创作工具由外部Agent选择，不整体搬入强制确认、指定渲染器或供应商 |
| [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp/tree/7797fd375aba02dcd33afe143f6bee13e5870859) | 首个可选执行工具试点：关键词搜索、筛选、对标笔记详情、用户主页 | 放外部Agent环境，先验证实际版本和浏览器/登录要求；不随软件捆绑。现有评论工具和发布器不重复建 |
| [social-auto-upload](https://github.com/dreammis/social-auto-upload/tree/0012d2c355f88f683cc38dde2a2db209e14091bc) | 新平台确有需求时评估单个平台适配器或修复 | 保留现有平台资料与发布记录，不默认整套引入新CLI/浏览器环境 |
| [Postiz](https://github.com/gitroomhq/postiz-app/tree/e2be3ecba77af9f220d9025a9f90f0017a9771ba) | 以海外账号排期需求为前提，当前不内嵌完整服务 | 可作为独立外部服务，另行评估账号API、数据库及任务运行成本 |

以上是选择建议，未安装、执行或认证这些第三方工具。许可证、版权与下游引用在具体引入前逐文件保留核对，不把“借鉴方法”当作省略来源的理由。

## 首批方法差额

现有Easel资料已覆盖语气、排期、复用、内容支柱、复盘，新增同名整套Skill会重复。重点补五块：

1. **文风证据**：属性含义、边界、真实例句、改稿前后及理由，区分不同场合的语气；沉淀到目标画像style/preferences。
2. **受众决策证据**：实际任务、购买或关注触发、替代方案、原话、样本偏差及反证；增强现有受众和评论分析。
3. **竞品证据分层**：观察、推断、启示分开，注明日期；未观察到不等于不存在。
4. **素材逐项映射与派生关系**：每张图的槽位、素材来源、缺项和复用来源，查看实际成品后只返工失败项。
5. **经验适用性和失效**：结论对应证据、适用账号/平台/时间条件，过时或相反数据出现时修订；不把一次爆款当永久规律。

日历延续与空档检查属于现有方法的例子/互链改进，不再独立新建日历。SCE固定频率、平台长度、比例和案例只是特定场景起点，不当作平台规则或跨账号定律。

## 在MediaSail中的落点

- 首页复制的MD仍是简短接入卡；完整Skill按任务指向专业方法索引。沿用发现、策划、制作、发布、归因分类，补目标方法的reference，不新添主导航或安装中心。
- 画像仍使用`profiles/<画像>/`，日历和选题使用既有接口/文件，成果仍在`outputs/<项目>/`及`.easel.json`。详细研究放项目，稳定经验回写适当画像维度；不建立平行档案、独立全局Agent状态或第二份发布事实。
- 新方法是指导和参考，不增加每轮固定流程。现有voice-builder正文仍残留强制访谈及独立about-me/voice产物，应先整理与用户开放原则的冲突，避免在其上叠加另一套强制方法。
- 项目阶段、日历计划及实际发布结果分开。SCE[主文](https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/SKILL.md)称不发布，但[publishing参考](https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/publishing.md)使用SCHEDULED并告知会自动发布。这是其发布部分完全排除的一个源码依据；本轮未联网验证其供应商端点。内容准备好后回存现有项目，发布沿用外置AitoEarn。

建议讨论推进顺序：先评估现有功能的可靠性小修 → 合并五块方法差额和路径映射 → 单独试点小红书读取研究工具 → 确有创作排版缺口再评估小工具。不增加这两套来源的发布功能，不按仓库大小、星标数或Skill数量决定是否加入。

详细原始研究分别见同目录 `RESEARCH-EASEL-UPSTREAM-2026-10-20.md`、`RESEARCH-SOCIAL-METHODS-2026-10-20.md`、`RESEARCH-SOCIAL-TOOLS-2026-10-20.md`。
