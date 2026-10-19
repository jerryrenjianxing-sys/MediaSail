# MediaSail 0.5.8 验证记录

状态：源码、打包界面、双轴审查及真实隔离升级通过；正在完成正式发布及公开更新检查。只使用隔离数据，不操作日常安装和资料库。

## 行为反馈

已发布 0.5.7 的可见首页红测确认：桌面下拉仍提供文字复制，普通网页版仍提供文字入口，不符合本次 MD-only 需求。后续以打包后实际行为核验文件复制、失败重试和网页版提示。

## 已完成

- `npm run check` 通过：117项 Node，79项 Python（本机缺少文件符号链接权限，跳过1项）；前端类型与生产构建、43条接口说明和1052个文件的上游补丁复现通过。首次检查捕获接口说明版本尚为0.5.7，显式重新导出后仅版本变化，重跑通过。
- 打包有效载荷732个文件哈希通过。[真实文件复制](evidence/skill-file-0.5.8.json) 8组通过：仅MD入口、Windows文件列表、独立Chromium实际接收MD、完整接入命令、名称编辑、失败重试、正常退出及名称记忆、旧卡片跟随新库与新端口。
- 复制失败时旧文件剪贴板不变；恢复剪贴板后点击「重试」得到独立MD快照，无text/plain、文字选项或弹窗。剪贴板失败使用系统Adapter注入，其余文件传递使用真实剪贴板。
- [普通网页版](evidence/skill-web-0.5.8.json) 没有桌面能力时，只显示禁用的文件复制按钮和桌面版提示；无文字入口、无文本框，进入控制台再返回行为一致。合成首次引导完成记录及退出确认Adapter用于测试环境清理，不代替真实升级与正常退出验收。
- [首页](images/0.5.8/skill-file-home.png)、[浅色](images/0.5.8/skill-file-light.png)、[深色](images/0.5.8/skill-file-dark.png)、[改名](images/0.5.8/skill-file-name.png)、[失败重试](images/0.5.8/skill-file-retry.png)、[独立接收页](images/0.5.8/skill-file-paste-receiver.png)。

## 待完成

正式发布及公开更新检查。最终候选同步接口说明版本后重新构建并复测，日常安装和资料库保持原样。

## 审查与候选身份

[双轴审查](REVIEW-0.5.8.md)均0项确认问题。运行实现提交为f00af6b，后续至6270acb仅补审查资料和安装验收。安装包262999739字节（约251MiB），SHA-256 `f60e3e11df77c2b1368dc23602bdca6b809a767223f8cc1d63c2c4f3d1f27ac0`；app.asar SHA-256 `13d060d1711b51c76e4a9e0a8b6e44b5312f1a03e9add6b0f4aa12c1b7324c31`。

GitHub草稿五个文件的服务端SHA-256与本地一致，16个历史Release文件保持不变，包含未发行的0.5.1草稿。源码包内资产报告是生成时快照，最终以同批SHA256SUMS.txt为准。

## 真实升级

[独立Windows验收](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39248058836)通过，测试提交6270acb。[同提交源码CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39247961615)通过。使用正式0.5.7与校验后的草稿候选；真实NSIS `/S --updated --force-run`，升级没有传 `/D` 覆盖位置。[原始结果](evidence/maintenance-upgrade-0.5.7-to-0.5.8.json)中的安装器哈希与上述候选完全一致。

| 核对项 | 结果 |
| --- | --- |
| 安装位置、登记和资料库 | 原中文空格路径保留，无默认目录旁装，选库沿用 |
| 自定义脚本、Skill、画像、内容与旧记录 | 34个原文件保留，旧AitoEarn分区22个文件字节不变 |
| 文件名偏好 | 0.5.7设置的中文文件名升级后保留；0.5.8再修改名称，两次重启后仍保留 |
| 业务和缓存 | 画像revision、项目分类及其他元数据、项目文件夹入口通过；当前安装器缓存哈希一致 |
| 正常退出及重启 | 两次通过，无空闲任务误提示 |
| 安装观察耗时 | 222138ms，约3分42秒；仅本次云机观察值，不是下载测速或本机速度保证 |

[安装进度](images/0.5.8/upgrade-progress.png)、[升级后内容库](images/0.5.8/upgraded-content-library.png)、[复制日志](evidence/installer-copy-0.5.8.log)。未使用真实账号公开发布。

## 兼容边界

不新增 TRAE、Codex 等实际输入框的兼容声明；独立 Chromium 接收页是文件传递证据，不代替目标客户端验收。仅保留 MD 方式，不再用文字复制规避目标客户端的附件支持限制。
