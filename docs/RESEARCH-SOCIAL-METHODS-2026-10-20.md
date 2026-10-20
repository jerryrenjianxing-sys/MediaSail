# 社媒方法引入研究

2026-10-20；MediaSail 0.5.9。本轮按 mattpocock-skills research 核对第一方源码与许可证，只研究、只新增本文，不修改软件、资料库或账号。聊天结论仅作为检索线索。

**用户已确认的边界：social-content-engine 与 MarketingSkills 中的发布功能全部不引入，发布使用外置 AitoEarn。不导入发布、排期执行、账号授权、HubSpot/Buffer 等发布对接、自动提交或发布队列；只保留画像、研究、策划、创作、复盘方法，内容日历仅作计划。下文对上游发布内容的核对只是说明不采用的依据；现有 MediaSail 业务不在此次删除范围。**

## 结论与基线

建议吸收五个具体资料块，增强已有方法及索引：声音与改稿证据、受众研究证据、对标事实分层、多图素材核对、经验适用与失效。不要整库安装或新建“社媒引擎”。画像、日历、选题、内容库与发布事实继续用现有位置；外部 Agent 自主选择研究、创作和工具。完整方法可以保留细节，不转为每轮流程、固定审批、评分或供应商要求。

| 核对对象 | 固定提交与入口 |
| --- | --- |
| MediaSail | 0.5.9，HEAD `2d0d6c10400fdb7eaff4fe620e2b1f1d66b108c3`；[接入 Skill](../agent-skill/mediasail/SKILL.md) |
| Anthropic knowledge-work-plugins | `a266ab8c3c754a3ccf7a634044fc1595fc06e50e`；[官方仓库][anthropic]、[SCE][sce]、[Marketing][marketing] |
| Corey Haines MarketingSkills | `e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b`；[官方仓库][ms] |

固定 SHA 是此次判断的复查依据，不代表自动跟随上游。本轮核对相关文件，未完整审计两库；未验证供应商真实接口、订阅套餐、配额、算法或方法能提升转化。

## 先处理已有重复与残留冲突

MediaSail 已有 voice-builder、persona-check、audience-profiler、comment-insights、competitor-analysis、content-strategy/matrix/calendar、content-repurposing、quality-gate、postmortem、social-performance-review。声音样本、原话、排期、图卡、复盘主体均已存在，新库不能仅换名再叠一层。[方法发现](../agent-skill/mediasail/references/knowledge.md)、[现有整理规则](KNOWLEDGE-CURATION-0.5.0.md)

还应先清理现有分发正文的残留冲突：本轮亲见 `build/payload/easel/skills/openclaw/skill-voice-builder/SKILL.md`，开头虽声明方法非强制，正文仍要求“第一条消息必须是访谈问题”、固定两批六题、输出独立 about-me/voice.md。源文件也保留这些内容。独立产物可以是用户要的交付，不能自动成为第二份权威画像；补一个开放声明不足以消除正文的强制指令。[源方法](../vendor/easel/skills/openclaw/skill-voice-builder/SKILL.md)、[打包整理器](../scripts/curate-knowledge.cjs)

## SCE：具体保留什么

SCE 的实际目录是主文与 calendar、canva-api、shopify-assets、gotchas、publishing、案例；声音在共享文档，QA/reuse 主要在主文及上述参考，并非各有一套独立文件。

| 部分 | 实际内容与建议 |
| --- | --- |
| Voice | 从真实写作提取称呼、收尾、句长、直接程度、产品用词，记录样本与更新原因；用户改稿应帮助后续写作。已有 Easel 跨样本分析更细，新增的是“改前/改后/原因/场景”。回到 style/preferences，不引入共享 voice-profile 真相；样本缺失不自动推成永久禁令。[共享声音][voice] |
| Calendar | 延续既有日历，显示已发/已排/缺口；素材变体引用源。这与现有 calendar context 重叠，只补“续排”案例和过期活动检查。`content-calendar.md` + `Home:` 指向 Notion/Trello 的持久机制不引入；30天、频次、40/30/20/10比例和海外画幅属于经验。[calendar][calendar] |
| Assets | 逐个图片槽位对应具体素材；缺两张图不能笼统写“有产品图”。商品标题/描述/图片/价格/对比价/库存映射可改写为“事实源→brief→当前声明”，接本地资料或任意已授权系统；不要求 Shopify，不凭旧记忆编价格/库存。[商品资料][assets] |
| QA/reuse | 不能以任务 success 代替看实际成品；检查占位风景、灰块、模板文字、错商品、失效预览。只修失败候选，已选素材先裁切/重排复用。现有质量维度已有“看画面”，只补这些具体失败例及逐槽映射。[gotchas][gotchas] |
| Approval | 多处日历/选图/文案/队列确认是该插件设计。保留批量高成本制作前把方案具体化的思路；确认次数依当前任务和既有授权，不设置四道固定审批。[主文][sce] |
| Publishing | **源码内部有冲突**：主文称 stage never publish，参考却创建 `SCHEDULED`，随后明确会自动发布；主文可保存 Mailchimp 邮件草稿，参考末尾仍称邮件从不暂存。不能把该路径称为无发布副作用的草稿，也不能把例子当已验证官方API。沿用 MediaSail 实际入口和发布结果。[publishing][publishing] |

