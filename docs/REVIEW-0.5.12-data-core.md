# 0.5.12 数据切片：两轴审查

固定基线：`v0.5.11` / `1bb16b42b4aa29bb1f53b83f336f87562c208341`。初次审查 HEAD：`2c74572`。命令 `git diff v0.5.11...HEAD`；范围含此前 `3076140` 的 0.5.11 发布证据及本次数据切片。需求见 [SPEC](SPEC-0.5.12.md)。两位独立子 Agent 使用 fresh context 并行进行 Standards 与 Spec，之后定向复核工作区修复。

标准来源：AGENTS.md、docs/DEVELOPMENT.md、GLOSSARY.md、vendor/easel/CONTRIBUTING.md，以及 matt code-review 的启发式基线。待做的浏览器与安装发行门槛以[验证记录](VERIFICATION-0.5.12.md)为准，不当成已经交付。

## Standards

初次报告为 1 处文档标准违例、1 项启发式建议，均为低优先级：

- **P3，标准违例**：ObservationStore 新增 `ProfileLock(self.directory, timeout=10)`。上游 CONTRIBUTING.md 的超时单一来源规则要求调用处不要各写预算，新增硬编码可能使以后调整遗漏。
- **P3，possible Mysterious Name**：AccountObservations.tsx 的 `latest` 实际优先选择最新有效记录，仅在无有效记录时选择最新诊断记录；名称未揭示这个分支。这是可读性判断，不是硬性规范违例。

定向复核：新增调用已改为 `ProfileLock(self.directory)`，复用既有公共默认预算，不另设观测预算；函数改为 `newestUsableOrNewest` 并同步调用。两项本轮新增问题均消除，实际源码无剩余实质问题；补丁随后显式导出。

**本轴：原始 1 项规范违例 + 1 项启发式建议，均已修正；无剩余。原始最高优先级 P3。**

## Spec

已知发行阻塞：需求要求“双浏览器实际连接是发行门槛”，还包括独立缓存/sessionRef、真实业务回存、安装升级及发行资产。它们仍在验证记录中明确待做，本轮未宣称正式发行完成。

已实现切片的初次报告有 2 项 P2：

- **P2，损坏记录阻断列表**：需求要求“损坏记录保留并明确报告，不隐藏其他正常记录”。`_read` 原先用规范化内容核对 hash，却返回未经校验的原 metadata；producer 被改为对象时仍可能通过 hash 检查，HTTP response_model 校验失败，整份列表 500。
- **P2，额外业务字段静默删除**：需求要求保留原指标、同编号不同内容返回冲突。输入允许 extra 字段，normalize 白名单却丢弃 views 等数据，warnings 恒空；123 与456可能得到同一 hash，成功回执无法反映实际保存情况。

修复后实际 HTTP 回归验证：producer 必须为有效固定来源，importedAt 必须是正有限数，读回规范化内容及已核对元数据；坏记录单独报错。额外业务输入保存在 extensions，原提交工具来源保留在 extensions.producer，回执列出警告；这些值进入 hash，固定编号修改 views 会冲突，原输入重复仍复用。

定向复核又发现同根边界：合法 JSON 整数 `10**400` 会令 math.isfinite 溢出。已补 importedAt、fetched_at、followers 三种损坏场景，统一有限数检查捕获溢出；实际 HTTP 列表仍返回其他正常记录，原件保留。

最终 Spec 复核：12 项专项测试通过，原两项及其溢出边界已修复；本数据切片未发现剩余实质问题。没有可确认的范围扩大。

**本轴：原始 2 项实质问题及同根补漏均已修正；数据切片无剩余，完整发行门槛仍未完成。原始最高优先级 P2。**
