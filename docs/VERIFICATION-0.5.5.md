# MediaSail 0.5.5 验证记录

验证日期：2026-10-19。使用独立合成资料库、打包后的 Windows x64 软件及 GitHub 临时 Windows；不覆盖本机日常安装，不使用真实账号上传或公开发布。

## 功能与桌面边界

- 105 项 Node 检查通过，包含十项新桌面操作检查：固定网址、主窗口与主 frame、中文空格路径、Windows 大小写、链接与路径穿越、缺失目录、权限和系统启动器失败、旧记录字节不变及 preload 边界。
- 本机 Python 共 69 项，68 项通过、一项文件符号链接用例因系统权限跳过；目录联接点测试已实际通过。GitHub Windows 的完整结果将在该轮完成后补充。
- TypeScript／Vite 构建、固定上游补丁逆向校验、730 项业务 payload 哈希及新工作区初始化通过。
- [打包内容核对](evidence/desktop-package-0.5.5.json)：25 个桌面文件与源码逐字节匹配，旧 `desktop/aitoearn` 不再发行。app.asar SHA-256：`507543fbb1adb1ad3c78cb5bafcbe856fe416e3ca3ccc38c0ca3d922a0462d3e`。

三个新方法仅供可信本地主页面使用：`desktopActions.openAitoearn()`、`openProjectFolder(projectName)`、`openAitoHistory()`。没有新增 HTTP 发布接口或任意 URL／文件打开服务。原生平台发布、账号采集及任务退出提醒继续保留。

## 实际打包界面

[浏览器发布专项](evidence/browser-publish-0.5.5.json)六组通过：官网外链不导航；卡片和子目录打开所属一级项目；系统启动器失败保留筛选；未保存归档在外链成功／失败及焦点恢复后保持；真实退出确认拒绝后服务可用；旧记录和分区标记跨三次启动保持，无目录不创建、坏 JSON 不阻塞或被改写。该专项只捕获 shell 目标，分区标记不是登录凭据。

- [项目入口浅色](images/0.5.5/browser-project-light.png)、[深色](images/0.5.5/browser-project-dark.png)、[子目录](images/0.5.5/browser-project-subdirectory.png)。
- [历史入口浅色](images/0.5.5/browser-history-light.png)、[深色](images/0.5.5/browser-history-dark.png)、[目录缺失提示](images/0.5.5/browser-history-missing.png)。部分故障截图背景中的错误是测试主动注入的系统启动失败。
- [未保存归档](images/0.5.5/browser-draft-preserved.png)、[浏览器失败](images/0.5.5/browser-open-error.png)、[文件夹失败](images/0.5.5/browser-folder-error.png)。

[内容库回归](evidence/content-library-0.5.5.json)八组通过，涵盖分类、组合搜索筛选、归档增量保存、外部修改冲突、慢保存与重复提交、损坏登记及正常退出重启。[业务界面回归](images/0.5.5/library-ui-result.json)十一组通过，包含画像、选题、日历未保存编辑、强制账号核验与分析失败保留旧结果；平台响应为合成夹具。[实际媒体](evidence/library-media-0.5.5.json)验证本地 API 与图片／视频原文件哈希一致、预览实际解码，不再执行上传代码。

## 真实默认浏览器与官网地址修正

最初计划地址 `/zh` 被官网按语言重定向到 `/zh-CN/zh`（英文环境为 `/en/zh`），实际 Chrome 页面空白。该未发行候选没有发布；沿官网根地址核对有效中文首页后，将固定入口、前端、文档及测试统一校正为 `https://aitoearn.cn/zh-CN`，重建并重跑全部打包验收。[原始网址观察](evidence/default-browser-initial-url-0.5.5.json)。

[真实默认浏览器验收](evidence/default-browser-0.5.5.json)通过：只读确认 HTTPS 默认关联为 ChromeHTML，从最终打包软件实际点击一次入口，未替换 `shell.openExternal`。Chrome 新标签实际显示中文官网及内容管理／AI 发布入口；MediaSail 仍在原合成项目、没有内嵌网页，测试软件正常退出，测试标签已关闭。[软件入口截图](images/0.5.5/default-browser-launcher.png)、[实际官网截图](images/0.5.5/default-browser-official.png)。未登录、安装插件、上传或发布，不把系统接受打开请求当作网站发布成功。

## Windows 真实升级

待 GitHub 托管 Windows 完成固定官方 0.5.4 到本候选 0.5.5 的真实 NSIS 更新后补充。验收包含原安装位置和登记、同一资料库、闭合的合成 AitoEarn Cookie 分区文件及未完成发送记录原字节、新版缓存、两次正常重启；不读取真实账号或在新版初始化旧 AitoEarn 会话。

## 测试夹具观察与发行文件

首轮并行启动多个独立测试实例时，一次服务探测与绑定竞争触发 Windows 10048；另一轮出现 HTTP ECONNRESET。同一候选改为串行运行后全部通过，正式软件的单实例机制没有变更。真实浏览器夹具最初还修正了面包屑标题的定位方式，之前尚未点击外链。上述夹具结果不算作先前已通过，未放宽业务或升级断言。

最终 Windows x64 安装包：262,990,773 字节，约 250.8 MiB；SHA-256：`67def2e003b3b02b5a5c0f3d0251be2eac320108da52b34d3383a039716392d9`。源码包、更新索引及 GitHub 发布后检查将在对应步骤完成后核对。发行包未配置 Windows 代码签名。
