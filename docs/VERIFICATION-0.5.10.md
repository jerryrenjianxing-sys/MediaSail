# MediaSail 0.5.10 验证记录

状态：源码、打包界面、独立 Agent、双轴审查、真实隔离升级及公开更新检查均通过，0.5.10 已正式发布。以下安装验收使用同一候选，不操作日常安装和资料库。

## 已完成的反馈循环

- 知乎真实 publish_answer 调用路径、外部浏览器边界合成：旧版停在问题页会 success:true，红测失败；修复后 verified、unverified、login_required、dry_run 分开，目标问题/域名/旧回答用例通过。
- 公众号可选凭证 API：合成网络超时在旧版触发重试，修复后单次创建；两种草稿、503、重定向、缺失回执、明确拒绝及有效 media_id 通过。未知异常携带原始 payload，CLI 保存独立恢复记录、非零退出，不自动重放。不代表平台端“恰好一次”。
- 热点 HTTP：旧版字符串榜单丢失，红测失败；修复后字符串、大小写及嵌套 target、空榜/失败分离、缓存时间保留通过。
- 旧 0.5.9 实际打包账号页：挂起旧网络校验、完成新校验后再释放旧响应，出现“旧账号 != 新账号”红测。0.5.10 同一可见界面用例通过。
- 打包界面：关闭后迟到 start 响应不重开弹窗；慢状态请求不重叠；过期后重取及二维码版本通过。热点页/工作台显示来源状态与原始时间；Asia/Shanghai 00:30 的工作台过滤、选题排期和发布草稿排期均为本地当天。
- 统一源码检查：117 Node、98 Python，跳过 1 项原有文件链接权限用例；类型、前端构建、43 条 API 资料及固定上游补丁复现通过。
- 有效载荷 743 个文件哈希、干净工作区初始化通过。
- 六个平台公开热点来源在本机实际返回数据，见 [网络记录](evidence/hotlist-network-0.5.10.json)。网络可用性是当次观察，不是未来保证。
- [界面验证](evidence/business-ui-0.5.10.json)、[热点浅色](images/0.5.10/trends-light.png)、[热点深色](images/0.5.10/trends-dark.png)。浏览器发布入口及旧 AitoEarn 资料保留回归通过，见 [记录](evidence/browser-publish-0.5.10.json)。更新横幅测试在更新 SDK 边界合成未来版本 0.5.11，不自动下载，不表示该版本已发行。
- 独立 Agent 仅从隔离的 `MediaSail 接入.md` 开始，找到完整 Skill 与五块方法，核对实例，调用现有业务计算，以读取版本修改合成画像并登记两份成果；软件重新读取文件、接口与内容库页面均可见。接入与完成合成任务共 244.9 秒，不作为接入时间承诺。见[完整结果](evidence/method-agent-0.5.10.json)、[内容库](images/0.5.10/independent-method-agent.png)、[方法入口](images/0.5.10/voice-method.png)。
- [双轴审查](REVIEW-0.5.10.md)完成；每轮发现均已修复并反馈验证。

## 验证边界

所有账号身份、二维码和发布响应为隔离合成数据，未扫码真实账号、未公开发布。公开热点网络测试不登录。文件剪贴板独立接收页不代表所有 Agent 客户端兼容。画像、资料库与安装验收使用隔离位置，不操作日常安装和资料。

五块中文方法按研究中固定来源改编，原始许可与署名随包保留，发布适配文件未引入。外部 Agent 自选实现工具，当前画像、项目、日历和计算口径沿用。方法升级仍通过现有用户自定义冲突保留机制。

## 首轮审查修正

Standards 发现 1 项、Spec 发现 4 项，均先补反馈用例再修正：来源报错但 data 为空不得写成 live；whoami 服务端代次防止旧结果回写缓存及标记；登录 runner 使用独立轮次文件，在运行的同平台任务复用，过期 sessionId 的查询和验证码返回 409；知乎已有回答即使旧 ID 未渲染也不冒报新回答；访谈参考正文删除固定两批与指定工具。公众号真实 CLI 合成网络用例确认只提交一次、退出码 2、原稿保留、恢复 JSON 不含 token。修正后的候选重新构建，独立复审通过。

复审另发现采集链可绕过服务端代次；已通过真实 HTTP 反馈复现，并让所有账号状态写入都必须携带代次。旧采集返回 409 account_state_changed，原结果保留在 detail.result，当前账号标记与缓存保持最新。

## 候选身份与兼容回归

