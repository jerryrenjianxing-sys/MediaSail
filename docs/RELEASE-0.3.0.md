MediaSail 0.3.0 — Windows 64 位完整安装版

- 项目正式命名为 MediaSail，采用紫色 M / 帆形图标。
- 新增侧栏「软件更新」与托盘「检查更新」，从本仓库 GitHub Releases 获取稳定版本。
- 启动时检查，点击后下载；下载完成后由用户决定何时重启安装。有后台任务时先提醒。
- 支持 NSIS 差分下载，无法差分时下载完整包。下载失败不会删除已安装的旧版。
- 延续 Easel 原版工作流及 AitoEarn「AI 发布」与成品带入草稿功能。

首次安装或从 ElectronEasel 0.1 / 0.2 升级，请下载 `MediaSail-0.3.0-win-x64-Setup.exe`。
之后可在软件内更新。数据目录继续使用 `%LOCALAPPDATA%\ElectronEasel`，配置、内容及未过期的
登录状态沿用；卸载默认保留。完整安装包包含 Python、Node.js、OpenClaw、浏览器环境和 FFmpeg。

`latest.yml` 和 `.blockmap` 供软件更新使用，无需手动打开。`source.zip` 包含本版适配源码、
锁文件及对应 Easel 源码快照。文件校验值见 SHA256SUMS.txt。

模型服务和社交平台需要联网及使用者自己的账号。AitoEarn 仍为官方在线服务，仅自动创建草稿，
不会自动立即发布。真实模型及社交平台账号由使用者自行登录验收。当前包未配置 Windows 代码签名证书。
