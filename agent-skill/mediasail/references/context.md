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

还可存在用户自定义 Markdown 文件。GET /api/personas 返回画像列表；GET /api/persona/{name} 返回合并文本；GET /api/persona/{name}/files 返回分文件正文。读写 API 的画像名用 URL 编码。

更新某一维度：
PUT /api/persona/{name}/file
JSON：{"filename":"memory.md","content":"完整的新文件正文"}
返回 {"ok":true,"filename":"memory.md"}。这是替换该文件，不是追加。新建画像也可直接建立目录及 Markdown 文件；刷新画像列表后可见。/api/profile/build 会生成基线画像并可能调用内置 Agent 增强，详情查接口文档。

## 看真实表现

GET /api/analytics/platforms 列出实际支持的平台及当前登录标记。
GET /api/analytics/{platform} 会真实访问平台，可能启动浏览器、耗时数秒到三分钟，并更新本地分析快照；它不是纯缓存读取。登录失败和平台改版会报错。

已有快照与相关资料可查 outputs/_analytics/ 和项目成品；字段依平台而异。把采集时间、平台、样本范围和统计口径一起看，区分实际指标、推测和创作假设，不把缺失数据当作零。

## 让经验回到软件

把长分析放到 outputs/<项目>/ 的报告中，复用成品登记方式。把后续创作真正有用的结论整理进对应画像的 memory.md、preferences.md 或其他合适文件；需要修改定位、风格时可以更新相应维度。自然衔接当前用户任务，不要求每次创作都改画像。

历史聊天的桌面持久状态在数据目录 ui-state.json；后台聊天记录在 home 下的独立 OpenClaw 状态目录。历史上下文与后台会话是不同层，不把文件目录或不存在的接口说成完整聊天检索服务。通常先查项目和画像就足够。
