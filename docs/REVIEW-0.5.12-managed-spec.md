# 0.5.12 Spec 独立审查

基线 `v0.5.11` → `421f89c`，并复核当前修复工作区。

原 **P2 已修复**：普通 `doctor` 曾同步其他 Agent 的全局 BrowserSkill，违反 SPEC:8“禁止启动同步其他 Agent Skill”及 SPEC:20“无……全局 Skill 安装”。适配补丁:139、177 现提前返回，分别隔离诊断与 session start 的隐含同步；:189 禁止工具自行更新。

该切片早期适配 EXE（SHA-256 `2e305f6ed069ec03764e90dd66a8fbb19d1546b4228868be394b7f9f1a9ba7f5`）实测：预检查排除真实安装后，假 Hermes 的 SKILL/来源标记及文件清单在 doctor、私有 daemon 的 session start 前后完全一致；后者进入会话路径，35 秒后因合成浏览器不存在明确失败，未打开网页。update 被拒绝且 EXE 字节不变。证据：`%TEMP%/MediaSail-review-fixed-Wp0HWj/result.json`。该早期编译候选不发行。

12 文件补丁复现通过；CLI/扩展的 managed/build 身份、无私有 bootstrap 的发行 ZIP、helper 校验通过。`browser.ps1:153,163,245` 核对构建、原 daemon 路径与协议，未确认新增实质问题。

本轴剩余 0 项。未执行的完整安装升级、同 Release 源码及发布仍是待验项；本次未复验成功浏览器会话，不宣称发行通过。未修改产品代码。

最终增量复审确认 GNU 目标 EXE `5cd02e7aeb2a8ff2fe1326af41140d84f979a2d80c76597b9276eb02dc559694` 与锁及 bundle `0daa5c09136126a3719fca37bd048fd89879427a21fff64609ab3f7cfa266028` 一致；12 文件补丁重放、CLI/扩展身份、helper 和源码 ZIP 对应锁/补丁核验通过。短缓存保留完整指纹校验，兼容旧 64 位目录。

第二轮安装验收使用测试自有的内层 Windows Job 管理每条 CLI 命令，允许候选工具按原实现脱离该短命命令，但仍处于 runner 外层 Job；没有修改外层限制、产品、原命令或预启动 daemon。命令退出后才继续原回执的实际操作；覆盖安装后仍不重新 connect，断言和清理失败均向外传播。此环境适配无 Spec 偏差；不表示原始禁止 breakaway 的所有宿主均可运行。完整实测结果另见验证记录。
