# MediaSail 0.5.9 验证记录

状态：源码、打包后界面、双轴审查及真实隔离升级通过；待完成正式发布与公开更新检查。仅隔离安装和合成资料，不操作日常安装与资料库。

旧0.5.8打包首页的红测确认仍有展开键，调整后的可见界面验证先失败，再移除菜单及改名状态。继续使用已约定的可见首页、真实文件剪贴板和安装器验证边界。

## 已完成

- `npm run check`通过：117项Node，79项Python（本机文件链接权限不足跳过1项），前端类型与构建、43条接口说明及1052个文件的补丁复现通过。
- 打包有效载荷732个文件哈希通过。[文件复制记录](evidence/skill-file-0.5.9.json)8组通过，包括无菜单与改名弹窗、真实Windows文件列表、独立Chromium接收MD、完整连接命令、旧偏好下固定名称及重复复制、失败重试、退出后读取和重启、旧卡片跟随新的资料库及端口。
- 预置旧自定义名称「历史自定义.md」，实际复制仍为「MediaSail 接入.md」。重启后仍固定使用该名称，旧偏好和已复制文件保留。失败注入仅位于剪贴板SDK边界，恢复后重试仍复制MD，无文字格式或弹窗。
- [普通网页版](evidence/skill-web-0.5.9.json)通过，仅提示使用桌面版，控制台往返后行为相同。测试退出确认Adapter仅用于清理合成环境，不作为真实安装及正常退出证明。
- [首页](images/0.5.9/skill-file-home.png)、[浅色](images/0.5.9/skill-file-light.png)、[深色](images/0.5.9/skill-file-dark.png)、[窄窗口](images/0.5.9/skill-file-narrow.png)、[失败重试](images/0.5.9/skill-file-retry.png)、[独立接收页](images/0.5.9/skill-file-paste-receiver.png)。
- [双轴审查](REVIEW-0.5.9.md)Standards与Spec均0项确认发现，实现提交为d39c91c。

## 待完成及边界

正式发布及公开更新核验。完整Skill及业务功能不改，仅同步首页描述；旧名称存储键仍保留兼容，原有安装验证继续核对其数据保留，并不表示改名界面仍存在。独立接收页不代替TRAE、Codex等客户端实际输入框兼容验证，不新增相关兼容声明。

## 候选身份

安装包262997174字节（约251MiB），SHA-256 `19f98cc0325e106e3cdd053f9d300071c74c70a08723f5d79635a3849a5408e8`；app.asar SHA-256 `f2db4879f9cd8ad7c4d6d579be8907e5987ee8f8c3718ada46ebad2c08c23453`。运行实现提交d39c91c，89d28ac仅补审查与验证记录。草稿5个资产的服务端摘要与本地一致，17个历史Release文件保持不变，包括未发行0.5.1草稿。

## 真实升级

[独立Windows工作流](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39359472502)通过，测试提交89d28ac；该提交的[源码CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39359295127)通过。使用正式0.5.8安装器与校验过的草稿候选，真实执行NSIS `/S --updated --force-run`，未用 `/D` 覆盖升级位置。[原始结果](evidence/maintenance-upgrade-0.5.8-to-0.5.9.json)的安装器哈希与上述候选一致。

- 沿用含中文空格的原安装位置、安装登记和资料库选择，无默认目录旁装。
- 34个既有文件、用户自定义脚本和Skill原位保留，旧AitoEarn分区22个文件字节一致。
- 旧名称偏好保留在原数据中，两个正常重启后仍保留；首页固定文件名已由实际剪贴板验证，未恢复改名入口。
- 画像revision、项目分类及其他元数据、项目文件夹入口、当前安装器缓存哈希通过。两次正常退出重启无空闲任务误提示。
- 本次安装观察74787ms（约1分15秒），仅云机实际观察值，不含下载，也不作为安装速度保证。

[安装进度](images/0.5.9/upgrade-progress.png)、[升级后内容库](images/0.5.9/upgraded-content-library.png)、[复制日志](evidence/installer-copy-0.5.9.log)。不使用真实账号公开发布。
