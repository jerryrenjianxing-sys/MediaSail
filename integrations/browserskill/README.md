# BrowserSkill MediaSail 适配

原始提交、源码归档 SHA-256、工具链与浏览器固定信息见根目录 `browser-tools.lock.json`。原始 BrowserSkill 为 MIT，适配构建标识为 `b8f2d4f-mediasail.1`，协议 1.8。`extension-key.txt` 是固定身份用的公开密钥，不含私钥；扩展 ID 为 `kaebebbcleedepmhfmmnekncfdmmhlml`。

## 修改范围

- 删除 daemon 启动时自动同步全局 Agent Skill 的任务；发行构建关闭自动更新检查。
- 扩展只从本工具组的只读 `mediasail-bootstrap.json` 读取私有 loopback 端点，无默认端口回退。daemon 校验固定扩展 Origin 和同组随机 nonce。
- 增加 native `managed-launch`，显式隔离 stdio/环境并让可见浏览器脱离调用者的 Windows Job。保留 Windows 公共外层容器的兼容性，不把“仍在任何 Job 中”误当成启动失败。验证方式包括调用进程退出后继续操作及安装覆盖验收；不宣称浏览器超越操作系统生命周期。
- 固定 CLI/扩展独立构建标识。其他 BrowserSkill 页面、协作上下文和动作核对规则沿用原实现。

## 依赖准备与源码检查

源码检查不下载、不改写源文件。首次明确准备原始归档，然后使用相同检查入口：

```powershell
& '<业务Python>\python.exe' scripts/verify-browser-source.py --download
# 离线也可 --prepare-from <已下载原始ZIP>
npm run check
```

`mediasail.patch` 应用于锁定的原始源码，`adapted-files.json` 核对所有修改文件的最终字节。补丁放在此目录，避免被 Easel 的补丁入口误用。原始代码、锁文件和依赖源码另随 Release 的 Browser Sources 资产提供。

## Windows 构建

在普通开发目录展开固定 BrowserSkill ZIP 并去掉归档顶层目录；核对 SHA-256 后 `git apply <本目录>/mediasail.patch`。安装准备与检查分开，不把开发编译器放进安装包。

1. 使用锁定 Rust 1.99.1 与 `x86_64-pc-windows-gnullvm` 标准库、LLVM-MinGW 20261104 UCRT x64（原始资产与 SHA-256 见锁）。将该工具链的 `x86_64-w64-mingw32-clang.exe` 设为 `CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER`、`CC_x86_64_pc_windows_gnullvm`，对应 clang++/llvm-ar 设为 CXX/AR 目标变量。设置 `MEDIASAIL_BUILD_REVISION=b8f2d4f-mediasail.1`、`RUSTFLAGS=-C target-feature=+crt-static -C link-arg=-static`，运行 `cargo build --locked --release --target x86_64-pc-windows-gnullvm`。需要 CMake/Ninja；主机 Rust 工具链可用 MSVC 编译主机构建脚本，但这些主机产物不发行。最终链接采用 LLVM/MinGW 开源运行代码及 Windows 系统 UCRT API 导入，不复制 SDK/MSVC 静态 CRT；实物核对见许可研究 §12。
2. 使用开发 Node 与 pnpm 10.17.0，`pnpm install --frozen-lockfile`。同样设置 `MEDIASAIL_BUILD_REVISION`，运行 `pnpm --filter @browser-skill/extension build`，输出 `apps/extension/dist/chrome-mv3`。开发 Node/npm 不发行。
3. 从实际 Cargo metadata 和安装的扩展生产依赖收集许可：`scripts/browser-dependency-notices.py`。包括 option-ext 与 Mediabunny 的 MPL 对应源码、RemixIcon 独立许可。`html-parse-stringify@3.0.1` 原 npm 包漏带许可，附带其维护者在固定 `ada9e1448f34a57c17e7e23ba4af6d217e3d7baf` 的 LICENSE；原版本 package.json/README 已声明 MIT。
4. 用根目录 `scripts/prepare-browser-payload.py --browser-archive <锁定原ZIP> --bsk <上述bsk.exe> --extension <上述dist> --notices licenses/browser-tools` 构建 `build/browser-tools`。脚本核对已审查二进制 SHA-256、实际编译目标/构建身份和扩展元数据，拒绝独立运行库 DLL；固定扩展身份，生成逐文件校验清单，拒绝私有 bootstrap 数据。自行重建的发布者应先验收新产物，再明确更新锁中的发行二进制校验值；不声称不同构建路径天然产生相同字节。
5. 运行 `npm run dist` 及独立安装验收。包内校验不能代替真实登录、业务回存或安装升级。

BrowserSkill 自带依赖遵守各自许可，根 MIT 不替代它们；完整声明位于 `licenses/browser-tools`。浏览器对应源码组装、原构建配置及已执行范围以源码资产和研究记录为准，未执行全量 Chromium 重编译。
