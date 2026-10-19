# Skill 文件复制研究

日期：2026-10-19。范围：MediaSail 0.5.6 固定 Electron 44.7.0、Windows x64；本轮只研究，不修改产品或剪贴板，不安装其他软件。

## 结论与建议

建议提供「复制接入文件」：软件在当前资料库的软件缓存中生成一个 UTF-8 的 `MediaSail 接入.md`，把它作为文件复制到 Windows 剪贴板。用户无需选择下载位置，可到支持文件粘贴的 Agent 聊天中粘贴。保留「复制接入文字」作为明确的备用入口。

这是可实现的候选方案，但不能承诺任意聊天框都能粘贴附件。文件复制成功、目标聊天框接收到附件、Agent 读到说明、Agent 成功连接本机，是四个不同的结果，分别验收。

文件主要解决发送形式和可读性；连接快慢还取决于接入步骤、模型和目标 Agent，不能把截图中的 18 秒归因于 Markdown 文件。截图显示的发送内容本身仍是接入文字，并不足以证明文件粘贴能力。

## Windows 的三种情况

| 方式 | 实际含义 | 本次建议 |
| --- | --- | --- |
| `CF_HDROP` | 传递已存在文件的完整路径；接收方再读取文件 | 使用软件生成的小型实体 Markdown 文件 |
| `CFSTR_FILEDESCRIPTOR` + `CFSTR_FILECONTENTS` | 分别提供文件名等描述和内容，可把没有实体路径的数据当作文件传递；通常通过 OLE 数据对象提供 | 暂不采用，增加实现和目标兼容验证成本 |
| 只复制 Markdown 正文 | 剪贴板中是文字，不因此变成带文件名的附件 | 作为备用 |

`CF_HDROP` 与虚拟文件是 Windows 官方分别定义的传输形式；把正文 MIME 改成 `text/markdown` 不等同于复制一个文件。[Microsoft：Shell Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/shell/clipboard)

由此推导：实体文件方案需要保留文件，不能复制后立即删除。建议采用独立缓存快照，不覆盖用户已经粘贴或正在上传的旧文件；清理周期需要另行确定。软件退出后是否仍可粘贴，也要纳入实测。

## Electron 44.7.0 已有可用路径

固定版本公开的主进程接口是 `clipboard.write(ClipboardItem[])`。同一次写入中的多个表示会原子提交，可同时提供 `text/plain`。不要照旧文章直接调用已经不在该版本文档中的 `clipboard.writeBuffer`。[Electron 44.7.0：clipboard 文档](https://github.com/electron/electron/blob/v44.7.0/docs/api/clipboard.md)

更关键的是，该版本源码明确将 `text/uri-list` 分派到 Chromium 的 `WriteFilenames`；读取时也通过 `ReadFilenames` 还原文件 URI。它提供了现成的文件复制通路，第一步不必引入本地插件、PowerShell 子进程或手工构造 `CF_HDROP`。[Electron 44.7.0：ClipboardItem 实现，`ReadMime` 与 `WriteTo`](https://github.com/electron/electron/blob/v44.7.0/shell/browser/api/electron_api_clipboard_item.cc#L278-L292)

候选流程为：

1. 主进程生成唯一的 `.md` 实体文件，内容使用本机当前连接资料。
2. 把文件路径正确转换为 `file:` URI，作为 `text/uri-list`；同一个 `ClipboardItem` 可另带简短的 `text/plain` 接入说明。
3. 等待写入成功后显示「文件已复制，可到 Agent 中粘贴」。不要显示「已连接」。
4. 若目标应用只接受文字，用户可主动选择备用文字复制。

这里的 `text/uri-list` 处理是针对固定版本源码得出的实现依据，还未进行真实剪贴板和目标应用验证；不要把源码可行性写成已通过兼容测试。

## 文字备用的实际限制

Windows 允许同一内容同时提供不同剪贴板格式，由接收方选择其识别的格式；并不是来源软件能强制规定接收方如何粘贴。[Microsoft：Multiple Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats#multiple-clipboard-formats)

因此，同时提供文件和文字属于兼容策略，不能保证“不支持附件时自动贴正文”。实际应用可能优先粘贴文字、忽略文件、同时处理两种表示或拒绝附件。尤其要检查附带文字是否让本来支持文件的聊天框优先插入正文。若存在冲突，默认只复制文件，另设备用文字入口更明确。

网页聊天框还由其自身粘贴处理和上传类型决定是否接收 `.md`，不能只根据浏览器版本判断。W3C 规定了剪贴板数据与粘贴事件的接口，但没有要求每个聊天产品自动把所有文件变成附件。[W3C：Clipboard API and events](https://w3c.github.io/clipboard-apis/)

## 文件名、接入说明和正式 Skill

用户发送的普通接入文档可以命名为 `MediaSail 接入.md`，也可以提供改名选项；应保留 `.md` 扩展名。它是让 Agent 读取的一份文档，不代表自动安装进 Agent 的技能目录。

正式可发现的 Agent Skill 则有另一套结构：技能目录中至少需要名为 `SKILL.md` 的文件，包含规定的元数据；可有 `references`、`scripts` 等配套目录。不能为了附件展示名而直接重命名产品发行的规范入口。[Agent Skills：Specification](https://agentskills.io/specification)

建议保持现有完整 Skill 及其资料索引不变。新文件是简短接入入口，说明完整 Skill、连接发现信息和当前资料库的位置；它不把所有脚本和资料硬塞进一个 Markdown。若希望离线转发到另一台电脑，需要另外处理脚本和资料；仅发本机路径无法让远程 Agent 获得本机执行能力。

## 实施前后待验证

- 在隔离的 Electron 44.7.0 小样中确认 `text/uri-list` 实际生成文件复制语义；资源管理器粘贴后的文件名、UTF-8 正文和哈希正确。
- 分别测试文件单独复制、文件加文字两种形式；目标至少包括用户实际使用的 Codex、Trae，以及一种浏览器聊天页面。记录具体应用版本及结果，不泛称“所有 Agent”。
- 验证复制后软件退出、第二次复制、较晚粘贴、用户清空缓存、文件占用时的表现；避免过早清理。
- 验证中文、空格、`#` 和 `%` 路径，以及改名中的非法文件名字符、已有同名文件和扩展名。
- 文件只含接入说明和必要定位信息，不打包账号凭据、Cookie、画像全文或用户业务资料；保留现有连接身份核对。
- 验证未选资料库、服务未运行、选库变化和旧附件中的过期地址；说明优先读取最新发现信息。
- 验证不支持文件粘贴的目标可用备用文字，且失败反馈不误报为“文件已被 Agent 接收”。
- 用同一 Agent、同一机器和相近网络分别记录“读取说明→首次身份核对→简短能力反馈”，比较新旧接入路径。不能把一次 18 秒示例当作性能保证。

本次未修改任何产品文件，也未验证目标 Agent 的实际附件粘贴支持。以上待验证项是后续实现验收范围。