安装包 263020970 字节（约 251 MiB），比 0.5.9 增加 23796 字节；未添加运行依赖。SHA-256 `900ae407310fdb754559228af6e99c5cdd8fe7228a49168ac3691b17e1467b90`，app.asar SHA-256 `9d0e07184a0f9b2ea5cc135c5ed4d31ee727d10e2f3a815fe9ac3f6a0a425591`。运行实现至 `359f2ef`，后续提交仅补观察脚本和证据；见[构建身份](evidence/build-0.5.10.json)。实现提交的[源码 CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39416614669)及补充证据提交的[源码 CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39416777049)均通过。

最终构建重新完成[业务界面](evidence/business-ui-0.5.10.json)、[浏览器发布](evidence/browser-publish-0.5.10.json)、[实际文件剪贴板](evidence/skill-file-0.5.10.json)和[普通网页版](evidence/skill-web-0.5.10.json)回归。浏览器发布记录中的实际 app.asar 哈希与上述一致。首页无展开键、改名或文字备用入口；仅复制固定名称 MD，失败重试，旧卡片可在切库及端口变化后找到当前位置。普通网页版仅提示桌面版。独立 Chromium 接收页不代替 TRAE 或 Codex 的实际输入框兼容验证。

## 真实安装升级

[隔离 Windows 工作流](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39417041852)通过，测试提交 `c3e7914`。正式 0.5.9 与草稿 0.5.10 均先核对官方摘要及校验文件；执行真实 NSIS `/S --updated --force-run`，升级不传 `/D` 覆盖位置。候选哈希与上述最终安装包一致，见[原始结果](evidence/maintenance-upgrade-0.5.9-to-0.5.10.json)。

- 含中文空格的原安装路径、登记和资料库选择保留，没有默认目录旁装或重复选库。
- 原有文件保留总数为 34，其中包含旧 AitoEarn 分区的 22 个文件；用户自定义工具及 Skill 保留，旧分区字节一致，新版未初始化旧内嵌页或发送器。
- 画像 revision、分类增量修改及原扩展字段、成品和素材路径、项目文件夹入口、当前安装器缓存核对通过。
- 两次正常退出重开，资料、合成登录资料、主题和旧偏好保持，无空闲任务误提醒。固定 MD 名称由真实剪贴板另行验证，保留旧名称存储键不表示恢复改名入口。
- 本次云机候选安装观察 308691ms（约 5 分 9 秒），不含下载；完整安装验收约 8 分 53 秒。仅为该云机的当次观察，不作为安装速度保证。

[实际安装进度](images/0.5.10/upgrade-progress.png)、[升级后内容库](images/0.5.10/upgraded-content-library.png)、[安装复制日志](evidence/installer-copy-0.5.10.log)。没有使用真实账号公开发布。

## 发行文件

安装包、源码 ZIP、更新索引、差量索引及校验文件按同批摘要核对；18 个历史 Release 的文件保持不变，包括未发行 0.5.1 草稿，见[资产核对](evidence/assets-0.5.10.json)。源码 ZIP 内报告为发行时快照，资产的最终身份以同批 `SHA256SUMS.txt` 为准；正式发布后不替换资产。

源码 ZIP 完整 CRC 检查通过，逐一核对其中所有有效载荷源码与打包暂存原件一致；开发约定、审查、真实升级结果、完整 Skill 与两份来源许可证均存在且字节匹配。

## 正式发布与公开更新

[v0.5.10](https://github.com/jerryrenjianxing-sys/MediaSail/releases/tag/v0.5.10)于 `2026-10-20T11:58:05Z` 发布为正式最新版，tag 指向 `e2c3b70d60cd0d2fc3204c3523b7bf4126fadeb9`。该提交的[统一源码 CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39418441280)通过。发布后再次核对五个资产的服务端 SHA-256 与本地一致，历史 Release 文件保持不变。

使用保留的原始 0.5.9 和最终 0.5.10 客户端、各自隔离资料，直接读取包内原 GitHub 更新源：0.5.9 显示发现 0.5.10，0.5.10 显示已是最新。未替换更新源，未请求下载或安装。见[旧版结果](evidence/content-update-0.5.9-to-0.5.10.json)、[新版结果](evidence/content-update-0.5.10-to-0.5.10.json)、[旧版截图](images/0.5.10/update-check-0.5.9.png)及[新版截图](images/0.5.10/update-check-0.5.10.png)。本节与最终公开检查证据在发布后补入主分支，没有重新替换正式发行资产。
