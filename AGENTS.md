# MediaSail 开发约定

## 使用 mattpocock-skills

本项目后续开发使用用户指定的 `mattpocock-skills` 插件。按任务选择并阅读相应技能：设计与重构用 `codebase-design`，故障排查用 `diagnosing-bugs`，重要行为变更用 `tdd`，改动审查用 `code-review`，业务概念用 `domain-modeling`，Agent 文档用 `writing-for-agents`。需要研究、原型或 PR 时使用对应技能。

具体流程与触发条件见 [开发方法](docs/DEVELOPMENT.md)。使用插件提供的技能及其原有元数据；个人安装或用户自建技能仍仅在用户明确指定时使用，并保留 `policy.allow_implicit_invocation: false`。

## 修改依据

- 修改前明确用户要得到的行为、兼容要求和验收依据。已确认的任务方案可复用，新增测试的 Interface 与 Seam 按所用技能先约定。
- 设计以调用者能获得的能力、维护时改动是否集中为依据；保留已有有效 Module，每次完成一个可独立验收的业务切片。
- 涉及资料库、安装升级、平台账号或共享文件时，阅读 [开发方法中的兼容约定](docs/DEVELOPMENT.md#兼容约定)。
- 修改业务能力时同步核对界面、现有工具、Agent 文档和发行产物；完成情况以实际执行的检查为准。

这些约定服务于 MediaSail 源码开发。产品随附 Skill 继续让外部 Agent 自主选择研究、创作和实现工具。