Canva ID、套餐、100次/分钟、候选数、固定等待、重试，以及“邮件只能纯文字”均属供应商/插件操作限制，留给 Agent 所选工具的现行说明，不进入通用产品协议。[Canva参考][canva]

## Marketing 与 MarketingSkills：具体取舍

Anthropic Marketing 的连接器文档本身支持同类工具替换；README 的部分 Skills 名称与固定提交的实际路径不一致，应按文件核对。`brand-review` 值得补“属性含义/边界/正反例、情境调音、位置/程度/改前改后”；`performance-report` 的摘要、数据对比、归因假设、投入/影响优先级与现有月报重叠，主要互链，不导入另一份报告体系。[Marketing及连接器][marketing]、[brand-review][brand]、[performance-report][performance]

| MarketingSkills来源 | 可取内容 | 不照搬 |
| --- | --- | --- |
| [social][social] | 从长内容提取独立成立的内容原子、原生改写、结果反馈；已有改编方法可参考案例 | 海外默认频次、每日评论/私信配额、500+帖门槛、统一最佳时长、字幕效果百分比或算法保证 |
| [listening][listening] / [carousel][carousel] | 第二批按需补“相关性/问题/可提供价值/时效”筛选，或按清单/证据/演示/观点选图卡叙事 | 新常驻监控、固定Top10/24h、浏览器/抓取器绑定、海外规格、诱导评论模板；现有图卡方法先查重 |
| [product-marketing][product] | JTBD、切换顾虑、客户语言、真实证明；尤其 Learnings 的证据/适用范围/状态 | 所有任务先读 `.agents/product-marketing.md`，14栏总档、逐节确认、另一份学习总库 |
| [content-strategy][strategy] | 可搜索/可分享、写清新增信息、创作时规划复用、受众问题支撑选题 | 搜索优先、博客hub/spoke、固定标题数/编辑轮数/比例成为所有账号规则；主体已有 |
| [customer-research][customer] | 已有资料/公开信号/访谈三类来源；JTBD、触发、结果、原话、替代方案；按人群聚合、偏差与反证 | G2/Reddit/SparkToro优先级、固定数量即高置信、美元奖励与PMF比例推广为普遍事实；不自动邀约 |
| [competitor-profiling][competitor] | 观察/推断/启示分层；未观察到不等于没有；有日期快照才说变化；原材料可复查 | 独立根目录、Firecrawl/DataForSEO优先栈、SEO域名模板套创作者、从流量旁证推成客户数验证 |
| [copy-editing][editing] | 先区分局部修改/保留真实声音/需重构；清楚、利益、证据、具体性，每个修改有原因 | Seven Sweeps强制顺序、虚拟专家7+/8+门、英文禁词与词数、统一增强情绪 |
| [analytics][analytics] | 先问支持何种决定；从明细计算并核对总数；分子分母同一封闭窗口，未成熟窗口记pending | GA4/GTM埋点、事件库、工具注册表、社媒与网页转换混用、法律概括；本机口径仍优先 |

不复制 README 的作者服务推广、伙伴广告、整套工具注册表和安装环境；署名与许可照原件保留。MarketingSkills 的 brand-voice 还注明部分来自 Wispr Flow/skills-marketing-library，后续采用其文字须追溯原件；首批声音补充可先用现有 Easel、Anthropic 声音与 brand-review 的方法。[仓库说明][ms]、[brand-voice来源尾注][msvoice]

## 首批五块与现有路径

以下是建议位置，尚未新增；路径从用户当前 `<workspace>/skills/openclaw/` 起算。详细方法保留实例，入口只写何时值得查阅；生成的 KNOWLEDGE.md/knowledge-index.json 继续作为发现入口，不新建索引系统。

| 建议参考资料 | 差额内容 | 供哪些已有方法查阅 |
| --- | --- | --- |
| `skill-voice-builder/references/voice-evidence-and-edits.md` | 属性→含义→边界→真实例句；改稿/原因/场景/日期；观察和明确偏好分开 | voice-builder、persona-check、social-content |
| `skill-audience-profiler/references/customer-evidence.md` | 原话/来源/日期/人群/情境；JTBD/触发/替代；矛盾、偏差、置信依据 | audience-profiler、comment-insights、strategy |
| `skill-competitor-analysis/references/evidence-and-snapshots.md` | 观察/推断/启示；已看范围与时间；未观察到的边界；日期快照 | competitor、positioning、content-gap |
| `skill-quality-gate/references/asset-slots-and-reuse.md` | 每页/槽→素材→缺口；占位/错图/遮挡案例；复用源→变体；只修失败项；未查看如实说 | quality-gate、carousel、repurposing |
| `skill-content-postmortem/references/learnings-lifecycle.md` | 结论/证据及窗口/适用范围/待验证或有效或退役/失效原因 | postmortem、月报、profile-manager |

