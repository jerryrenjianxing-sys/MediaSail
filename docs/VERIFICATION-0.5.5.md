# MediaSail 0.5.5 验证记录

验证日期：2026-10-19。使用独立合成资料库、打包后的 Windows x64 软件及 GitHub 临时 Windows；不覆盖本机日常安装，不使用真实账号上传或公开发布。

## 功能与桌面边界

- 105 项 Node 检查通过，包含十项新桌面操作检查：固定网址、主窗口与主 frame、中文空格路径、Windows 大小写、链接与路径穿越、缺失目录、权限和系统启动器失败、旧记录字节不变及 preload 边界。
- 本机 Python 共 69 项，68 项通过、一项文件符号链接用例因系统权限跳过；目录联接点测试已实际通过。[GitHub Windows 完整源码检查](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39210487033)随后确认 105 项 Node 和 69 项 Python 全部通过、无跳过，包含真实文件符号链接；[机器记录](evidence/source-check-0.5.5.json)。
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

[真实安装升级通过](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39210261363)：GitHub 临时 Windows 安装哈希固定的官方 0.5.4，实际首次选择中文空格路径资料库，保存合成画像、项目、平台资料标记、旧面板草稿／creating／uploading 任务以及真实的合成 Cookie 存储文件。旧版正常退出后保存分区文件原字节，使用经过 GitHub digest 和校验文件核对的最终候选执行 `/S --updated --force-run`；更新不传 `/D`，不手工覆盖程序或预设新的安装位置。

安装器真实退出码为 0，0.5.5 自动打开且服务就绪。安装登记与原路径保持，无默认位置旁装；资料库身份、位置及 workspace 沿用，没有重复选库。升级后编辑前共 32 个原文件逐字节保持，其中 22 个来自旧合成 AitoEarn 持久分区；候选没有初始化或读取该会话，未完成发送记录没有被转换或重试。新版安装器缓存和版本凭据正确；项目文件夹动作核对到正确项目路径（捕获 shell 目标，未验收 Explorer 窗口）。登记接口只补分类／摘要，其他字段及成品保持，之后两次正常退出重启通过，没有退出提示需要夹具自动确认。

候选安装观察耗时 303.593 秒，该轮升级作业合计 9 分 29 秒（包含安装基线、升级和验收）。这是临时 Windows 的真实安装观察值，不是用户本机速度或应用内差量下载测速。下载与校验、真实 NSIS 安装和发布后旧客户端发现新版分别记录，不合称完整更新下载链路。

[机器记录](evidence/content-upgrade-0.5.5.json)、[真实安装进度](images/0.5.5/upgrade-progress.png)、[升级后内容库](images/0.5.5/upgraded-content-library.png)。合成会话文件保留不等于真实账号登录有效性验收，本轮没有登录或使用真实账号。

## 测试夹具观察与发行文件

首轮并行启动多个独立测试实例时，一次服务探测与绑定竞争触发 Windows 10048；另一轮出现 HTTP ECONNRESET。同一候选改为串行运行后全部通过，正式软件的单实例机制没有变更。真实浏览器夹具最初还修正了面包屑标题的定位方式，之前尚未点击外链。云端首次源码检查发现权限故障注入未匹配 Windows TEMP 的规范路径；测试改为先 realpath 再比较，并断言故障确实命中，之后完整检查通过，运行代码及安装包未因此改变。上述夹具结果不算作先前已通过，未放宽业务或升级断言。

最终 Windows x64 安装包：262,990,773 字节，约 250.8 MiB；SHA-256：`67def2e003b3b02b5a5c0f3d0251be2eac320108da52b34d3383a039716392d9`。更新索引 SHA-512 与安装包相同；差量索引解压后 12,604 个块完整覆盖安装包、块大小和校验条目数量一致。14 个 Skill 本地链接有效，个人元数据保持 `allow_implicit_invocation: false`。最终源码 ZIP CRC 完整性检查通过，不包含运行时连接文件、账号凭据、浏览器状态文件或已移除的桌面 AitoEarn 适配目录。发行包未配置 Windows 代码签名。

## 正式发布与原客户端检查

[v0.5.5](https://github.com/jerryrenjianxing-sys/MediaSail/releases/tag/v0.5.5)于 2026-10-19 14:43:59（北京时间）发布为最新版。五项资产的 GitHub 服务器 SHA-256 与本地一致，之前十三个版本的文件保持原样，包含未发行的 0.5.1 草稿。[资产核验记录](evidence/assets-0.5.5.json)。源码包为 70,678,241 字节，SHA-256：`32fc0e496f94d30127133e3288b9cc950d31eca03b3584dd48004a5e5b6fc186`。

使用未修改的打包客户端、原 GitHub electron-updater 配置和独立资料库：0.5.4 检查返回 available、目标 0.5.5；0.5.5 检查返回 current、“当前已是最新版本”。两次均未请求下载或安装，已传输字节为零，测试进程已退出。[旧版检查记录](evidence/content-update-0.5.4-to-0.5.5.json)、[旧版更新窗口](images/0.5.5/update-check-0.5.4.png)、[新版检查记录](evidence/content-update-0.5.5-to-0.5.5.json)、[新版更新窗口](images/0.5.5/update-check-0.5.5.png)。

发布后结果仅追加至仓库，不替换已正式发布的安装包和源码资产。本机日常程序与资料库保持原样，本轮仅使用隔离资料验收。
