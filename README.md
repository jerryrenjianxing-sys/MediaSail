# MediaSail

<img src="branding/MediaSail-app-icon.png" alt="MediaSail" width="112">

面向内容运营的 Windows 桌面工作台：保留 Easel 的对话、素材、内容库、日历、
模型配置与平台工作流，集成 AitoEarn 中国站的「AI 发布」，支持从 GitHub 更新。

**[下载 Windows 64 位完整安装包](https://github.com/jerryrenjianxing-sys/MediaSail/releases/latest)** ·
[更新机制](docs/UPDATES.md) · [验证记录](docs/VERIFICATION-0.4.2.md)

## 使用

安装 `MediaSail-0.4.2-win-x64-Setup.exe`，从桌面或开始菜单打开。
内置 Python、独立 Node.js、OpenClaw、浏览器自动化环境及 FFmpeg，无需用户另装开发工具。
在设置中配置自己的模型服务，在原版流程中登录平台账号。模型服务、社交平台、
AitoEarn 和部分按需资源需要联网；模型额度和平台账号不包含在安装包中。

关闭窗口会隐藏到托盘，后台任务继续运行。双击托盘图标重新打开；右键选择「退出」
会停止本软件启动的服务。有任务运行时先提醒。默认不开机自启，电脑关机或睡眠时不执行任务。

## 连接 Agent

左侧第一行「连接 Agent」→「复制 Skill」，粘贴给同一台电脑上的 Hermes、Codex 或其他支持本地文件和工具的 Agent。
MediaSail 提供画像、运营分析、素材、历史内容和工具背景，由 Agent 自主研究、策划、创作、复盘或维护软件。
Skill 分为简短入口和按需查阅的资料，不规定固定创作流程，也不自动修改外部 Agent 的全局配置。

完整 Skill 随安装包提供；连接说明包含当前本机路径，可下载整包。辅助脚本使用内置 Python/Node，
通过 `agent-connection.json` 识别当前服务，兼容端口变化和中文路径。成品可通过现有项目元数据工具登记到内容库。
AitoEarn 的草稿导入仍使用桌面发送面板，Skill 不宣称存在未实现的外部接口。

## AI 发布

侧栏「AI 发布」内嵌 [AitoEarn 中国站](https://aitoearn.cn/zh-CN)，保留原版页面和独立登录状态。
内容库中选择「发送到 AI 发布」，检查正文、图片顺序或单个视频与封面，选择草稿箱后创建草稿。
支持 JPG、PNG、WebP、MP4、MOV。视频可以选封面，也可用内置 FFmpeg 提取首帧。
只创建草稿；发布账号、平台、排期及最终发布仍在 AitoEarn 原版页面操作。

这是官方在线服务，不是本地部署的 AitoEarn。依赖官方浏览器插件的功能可打开外部浏览器使用。
草稿适配器调用网站现有接口，无需另填 API Key；这不是官方承诺稳定的公开 API。
网站接口变化时可能需要更新适配器。创建结果不明时必须先核对，重复点击不会直接重复创建。
实现边界见 [COMPATIBILITY.md](desktop/aitoearn/COMPATIBILITY.md)。

## 更新与数据

设置 →「软件更新」→「检查更新」→ 下载新版 → 重启并安装。侧栏和托盘入口也可使用。0.4.0 起，主界面就绪后自动检查版本，发现新版显示可关闭的横幅。关闭后本次运行不再提示，下次启动再检查。
点击「查看更新」进入原更新窗口。
不会自动下载大包，也不会在普通退出时擅自安装。先完成下载和校验，再替换程序文件。
支持时尝试差分下载，失败则下载完整安装包；并非每次只需下载几 MB。
0.3.3 起，安装过程显示独立进度窗口，成功后自动重新打开。从旧版升级到 0.3.3 也会显示。
完整运行环境仍需解压，安装可能持续数分钟。聊天、草稿和界面偏好改为独立文件保存，后台换端口不影响读取。
首次升级会备份并汇总旧端口的有效聊天，冲突内容保留为“恢复副本”，原始存储不删除。

原 ElectronEasel 0.1/0.2 用户需要先手动安装一次 MediaSail 0.3，之后即可使用软件内更新。
为兼容旧版，安装身份和数据位置仍保留旧名称：

```text
%LOCALAPPDATA%\ElectronEasel
  workspace/       配置、画像、素材、内容和会话
  home/            隔离的 OpenClaw 状态与平台浏览器数据
  Partitions/      AitoEarn 等网页会话
  aitoearn/        待发送内容、草稿箱选择、上传与草稿回执
  ui-state.json   跨端口共享的聊天、草稿和界面偏好
  ui-state-migration-0.3.3/  旧存储快照和恢复前的有效记录
  logs/            本地服务和更新日志
  agent-connection.json  无凭据的当前实例、路径和运行环境资料
```

升级保留用户数据；卸载默认保留。备份时先从托盘退出，再复制整个目录。
备份及日志可能包含私人内容和账号信息，不要上传到公开仓库。

## 开发与打包

基线固定为 [ZJU-REAL/Easel @ fb80ae6](https://github.com/ZJU-REAL/Easel/tree/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02)。
本仓库存放桌面适配、补丁和锁文件，构建时获取原版源码。发行页的 source.zip 还包含对应的
Easel 源码快照与已编译前端。补丁包含 Windows 适配、模型名称兼容、AI 发布及品牌入口。

Windows x64 构建机器需要 Git、uv、PowerShell 和用于引导的 Python。
准备与 `ffmpeg-lock.json` 一致的 Gyan FFmpeg 8.1.1 full build，运行
`python scripts/prepare.py ffmpeg <解压后的目录>`，然后执行 `scripts/build.ps1`。
不要在不核对版本和来源的情况下更新锁文件。构建 Python 需要 Pillow 用于 ICO 格式编码。
构建脚本不会修改系统 Python、Node.js、OpenClaw 或 Windows 长路径策略。

| 部件 | 固定版本 |
|---|---|
| MediaSail | 0.4.2 |
| Electron / electron-builder | 44.7.0 / 26.15.3 |
| electron-updater | 6.8.9 |
| Node.js / Python | 24.21.0 / 3.11.15 |
| OpenClaw / FFmpeg | 2026.9.9 / 8.1.1 |

`npm test` 运行自动测试；`npm run pack` 构建可运行目录并验证全部 payload 文件哈希；
`npm run dist` 创建 NSIS 安装包、blockmap 和 latest.yml。默认产物目录位于仓库外的
`../../outputs/MediaSail`。`python scripts/source-bundle.py` 创建匹配的源码快照。
发布步骤见 [UPDATES.md](docs/UPDATES.md)。单纯推送源码不会触发用户端升级。

## 验证与边界

测试覆盖数据升级、目录隔离、端口占用、托盘、多开唤起、AI 草稿导入，以及更新检查、
下载校验与任务中断提醒。模拟账号与模拟模型测试不代表真实平台已发布成功。
真实模型账号及各平台登录/发布由使用者自行验收；本仓库不提供密码、密钥或登录状态。

当前发行包未配置 Windows 代码签名证书。只使用 loopback 本地服务，AitoEarn 网页无本地文件
和命令执行权限。退出清理由本软件启动的进程树，不结束其他软件的进程。

## 开源来源

桌面适配代码使用 Apache-2.0。Easel、Electron、OpenClaw、Python、Node.js、FFmpeg 及其
依赖分别保留原许可证，GPL/AGPL 等组件不因本仓库根许可证而改变条款。
见 [NOTICE](NOTICE)、[LICENSE](LICENSE) 和 [第三方说明](licenses/THIRD-PARTY-NOTICES.txt)。
MediaSail 为独立桌面发行版，不代表 Easel 或 AitoEarn 官方产品。
