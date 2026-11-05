# 0.5.12 专用浏览器 Standards 复审

基线 `v0.5.11`；规范来源为根 AGENTS.md、docs/DEVELOPMENT.md、词汇表，以及 matt code-review 的 smell baseline。审查覆盖提交及最终候选工作区；没有运行日常安装或资料库。

原先重复的 daemon 启动/恢复核验已集中到 `Ensure-GroupDaemon`，核对原缓存进程、版本、协议和构建身份；扩展和打包器检查实际编译标识。最终 GNU 目标、短缓存完整指纹、原许可按字节保存均未发现新增规范违例。

增量审查发现并修正：

- 验收资源清理前一步抛错会保留活动 HTTP server：现在逐项收集错误，finally 关闭 server，清理失败仍阻止通过。
- 缺失 crates 目录被静默跳过：先以错误路径实跑复现成功错误，再增加实际 CLI 红绿测试，逐项核对固定清单中 226 个源归档的存在和 SHA-256。
- 同一修复对本地 workspace crate 的 null source 处理错误：正确输入实际执行捕获后，将 null 归一为空字符串并重新打包，不以负向测试代替成功路径。

最终只读复审无剩余规范违例或需整改的 smell。此结论不表示真实安装或 GitHub 发布已经通过；执行证据单列于 VERIFICATION-0.5.12.md。
