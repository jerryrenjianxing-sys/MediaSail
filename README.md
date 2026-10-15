# MediaSail

<img src="branding/MediaSail-app-icon.png" alt="MediaSail" width="112">

面向外部 Agent 的运营知识与内容工作台。MediaSail 保存画像、历史表现、运营经验、素材与成品，提供账号采集、业务统计和发布能力；由你熟悉的 Agent 自主研究、解读、策划、创作与回存。

**[下载 Windows x64 安装包](https://github.com/jerryrenjianxing-sys/MediaSail/releases/latest)** · [验证记录](docs/VERIFICATION-0.5.0.md) · [更新机制](docs/UPDATES.md)

## 使用与连接 Agent

安装 MediaSail-0.5.0-win-x64-Setup.exe。首页左侧进入控制台，右侧复制 Skill，粘贴给同一台电脑上支持本地文件和工具的 Agent。已有首页布局、紫色品牌、Agent 图标和亮暗动画保持一致。

软件内置精简 Python 与业务依赖，不需要配置聊天模型；不再内置 OpenClaw、聊天、独立 Node、FFmpeg、专用浏览器或通用创作模型。账号网页操作使用已配置浏览器，或检测本机 Chrome、Edge；缺浏览器只影响对应操作，不阻止软件启动。

画像建档、编辑、账号数据回写、采集、统计、内容库、选题、日历、平台登录和发布继续提供。画像增强、深度解释及策略创作由外部 Agent 根据完整专业方法完成。Skill 介绍真实资料、路径和工具，不规定 Agent 用什么创作工具，不要求每轮执行固定流程，也不自动安装进其他 Agent 的全局配置。

完整 Skill 随软件提供，连接文件兼容端口变化与中文路径。现成业务计算可通过内置 Python 调用；通用创作环境由 Agent 自选。成品按项目目录及元数据登记，分析经验可更新回画像。内容库和画像页面可刷新查看外部更新；未保存编辑不会自动覆盖。

## AI 发布

侧栏内嵌 AitoEarn 中国站，沿用独立登录会话。内容库选择“发送到 AI 发布”，检查正文、有序图片或单个视频及现成封面，再创建草稿。最终账号、平台、排期和发布仍在官方页面完成。

AitoEarn 是联网服务，不随包部署后台。软件不提供外部 Agent 草稿 HTTP 接口；需要官方插件的操作沿用外部浏览器。适配使用网站现有接口，变化时可能需要更新。[兼容说明](desktop/aitoearn/COMPATIBILITY.md)。

## 更新与旧程序清理

主页面就绪后约15秒自动检查GitHub新版，显示可关闭横幅；设置、侧栏和托盘也能检查。用户选择下载、校验、重启安装，不自动下载或安装，也不发行过渡版。

升级沿用原安装标识和目录，先正常卸载旧程序，再安装新程序，移除旧的大型运行环境。卸载失败即停止并记录日志，不大范围删除目录兜底。新版启动后只清理本软件管理且能识别版本的过期更新安装包，保留当前差量更新缓存。GitHub旧Release和用户自行保存的安装包不删除。

用户数据继续在原位置；卸载默认保留。为兼容历史版本，数据目录仍使用旧技术名称：

    %LOCALAPPDATA%/ElectronEasel
      workspace/             画像、配置、素材、成品、分析与业务脚本
      home/                  原平台浏览器资料与旧后台状态
      Partitions/            AitoEarn网页登录状态
      aitoearn/              草稿选择、上传记录和回执
      ui-state.json          主题、画像选择、草稿等界面状态
      history-archive/0.5.0/  旧聊天归档，原始记录也保留
      agent-connection.json  当前实例、真实路径与画像选择提示，无密钥
      logs/                  服务、安装和更新日志

旧聊天停止续跑，可从设置打开存档目录。用户修改的脚本、素材及已进入工作目录的旧演示内容不会为了瘦身被清除。关闭窗口留在托盘；主动退出只结束软件自己的服务和业务任务，外部Agent任务由其环境负责。

## 开发与构建

固定基线：[ZJU-REAL/Easel fb80ae6](https://github.com/ZJU-REAL/Easel/tree/fb80ae6dd6fc26f5553efcb293ee6d93ef253f02)。完整修改见 patches/easel-desktop.patch；知识整理在打包暂存区执行，不覆盖用户资料或原上游知识源。源码包包含对应源码、前端、构建脚本及依赖锁。

Windows构建机需要 Git、uv、PowerShell 和用于引导的Python。执行 scripts/build.ps1：获取固定基线、应用补丁、准备精简业务环境、构建前端、整理完整方法及业务工具、核对清单，再构建NSIS安装包。独立Node只作为构建工具，不进入发行运行环境。

| 部件 | 版本 |
|---|---|
| MediaSail | 0.5.0 |
| Electron / electron-builder | 44.7.0 / 26.15.3 |
| electron-updater | 6.8.9 |
| Python | 3.11.15 |
| 构建用Node | 24.21.0 |

业务依赖固定于 requirements-business.lock，实际组件及许可证见 licenses。npm test运行测试；npm run dist生成安装包、blockmap和latest.yml；scripts/source-bundle.py创建匹配源码包，scripts/verify-release.cjs核对校验并生成SHA256SUMS.txt。产物在仓库外 ../../outputs/MediaSail/release-0.5.0。

运行打包版UI验收时使用main分支最新测试脚本，并同时隔离`EASEL_DESKTOP_DATA`与`LOCALAPPDATA`。更新组件独立使用后者定位缓存，只改用户数据目录不能隔离缓存。0.5.0发布后的测试脚本已补上这一设置；安装包和业务代码未因此变动。

## 验证与来源

发布前使用隔离测试数据与临时Windows环境，不覆盖本机日常安装。真实平台登录和公开发布由用户验收，测试不代表已在真实账号成功发布。当前发行包未配置Windows代码签名证书。

桌面适配使用Apache-2.0；Easel及各组件保留原许可证、作者署名和NOTICE。Electron/Chromium、Python、Playwright及其依赖各自条款不因根许可证改变。MediaSail为独立维护的发行版，不代表Easel或AitoEarn官方产品。见[NOTICE](NOTICE)、[LICENSE](LICENSE)及[第三方清单](licenses/THIRD-PARTY-NOTICES.txt)。
