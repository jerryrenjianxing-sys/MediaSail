# MediaSail 0.5.6 验证记录

状态：开发、源码检查、打包界面及隔离真实升级均通过；正式发布后的公开更新检查另列记录。

## 已取得的反馈

- 旧版打包界面复现：画像输入未保存定位后切到内容库，没有确认提示（实际 dialogs=0，预期1）。使用独立定位目录和合成画像，未操作日常安装。
- 编辑状态 Interface 的四项测试经历红绿：取消后保留草稿；保存中及切库阻止离开；重复请求不共享确认；确认期间开始保存阻止离开。
- 画像 HTTP 首次测试确认旧响应缺 revision；旧接口接受过期版本并返回200。实现后读取、409冲突、同版本并发、旧调用、自定义维度、删除、写入失败、不可读文件、保存期间外部修改及进程中断共10项通过。
- 统一源码检查已通过：110项 Node，79项 Python（1项环境跳过），前端类型与生产构建、43条接口路径资料一致性、1052个上游源码文件补丁复现。
- [打包界面记录](evidence/reliable-editing-0.5.6.json)：13组检查通过，包括真实取消退出、关闭到托盘再恢复、切库拒绝、各表单关闭、连续画像冲突、发布草稿持久化及安装前编辑检查。
- 安装前编辑检查与安装启动失败恢复通过第三方更新 SDK Adapter 注入进行，没有下载或运行模拟安装包；真实 NSIS 安装仍另行验收。录屏中的后续版本提示为该合成测试，不代表 GitHub 已发布该版本。
- 延迟响应复现并修复了保存期间输入丢失风险、旧 GET 覆盖新保存的界面回退。选题、日历、凭证、验证码与公众号输入保护通过；公众号保存冲突保留采集草稿和 Agent 新正文。
- [浅色](images/0.5.6/reliable-profile-light.png)、[深色](images/0.5.6/reliable-profile-dark.png)、[操作录屏](images/0.5.6/reliable-editing.webm)。matt 双轴记录见 [审查记录](REVIEW-0.5.6.md)。

- 内容库 8 组回归、浏览器发布入口 6 组回归及真实本地媒体预览均通过；合成旧发布记录、登录分区和项目文件保持不变。结果见 `evidence/content-library-0.5.6.json`、`evidence/browser-publish-0.5.6.json`、`evidence/library-media-0.5.6.json`。
- matt 增量复核完成：Standards 无确认违例，Spec 已关闭 P1，无新增缺口。
- 外部 PowerShell 实际消费随包 Skill：在线身份核对、下载 ZIP、直接执行中文画像版本示例、登记成果并由内容库读回均通过。Windows PowerShell 5.1 原先错误解码响应中文，红测复现后改为明确 UTF-8 读取原始响应；修正后的原中文与新增中文同时保留，见 `evidence/agent-profile-0.5.6.json`。
- [GitHub 干净环境源码检查](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39235758868) 通过，使用与本地相同的 `npm run check`，没有以准备依赖或部分测试代替完整入口。
- [候选提交 c17347d 的重复 CI](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39236100473) 同样通过：110 项 Node、79 项 Python 全部通过。本机因没有符号链接权限跳过的一项在该 Windows runner 也通过。

## 真实安装升级

[独立 Windows 验收](https://github.com/jerryrenjianxing-sys/MediaSail/actions/runs/39236126328) 使用 GitHub 正式 0.5.5 安装包和校验过的 0.5.6 草稿资产。实际 NSIS 更新参数为 `/S --updated --force-run`，未传入 `/D` 覆盖位置。通过结果见 [原始记录](evidence/maintenance-upgrade-0.5.5-to-0.5.6.json)。

| 核对项 | 结果 |
| --- | --- |
| 安装位置和登记 | 沿用含中文空格的旧安装目录，无默认目录旁装 |
| 资料库、画像、合成登录资料、旧发布记录、自定义脚本及 Skill | 34 个受核对文件保留；旧 AitoEarn 分区 22 个文件字节不变 |
| 当前缓存和画像版本 | 缓存与候选安装包哈希相同，画像 revision 与原始字节一致 |
| 正常退出和重新打开 | 连续两次正常重启，资料保留，无空闲任务误提示 |
| 安装观察耗时 | 325770 ms，约 5 分 26 秒；这是本次云机覆盖安装观察值，不是下载测速或用户电脑耗时承诺 |

[安装进度](images/0.5.6/upgrade-progress.png)、[升级后内容库](images/0.5.6/upgraded-content-library.png)、[安装复制日志](evidence/installer-copy-0.5.6.log)。复制阶段本身约 3 秒，安装观察值还包括旧版卸载、校验和更新流程，未将整段时间归因于复制。

## 候选身份与发布

- 运行代码及 Skill 候选来源为 `9634a0d91b8e5a1c5f5967e8ec8572732ee51752`；`c17347d4200b3ac4062a97138f578bea678a3185` 仅补充测试和证据，使用它完成云端源码与真实安装验收。后续记录提交不改变运行代码。
- 最终打包 `app.asar` SHA-256：`10e19834464abe3a94cdb19ee79199deba2986a7d24d2c0a659446c66f92f820`，与打包界面回归所测一致。
- 安装包：263779038 字节（约 251.56 MiB），SHA-256 `60b37c664accd9f29e3ed1ca9674551bca4e59695e051d1fe32bb7a99ad63822`。本地 SHA-512、GitHub 服务端摘要和真实安装记录相互一致。
- 五个发行资产已核对，14 个旧 Release 的资产保持不变，包括未发行的 0.5.1 草稿；最终资产记录见 `evidence/assets-0.5.6.json`。源代码 ZIP 中的资产记录是生成时快照，发行文件校验以同批 `SHA256SUMS.txt` 为准。
- 本机日常安装 `D:\mediasail` 和资料库未操作。真实升级发生在临时 GitHub-hosted Windows，使用合成资料，没有真实账号公开发布。
- 正式发布后，使用原版 0.5.5 与当前 0.5.6 的 GitHub 更新配置检查；不请求下载或安装。公开结果将在本记录及对应 evidence 中补充。

以上源码检查不能代替安装验收，合成资料测试不能代表真实平台发布成功。
