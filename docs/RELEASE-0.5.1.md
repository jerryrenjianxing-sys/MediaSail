MediaSail 0.5.1：未发行候选，仅缺登记场景补强验证

正常 Windows 原生本机 **0.4.3 → 正式 0.5.0** 已通过真实更新、原目录清理、数据保留和两次重启核验；不为普通本机更新额外发行 0.5.1。[本机正式版报告](https://github.com/jerryrenjianxing-sys/MediaSail/blob/main/docs/LOCAL-UPGRADE-2026-10-15.md)。

本草稿只测试人为移除安装登记的独立场景，不是普通用户安装缺陷的结论，未进入正式更新频道。

- 候选实现从连接资料与官方 0.4.3 的三个 SHA256 核对原位置，进入安装阶段才暂存固定登记，继续调用原卸载器；新客户端明确传递自身安装目录。
- 缺登记的正常真实升级已通过，中文路径、登记、快捷方式、旧程序环境移除及合成数据保留均已核验。
- **旧 Node 被占用时的失败回滚尚未验证通过。** 故障脚本在处理 Win32 对话按钮时失败，最终退出码、登记回滚和解锁重试未完成核验，不能声称全部通过。

草稿五个资产保持不变，不发布。正式下载与更新仍使用 [0.5.0](https://github.com/jerryrenjianxing-sys/MediaSail/releases/tag/v0.5.0)。[候选验证记录](https://github.com/jerryrenjianxing-sys/MediaSail/blob/main/docs/VERIFICATION-0.5.1.md)。
