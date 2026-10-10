# 源码、配置与维护

仓库：https://github.com/jerryrenjianxing-sys/MediaSail
基线：Easel fb80ae6dd6fc26f5553efcb293ee6d93ef253f02。MediaSail 的版本与运行依赖以本版 package.json、runtime-lock.json 为准。

## 本机地图

agent-connection.json：
- executable：正在运行的 MediaSail 程序。
- workspace：可写 Easel 工作目录；profiles、outputs、skills、web、.env 等在此。
- skillDir：当前安装包提供的完整 Skill。
- python、node、environment：内置运行环境及隔离目录。
- dataDir：桌面数据目录；默认 %LOCALAPPDATA%\ElectronEasel，名称是兼容旧版本的技术标识。
- baseUrl、instanceId：当前服务和随机实例编号；重启可变化。

dataDir 下：
- workspace：配置、素材、项目与画像。
- home：隔离 HOME 和 OpenClaw 状态、平台浏览器资料。
- Partitions：AitoEarn 持久登录分区。
- ui-state.json / .previous：聊天列表、主题和界面偏好及备份。
- aitoearn/imports.json：草稿导入记录。
- logs：桌面、后台、更新日志。
- agent-connection.json：无凭据的连接资料，退出后标记 stopped。

## 修改软件

可以按用户目标修改画像、脚本或软件。画像、项目等属于用户数据；程序文件属于安装包管理的文件，下一次升级可能替换本机改动。需要持久维护的代码改动建议落到源码仓库并重新构建。

源码仓库的 desktop 是 Electron 主进程与更新、持久状态、AitoEarn 集成；bridge 适配原后端；agent-skill 是本 Skill；vendor/easel 是固定版本的上游工作副本，patches 保留可复现变更。前端改动需导出补丁，并更新构建产物。不要把打包后的 app.asar 当成源码仓库的替代品。

README、scripts/build.ps1、scripts/export-patches.cjs 和 docs/ 中有构建与验证流程。完整 Windows 包较大，含 Python、Node、OpenClaw、浏览器和 FFmpeg；仅改前端或 Skill 时通常无需重新下载运行环境。

已有桌面 HTTP 服务只供本机访问，远程 AitoEarn 页面没有本地文件和命令权限。Skill 不增加远程 shell，也不改变这些现有边界。源码修改与发布仍根据当前用户任务进行，使用 Skill 本身不会自动替用户部署或发布内容。