业务记录仍映射：identity=定位/目标，audience=受众和客户语言，style=声音，preferences=明确偏好，platforms=平台策略，memory=可复用经验。长报告与原材料放 `outputs/<项目>/` 及 `assets/`，成品由 `.easel.json` 登记；选题用 `/api/ideas`→`outputs/_ideas.json`，排期用 `/api/schedule`→`outputs/_schedule.json`。经验可引用原始指标，不另建指标库。已就绪/计划/网站草稿/平台发出各有含义，不能互相推断。[画像](../agent-skill/mediasail/references/context.md)、[项目契约](../agent-skill/mediasail/references/outputs.md)、[ideas/schedule实现](../vendor/easel/web/app.py)

产品路线：首批只整理上述差额、现有强制正文和索引；既有Markdown与API已足够承载。海外平台/深度监听/图卡案例作外部可选，工具由Agent选择；暂不纳入第二套画像/日历/发布库、广告/CRM/电商管理、自动私信评论、通用生图剪辑引擎或新的常驻任务。

## 三个落地场景

1. **“接着上次再准备两周，像我平时说话。”** Agent按需看画像、已有日历context、相关成品及改稿依据，从真实空档补具体选题和素材需求。交付两周方案/草稿；需要时写现有schedule。无需重新访谈或审批整月，不建第二张日历。
2. **“这篇教程改成小红书卡片、抖音口播，B站保留深一点。”** 提取独立要点并原生改写；卡片逐页对应真实素材，缺图改版式或补材料；工具自选，查看实际导出，只修错页。项目保存各平台成品和素材，登记真实deliverables及顺序；已就绪不称已发布。
3. **“评论问得多但转化少，看三个对标，告诉我下轮做什么。”** 原话留来源/日期/人群，区分问题与购买障碍；对标结论分事实和推断，用可比真实记录分析，缺转化数据标假设。交付analysis项目和选题；长期经验才按证据回memory，单次先待验证，反证可退役。不自动评论、私信或建监控。

## 许可与边界

只记录原件，不作法律适用推断。Anthropic根及marketing/LICENSE均载Apache-2.0；该提交未见small-business独立LICENSE或树中NOTICE。第4节写有提供许可证副本、修改文件明显说明、保留相关归属通知及存在NOTICE时的处理条件。根LICENSE在标准附录后还有以 `Syntax-file` 开头的异常尾段，marketing/LICENSE未见同段；正式引入前保留原件并确认，不能自行删尾便称完整处理。[根LICENSE][alicense]、[marketing/LICENSE][mlicense]

MarketingSkills是MIT，版权行 `Copyright (c) 2025 Corey Haines`，原件要求副本或实质部分保留版权与许可通知。brand-voice的再次改编来源尚未完整审计。正式引入时逐块记仓库/路径/SHA/许可/改写范围与日期，保留所需原件及下游归属，已有Easel署名继续保留。[MIT原件][mit]、[再次改编尾注][msvoice]

后续验收关注：Agent能按任务找到资料且不被迫全读；局部改稿不升级全套流程；不同工具可完成同一业务契约；证据/推断/经验分开；项目路径和真实发布含义清楚。发帖频次、算法、行业比例、效果百分比、配额和研究样本阈值均不能作为平台官方保证。只有实际使用暴露缺口时，再考虑界面或数据结构改动。

[anthropic]: https://github.com/anthropics/knowledge-work-plugins/tree/a266ab8c3c754a3ccf7a634044fc1595fc06e50e
[sce]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/SKILL.md
[marketing]: https://github.com/anthropics/knowledge-work-plugins/tree/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/marketing
[voice]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/shared/voice-profile.md
[calendar]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/calendar.md
[assets]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/shopify-assets.md
[gotchas]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/gotchas.md
[publishing]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/publishing.md
[canva]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/small-business/skills/social-content-engine/reference/canva-api.md
[brand]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/marketing/skills/brand-review/SKILL.md
[performance]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/marketing/skills/performance-report/SKILL.md
[alicense]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/LICENSE
[mlicense]: https://github.com/anthropics/knowledge-work-plugins/blob/a266ab8c3c754a3ccf7a634044fc1595fc06e50e/marketing/LICENSE
[ms]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/README.md
[social]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/social/SKILL.md
[listening]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/social/references/listening.md
[carousel]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/social/references/carousel-frameworks.md
[product]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/product-marketing/SKILL.md
[strategy]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/content-strategy/SKILL.md
[customer]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/customer-research/SKILL.md
[competitor]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/competitor-profiling/SKILL.md
[editing]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/copy-editing/SKILL.md
[analytics]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/analytics/SKILL.md
[msvoice]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/product-marketing/references/brand-voice.md
[mit]: https://github.com/coreyhaines31/marketingskills/blob/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/LICENSE
