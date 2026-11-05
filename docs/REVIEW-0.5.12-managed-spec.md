# 0.5.12 Spec 独立审查

基线 `v0.5.11` → `421f89c`，并复核当前修复工作区。

原 **P2 已修复**：普通 `doctor` 曾同步其他 Agent 的全局 BrowserSkill，违反 SPEC:8“禁止启动同步其他 Agent Skill”及 SPEC:20“无……全局 Skill 安装”。适配补丁:139、177 现提前返回，分别隔离诊断与 session start 的隐含同步；:189 禁止工具自行更新。

实测新版 EXE（SHA-256 `2e305f6ed069ec03764e90dd66a8fbb19d1546b4228868be394b7f9f1a9ba7f5`）：预检查排除真实安装后，假 Hermes 的 SKILL/来源标记及文件清单在 doctor、私有 daemon 的 session start 前后完全一致；后者进入会话路径，35 秒后因合成浏览器不存在明确失败，未打开网页。update 被拒绝且 EXE 字节不变。证据：`%TEMP%/MediaSail-review-fixed-Wp0HWj/result.json`。

12 文件补丁复现通过；CLI/扩展的 managed/build 身份、无私有 bootstrap 的发行 ZIP、helper 校验通过。`browser.ps1:153,163,245` 核对构建、原 daemon 路径与协议，未确认新增实质问题。

本轴剩余 0 项。未执行的完整安装升级、同 Release 源码及发布仍是待验项；本次未复验成功浏览器会话，不宣称发行通过。未修改产品代码。
