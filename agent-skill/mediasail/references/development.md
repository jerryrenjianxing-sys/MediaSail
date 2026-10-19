# 源码、配置与维护

仓库：https://github.com/jerryrenjianxing-sys/MediaSail
基线：Easel fb80ae6dd6fc26f5553efcb293ee6d93ef253f02。MediaSail 的版本与运行依赖以本版 package.json、runtime-lock.json 为准。

## 本机地图

agent-connection.json：
- executable：正在运行的 MediaSail 程序。
- libraryRoot、libraryId：当前资料库根目录与身份；切换资料库后以新连接资料为准。
- workspace：可写 Easel 工作目录；profiles、outputs、skills、web、.env 等在此。
- skillDir：当前资料库 agent-skill/mediasail 下的可写完整 Skill。
- python、environment：业务 Python 与隔离目录；不承诺内置 Node/OpenClaw 或通用媒体工具。
- selectedProfile：软件当前选择的画像提示，可为空；不替代用户明确任务对象。
- dataDir：当前资料库 runtime 下的桌面运行数据；兼容旧版数据布局的实例仍以实际字段为准。
- connectionFile：正式连接文件，位于 dataDir。discoveryFile：AppData 中保留的发现入口，指向正式连接文件。
- baseUrl、instanceId：当前服务和随机实例编号；重启可变化。

资料库 libraryRoot 下：
- workspace：配置、素材、项目、画像、业务脚本与运营方法，控制台和外部 Agent 共享同一份。
- agent-skill/mediasail：接入 Skill、资料索引与辅助脚本。
- runtime：下列运行状态与平台资料。设置中的“更换资料库”只切换位置，不搬运文件。0.5.3 首次启动重新选库一次，之后更新沿用选择；旧资料原地保留，不自动带入新库。新库需重新配置画像及登录账号。以当前连接资料为准，不向旧路径回存。

dataDir（runtime）下：
- home：隔离 HOME、平台浏览器资料及可能存在的旧 OpenClaw 历史；不再启动网关。
- Partitions：可能保留旧版 AitoEarn 独立登录分区；新版不再加载或迁移到默认浏览器。
- ui-state.json / .previous：主题和界面偏好及备份；旧聊天只作为历史归档。
- aitoearn/imports.json：旧版发送面板的待发送正文、素材顺序和草稿导入记录，原位保留，不自动续传或重试。设置中的历史存档入口可打开所在目录；部分编辑可能只在此文件内，尚未回存项目。结果未明时先到官网原账号核对，不推断已发布或已取消。
- logs：桌面、后台、更新日志。
- agent-connection.json：无凭据的连接资料，退出后标记 stopped。

## 修改软件

可以按用户目标修改画像、脚本或软件。画像、项目等属于用户数据；安装目录的程序文件属于安装包管理，下一次升级可能替换其中的改动。资料库内的方法、业务脚本和接入 Skill 采用基线对比：未修改文件跟随新版，本地修改保持生效；上游也变化时在 runtime/upgrade-backups 保留本地与新版两份并提示冲突，由用户或 Agent 按任务合并，不默默覆盖。需要分发程序本身的代码改动可落到源码仓库并重新构建。

源码仓库的 desktop 是 Electron 主进程与更新、持久状态和受限的浏览器打开能力；bridge 适配原后端；agent-skill 是本 Skill；vendor/easel 是固定版本的上游工作副本，patches 保留可复现变更。前端改动需导出补丁，并更新构建产物。不要把打包后的 app.asar 当成源码仓库的替代品。

README、scripts/build.ps1、scripts/export-patches.cjs 和 docs/ 中有构建与验证流程。轻量版只提供核心服务与业务 Python 依赖；Node/OpenClaw、FFmpeg、自动化浏览器与重型创作/推理模型不随安装包分发。账号采集/登录/发布通过 Playwright 使用系统 Chrome/Edge，可用 EASEL_BROWSER_EXECUTABLE 指定浏览器程序位置，仍使用软件自己的平台资料目录。通用创作工具由外部 Agent 按任务准备。

维护源码时先读仓库 AGENTS.md 和按需的 docs/DEVELOPMENT.md，按任务使用用户指定的 mattpocock-skills 插件。准备锁定依赖后运行 npm run check，统一检查 Node、Python、前端、接口资料及补丁复现；该命令不下载依赖，也不替你回写接口资料或补丁。源码检查、打包页面验收和真实安装升级是不同检查，完成情况按实际执行记录。

工作目录 skills/knowledge-index.json 是本版真实资料索引，skills/business-tools.md 与 curation-report.json 列出保留脚本、方法整理和退出文件。旧技术目录名 skills/openclaw 为兼容路径，不表示要安装 OpenClaw。原始工具实现留在固定上游与 Git 历史，不另提供旧工具包。scripts/curate-knowledge.cjs 在 staged payload 上整理，不删除用户历史或改动固定上游源文件。

已有桌面 HTTP 服务只供本机访问。AI 发布仅打开固定官网 https://aitoearn.cn/zh-CN，不在 Electron 中加载第三方页面；默认浏览器中的官网不会获得 MediaSail 的本地文件或命令接口，也不能直接读取资料库。Skill 不增加远程 shell。源码修改与发布仍根据当前用户任务进行，使用 Skill 本身不会自动替用户部署或发布内容。
