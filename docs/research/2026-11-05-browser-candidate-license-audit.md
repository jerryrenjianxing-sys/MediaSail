# 0.5.12 浏览器候选许可与对应源码审计

日期：2026-11-05（Asia/Shanghai）。按 matt research 方法独立复核上游固定源码、官方发行 API、实际下载包和实际浏览器导出的 credits；只读候选资料，未操作用户日常浏览器、未修改产品、未发布。此记录仅针对 `ungoogled-chromium 156.0.8078.73-1.1 Windows x64` 与 `Tencent BrowserSkill 0.4.1` 适配方案。

## 当前判断

**该候选存在可执行的再分发路径，没有发现必须放弃此版本的许可证禁令；当前材料尚不足以宣布发行许可门槛通过。** 本次所见上游 Windows ZIP 没有独立许可文件或对应源码。不能用两个 ungoogled 仓库的 BSD 许可证覆盖整份 Chromium，也不能把几百 KB 的 GitHub 自动生成 source.zip 当作完整浏览器对应源码。

采用 LGPL 2.1 §6(d) 的方案可行：安装包随附完整许可/版权材料；在浏览器二进制所在的同一发行下载地点，实际提供完整对应源码、构建材料和说明。允许以完整源码满足 §6(a) 中的重链接材料要求，并非必须拿到上游 `.obj`。源码可作为独立发行资产，无须塞进安装包。**仅有上游仓库链接、下载脚本、依赖 URL 清单或将来提供的计划，仍不等于已经提供这些材料。** 不需要为此擅自建立三年书面承诺；三年书面 offer 是 §6(c) 的另一种选择。依据：[固定 FFmpeg 所附 LGPL 2.1 §6](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/COPYING.LGPLv2.1)。

后续独立复核已完整读取本机 Chromium full 源归档，校验其 SHA-256/SHA-512、成员索引、关键源码及版本头，并补齐 Windows 源码/PGO（第 8 节）。第 9 节进一步实际通过选择性源码审查：全部 137 个补丁、完整域名清单、精确裁剪与必要配置/输入均已核验。full 模式、GN、编译和链接未执行；最终适配版声明、实际发行资产及接收者下载配套仍需由发行组装核验，不能用本地研究结果代替已完成发布的证明。

## 1. 已固定的来源与实际产物

| 层级 | 本次固定值 | 一手依据 |
| --- | --- | --- |
| Windows 包装仓库 | tag `156.0.8078.73-1.1` → commit `c8317bab03c9d861781f58f85286076e4a80439c` | [tag API](https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/git/ref/tags/156.0.8078.73-1.1)；[固定源码](https://github.com/ungoogled-software/ungoogled-chromium-windows/tree/c8317bab03c9d861781f58f85286076e4a80439c) |
| UGC 子模块 | `ungoogled-chromium` → `6d3e3de2f9d404649842f7457cd3b5ac04dc952f` | [固定 tree API](https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/git/trees/c8317bab03c9d861781f58f85286076e4a80439c)；[.gitmodules](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/.gitmodules) |
| Chromium | `156.0.8078.73` → `2f9a11097447f226133bc1a31c787291a5eeab98` | [UGC chromium_version.txt](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/chromium_version.txt)；[Chromium tag API](https://api.github.com/repos/chromium/chromium/git/ref/tags/156.0.8078.73) |
| FFmpeg | `9db86ce5b5b454dfc96c435f9f0723012980c37f` | [Chromium 固定 DEPS](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/DEPS) |
| Dawn / DXC | Dawn `0caf3649477f7c3ffbd4b1ca4764a81b469b1582`；其 DXC `9757d44faa47de7e8d1bb731c30551ec608624f9` | [Chromium DEPS](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/DEPS)；[Dawn 固定 DEPS](https://dawn.googlesource.com/dawn/+/0caf3649477f7c3ffbd4b1ca4764a81b469b1582/DEPS) |
| BrowserSkill CLI / extension | `0.4.1`；commit `b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5` | [固定 workspace](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/Cargo.toml)；[extension package](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/package.json) |

实际浏览器文件为 `ungoogled-chromium_156.0.8078.73-1.1_windows_x64.zip`，200,854,085 字节，本地重新计算 SHA-256 为 `360406931fb55b04ac276bcf409511bd86e4e67e6950029fc45ca5ca63443090`，与官方 release API 的资产 digest 一致。[官方发行元数据](https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/releases/tags/156.0.8078.73-1.1)

该 tag 有成功的 x64 push 构建，head SHA 同上；发行工作流按 tag SHA 查找成功构建再上传。这支持“来自该固定仓库版本的上游发布包”的来源判断。本次没有独立重建，不能声称已验证字节可复现。[对应 x64 构建](https://github.com/ungoogled-software/ungoogled-chromium-windows/actions/runs/40699893733)；[固定发布工作流](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/.github/workflows/publish-release.yml)

## 2. 许可文本不能只取 root BSD

Windows 包装层的 root LICENSE 与 UGC 子模块的 root LICENSE 都是 BSD 3-Clause；Chromium root LICENSE 同样允许在保留所需声明等条件下分发。这些声明必须保留，但不能替代第三方组件的条款。[Windows LICENSE](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/LICENSE)；[UGC LICENSE](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/LICENSE)；[Chromium LICENSE](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/LICENSE)

本地实际解包得到 75 个文件，未找到文件名含 `LICENSE`、`COPYING`、`NOTICE` 或 `credits` 的独立许可文件；没有 `Widevine` 文件，也没有 `ffmpeg.dll`。浏览器自身 `chrome://credits` 导出最终为 5,451,757 字节，`<title>Credits</title>`，497 个 `product` 条目；文件 SHA-256：`c2aebb32691d260f91cfe99c069ba3365cf6b9253cbe67f325f06de254b9bd3e`。本机证据：`.test-data/managed-browser-release-0512/chromium-credits.html`。较早生成的 22 KB“新标签页”文件已被真正导出覆盖，不能作为许可依据。

该导出包含 Chromium、UGC、FFmpeg、WebKit/Blink、DXC、Dawn、ANGLE、SwiftShader、ICU 及许多第三方文本，适合随包保留为**这一浏览器版本自己的**第三方许可清单；现有 Electron 的 `licenses/Chromium-NOTICES.html` 不是这份新浏览器的清单。credits 同时含 gtk、libsecret 等其他平台项目，不应把 497 个条目都解释为 Windows 实际链接的组件。此区别不影响保留完整清单，但会影响逐项判定源码或链接义务。[Chromium 生成 credits 的固定工具](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/tools/licenses/licenses.py)

随包建议新增独立的 browser 目录：保存实际 credits 原文、Windows/UGC/Chromium root LICENSE、LGPL 文本与版本来源说明，并让离线打开也能读到所有文本。credits 当前引用 `chrome://` 的样式/脚本；可以转换为静态、可展开的离线 HTML，保留原始导出及转换前后正文一致性校验。源码入口必须指向本次发行实际提供的材料，不能仅沿用导出页中指向 UGC 最新仓库的通用链接。

## 3. 已证实需要源码履行的部分

### FFmpeg：LGPL 2.1+，该配置使用静态链接路径

固定 FFmpeg README 将其列为 shipped，并记录 BSD/ISC/MIT/LGPL 2.1 的组合。实际对应的 `chromium/config/Chrome/win/x64/config.h` 明确为 LGPL 2.1 或更新版本，`CONFIG_GPL=0`、`CONFIG_NONFREE=0`、`CONFIG_VERSION3=0`；`LIBX264`、`LIBX265` 均关闭。因此，没有依据把该 FFmpeg 直接称为 GPL/nonfree 构建。[FFmpeg README](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/README.chromium)；[固定 win/x64 配置](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/chromium/config/Chrome/win/x64/config.h)

Windows flags 有 `is_component_build=false`、`ffmpeg_branding="Chrome"`、`proprietary_codecs=true`。FFmpeg 选项默认 `is_component_ffmpeg=is_component_build`，非 component 路径将内部 FFmpeg 编译为 static_library；归档实际也没有 ffmpeg.dll。应按静态 LGPL 路径提供对应浏览器源码/重链接材料，不能套用“替换单独 DLL 即可”的 §6(b) 方案。[Windows flags](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/flags.windows.gn)；[FFmpeg options](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/ffmpeg_options.gni)；[FFmpeg BUILD.gn](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/BUILD.gn)

LGPL §6 还要求许可声明、许可副本，并允许用户为自己的使用修改相关链接工作、为调试这些修改进行逆向。最终产品条款不得把这些权利一概排除。完整对应浏览器源码连同构建资料可以作为 §6(a)/(d) 的履行材料。浏览器作为独立进程随 MediaSail 分发，不自动意味着整个 MediaSail 都改用 LGPL；这里需要履行的是该浏览器内的库及其链接工作对应的条款。[固定 LGPL 文本](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/COPYING.LGPLv2.1)

### Blink 与其他 reciprocal 条款

实际 credits 的 WebKit 条目同时含 GNU Library GPL 2 与 LGPL 2.1 文本；固定 Chromium 的 `third_party/blink/LICENSE_FOR_ABOUT_CREDITS` 确实包含相应条款，不能把对应源码方案只缩到 FFmpeg 子目录。credits 中另有 Eigen、NSPR、Mozilla Windows Cert、symphonia 等 MPL 文本。提供包含 Blink 和全部实际依赖的完整 Chromium 源码基底，可避免将个别文本中出现 GPL/LGPL 的其他平台或工具项目误判为“整份 Windows 浏览器必须 GPL”。最终仍需以实际源码树和平台配置核实，不能单靠搜索 credits 中的字符串。[固定 Blink 许可](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/third_party/blink/LICENSE_FOR_ABOUT_CREDITS)

## 4. §6(d) 对应源码发行 kit：最小可执行方案

**所有浏览器材料必须对应同一个固定 tag/commit 和该 tag 的实际依赖版本。** 不采用“浏览器用 156.0.8078.73-1.1、源码指向最新 main/master”的安排。以下材料可以拆成多个同一 Release 的源码资产，只要下载说明能够明确定位全部文件、校验并还原。GitHub 目前要求单个 Release 资产小于 2 GiB，下面的 full Chromium 归档需要分卷；每卷与还原后的原始归档都必须有校验值。[GitHub 官方资产限制](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

| 必须实际提供的材料 | 内容及验收 |
| --- | --- |
| Chromium 完整对应源基底 | 优先采用下列官方 full tar.xz；下载后计算 SHA-512，并实际检查其 `DEPS`、版本、Blink、FFmpeg、Dawn/DXC、其他递归依赖和所需生成输入。不要把同名压缩包存在当作已经验证完整。官方 lite 是 UGC 支持的另一来源，但使用前同样须核对 Windows 所需文件，不能仅凭 lite/full 名称下结论。 |
| Windows 包装源码 | `c8317bab03c9d861781f58f85286076e4a80439c` 全部文件：build/package 脚本、Windows patches、series、flags、pruning/domain 列表、downloads.ini、README、LICENSE。 |
| UGC 子模块源码 | `6d3e3de2f9d404649842f7457cd3b5ac04dc952f` 全部文件与补丁。GitHub 自动生成 Windows source.zip 不会替你填上 git submodule 的文件。必须单独加入或制作已填充的源归档。 |
| Windows 额外或替换的源依赖 | 固定 Windows `downloads.ini` 中的 DirectX-Headers `07b94cba474be6cdfd934febdbd0b21ca0524187`、webauthn `ef82c157125a0490e05f6ea82a7adb1b8e1bad08`、multimedia-redirection `8b1d8893d126547309f1bab8d8232418aa7c7109`、windows-rs `0.52.0` 源码。若基底已经含完全相同内容，可用文件核对记录证明并复用；否则需要把实际源文件补入，不能只保留下载 URL。前三项的 Chromium README 与 Windows 覆盖版本一致，仍应核对归档实际内容。 |
| 构建输入与生成资料 | 最终合并的 `args.gn`，补丁应用顺序、domain/pruning 操作、生成的 LASTCHANGE/版本头、GN 固定源码及构建流程所需 PGO/V8 profile。`chrome_pgo_phase=2` 所需 Windows profile 不得未经检查就假设存在于官方 tar。凡最终构建需要、且无法由所提供源码确定生成的数据，要实际带上，或用已验证的生成步骤还原。 |
| 可操作的重建/重链接说明 | 从这些本地源码资产还原到可编译的源树的步骤，完整 flags、工具版本与 Windows/VS/SDK 先决条件，如何修改 FFmpeg/Blink 再编译浏览器。不能只给会重新取最新源码的脚本。应至少执行离线源树还原、补丁应用和关键输入核验；未执行全量编译时明确记录。 |
| 校验与来源清单 | 每一实际资产的大小、SHA-256/512、对应 URL/commit、放入源树的位置、重复源的核验、分卷还原规则及与浏览器 ZIP digest 的映射。安装包内源码说明与 Release 正文指向这些**实际已提供**的资产。 |

以上基于固定 [UGC downloads.ini](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/downloads.ini)、[Windows downloads.ini](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/downloads.ini)、[Windows build.py](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/build.py) 与 [UGC clone.py](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/utils/clone.py)。固定官方 CI 运行 `build.py --ci -j 2`，未传 `--tarball`，所以原构建走 Chromium 固定 tag 的 gclient checkout 路径。用官方 tar 代替其 checkout 是可行的材料组织方式，必须核对内容和附加生成输入，而不是宣称原 CI 用过此 tar。[固定 stage 构建调用](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/.github/actions/stage/index.js)

可单独记录为通常的构建工具先决条件的项目包括 VS/Windows SDK、LLVM 23.1.0、Python 3.12、Ninja 1.12.1、Node 24.12.0、Go 1.25.0、Rust nightly 2026-09-09、TypeScript 7.0.2、esbuild 0.28.2、gperf/bison/Git；不要把工具链安装包和实际被链接或编译进浏览器的第三方源码混为一谈。若重建流程仍依赖额外非标准数据、下载组件或私有文件，就须再查明是否属于需提供的材料，不能仅写“所有工具豁免”。工具版本来自上述固定 Windows downloads.ini 与 CI。[LGPL §6 的 data/utility 与系统组件例外](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/COPYING.LGPLv2.1)

特别需要核对的源码/数据 pins：

- Chromium `DEPS` 中 GN 为 `510ec7992c30f172205792f190e96111a896ba8f`，depot_tools 为 `a07c06fe67a1a9d64ac4728df3a11c1ceb0cf73e`；UGC clone.py 还带自己的 depot_tools/gsutil 补丁，保留整个子模块即可保留这些改动。
- Windows PGO 文件名是 `chrome-win64-8078-1793037244-d459387cb65a37df804537d0ab2530efbf533140-1f3ddf983a1013f6a0abc513cd3ca62c1c9aef51.profdata`。[固定 win64.pgo.txt](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/chrome/build/win64.pgo.txt)
- UGC clone.py 明确额外下载对应平台的 PGO 和 V8 builtins profiles，并生成版本资料。审阅的官方 tar 发布脚本快照只显式 fetch Linux PGO，所以 Windows profile 是否已在下载归档里，必须实检。[固定 UGC clone.py](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/utils/clone.py)；[官方 tar 发布脚本审阅快照](https://chromium.googlesource.com/chromium/tools/build/+/0535399bf40a7d6127b7d8d21a2c06fe59119aca/recipes/recipes/publish_tarball.py)

### 官方源归档已取得的远端元数据

下列大小来自本次 GCS HEAD，hash 来自相同官方位置的 `.hashes` 文本。后续已对本机 full 源归档独立重算并匹配 SHA-256/SHA-512（第 8 节）；lite 仍只核验远端基准。

| 归档 | 远端字节数 | 官方 SHA-256 |
| --- | ---: | --- |
| `chromium-156.0.8078.73.tar.xz` | 4,422,774,264 | `4dc3cfd4b4839988ab4dac215da80d508f64897d214235e00bea8fc0c249af8c` |
| `chromium-156.0.8078.73-lite.tar.xz` | 2,009,545,268 | `cfdf8def1207b81af1231e5170bf849896cd353e72220ca05d93432e31551d59` |

Full SHA-512：`8b7be6a31247fa0842db205e37db7b154a410eda479db24e26b33189d829bb7d99804c65c83818686f8d0c75fe91a8c6ad8217ef6df446ae586ed9207fbc53cf`。[full 官方归档](https://commondatastorage.googleapis.com/chromium-browser-official/chromium-156.0.8078.73.tar.xz)；[full hashes](https://commondatastorage.googleapis.com/chromium-browser-official/chromium-156.0.8078.73.tar.xz.hashes)

Lite SHA-512：`da6b9cf4615cc7872674ea41430d61ae04ce63b0d2e5ef7bde5d86631f4a8e9d294c5b59e9ed303161f6b35ffe43d7875f8ea4c77a994a6e88b6f32d154b2739`。[lite 官方归档](https://commondatastorage.googleapis.com/chromium-browser-official/chromium-156.0.8078.73-lite.tar.xz)；[lite hashes](https://commondatastorage.googleapis.com/chromium-browser-official/chromium-156.0.8078.73-lite.tar.xz.hashes)

## 5. Windows DLL 与品牌边界

实际 `d3dcompiler_47.dll` 为 Microsoft 有效签名，版本 `10.0.28000.2705`；固定 CI 安装 Windows SDK `10.0.28000.0`。Microsoft 官方文档明确允许把 Windows SDK 的 D3DCompiler_47 作为应用旁置 DLL 再分发；未发现必须删除这个 DLL 的依据。它不是 BSD 代码，不应放进“所有 Chromium 都是 BSD”的说明。后续已取得同一 SDK 包的原始许可/第三方声明，以及 EULA 直接引用的明确 REDIST 条目（第 10 节）；原件存在仍不自动证明下游同意等实际分发条件已满足。[固定 SDK 安装步骤](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/.github/actions/prepare/action.yml)；[Microsoft D3DCompiler 分发说明](https://learn.microsoft.com/en-us/windows/desktop/directx-sdk--august-2009-)

`dxcompiler.dll` 是未签名的 `Microsoft(r) DirectX for Windows(r) - Google Dawn Custom Build`，版本 `1.9.2609.0`，不是上一个 Microsoft SDK DLL 的许可来源；相应固定 DXC 源码与完整第三方许可在 Dawn 依赖链中，需收入上述源基底/清单。[Dawn 固定 DXC README](https://dawn.googlesource.com/dawn/+/0caf3649477f7c3ffbd4b1ca4764a81b469b1582/third_party/directx-shader-compiler/README.chromium)

`ffmpeg_branding="Chrome"` 在 FFmpeg 中是编解码器集合选项，不等于把浏览器变为 Google Chrome 或 CfT。Chromium 固定 `chrome_build.gni` 默认 `is_chrome_branded=false`、`is_chrome_for_testing=false`、`is_chrome_for_testing_branded=false`；这份 UGC flags 未开启它们。因此本审计采用 UGC/Chromium及实际组件许可，没有套用品牌 Google Chrome 或 CfT 下载服务条款。[Chromium 品牌构建开关](https://github.com/chromium/chromium/blob/2f9a11097447f226133bc1a31c787291a5eeab98/build/config/chrome_build.gni)；[FFmpeg branding 选项定义](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/ffmpeg_options.gni)

`proprietary_codecs=true` 也不意味着已经从第三方专利权人取得商业授权。反过来，这个开关本身不能证明当前项目存在某个已确定的专利收费/禁售义务。本次核实的是实际版权许可证与对应源码路径，没有核实销售地域、编解码器商业专利授权或用户具体经营安排；不能把“root BSD”解释成已经取得所有编解码器专利权。[FFmpeg 官方许可与专利说明](https://ffmpeg.org/legal.html)

## 6. BrowserSkill 0.4.1 适配版还需自己的材料

BrowserSkill root MIT 明确允许修改、合并与分发，需保留腾讯版权及许可文本。可以保存上游原文、固定 SHA、适配补丁和构建配置；不能把适配版表述为腾讯官方原封不动发行。[固定 MIT](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/LICENSE)

扩展源码实际生产代码使用 `mediabunny`、`re2js`、`@remixicon/react`；固定 `pnpm-lock.yaml` 分别解析到 `1.61.3`、`2.8.6`、`4.9.0`，这些依赖不能由 root MIT 一笔带过。[extension package](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/apps/extension/package.json)；[固定 lock](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/pnpm-lock.yaml)

- **Mediabunny 1.61.3 是 MPL-2.0**。固定 npm 元数据 gitHead 为 `9d36fc5779b254904bc609e66f2cd80ed8390b4b`。本次实际下载官方 npm tgz，SHA-256 `507e6f75def0ba3748b3b52e4a8ed2937cf311897f4984b90510b56b279bc3d1`；其中有 LICENSE 和 66 个 `package/src/**/*.ts`。可将该完整 tgz 与源码说明作为同一发行的独立源码资产，保留 MPL；若适配改动涉及其 covered files，也提供相应修改。MPL §3.2 要求向接收者说明如何及时取得 source form；仅保留压缩后的 JS 不能替代 preferred source。[官方 npm 版本元数据](https://registry.npmjs.org/mediabunny/1.61.3)；[固定 MPL](https://github.com/Vanilagy/mediabunny/blob/9d36fc5779b254904bc609e66f2cd80ed8390b4b/LICENSE)
- **Re2js 2.8.6 的官方 npm 元数据标记 MIT**，应保留其具体声明，而不是只保留 BrowserSkill 的 MIT。[官方版本元数据](https://registry.npmjs.org/re2js/2.8.6)
- **`@remixicon/react` 4.9.0 官方 npm 元数据标记 Remix Icon License 1.0**，不是这里可以无条件标成 Apache/MIT 的依赖。该条款允许作为软件/UI的功能性或装饰性部分使用，禁止独立图标产品、竞争图标集及用作自身品牌标识等用途；正常 BrowserSkill UI 嵌入用途有明示许可路径。本次 npm tgz SHA-256 `6feaeba9ec0904c49c8d2450c342435beae284d132da4beb7591d315c6d429c9`，包内没有 LICENSE，需另存许可文本/来源。npm gitHead `baeba98572e9259d6133e88dea16d1e64eb66b29` 在其声明的 GitHub 仓库没有取到对应对象，因此不能虚构为已经按此 commit 核对；审阅的当前官方许可固定快照为 `9fb7967c0a4c09910161192bde99efd3df09f5eb`，应在最终许可证归档中如实记录。[React 包官方版本元数据](https://registry.npmjs.org/@remixicon%2freact/4.9.0)；[官方许可固定审阅快照](https://github.com/Remix-Design/RemixIcon/blob/9fb7967c0a4c09910161192bde99efd3df09f5eb/License)

原生 `bsk` 的 Cargo.lock、extension 的 pnpm lock 仍需按最终 Windows/extension 实际构建依赖生成各自的版权与许可清单。应区分仅构建/测试依赖与被编译或打包的代码，同时保留被实际分发的 transitive notices；没有依据用“Rust CLI 没带 node_modules”推断其全部依赖不用附声明。本次独立审计未遍历最终适配产物的完整依赖树，不把这一步记为已通过。[固定 Cargo.lock](https://github.com/Tencent/BrowserSkill/blob/b8f2d4f0fa35c8c7c866229e1cf3b3329ae39de5/Cargo.lock)

## 7. 发行前可核验的通过条件

1. 浏览器、CLI、扩展的最终文件有固定 digest，许可文件来自对应版本；新增浏览器许可与原 Electron shell 的许可分开保存。
2. 离线许可页可读到实际完整文本，含 UGC/Chromium/FFmpeg/WebKit 与实际随包组件；BrowserSkill 保留 MIT、实际依赖 notices、MPL 源码取得说明和适配来源。
3. 对应源码 kit 是已经下载、校验、检查并可还原的文件集合，覆盖上表的实际 source/dependency/patch/profile/config；不能只有 URL 清单。保存还原与关键输入检查结果，未完整重建要明确写出。
4. 同一发行下载位置能实际取得所有源码资产/分卷，安装包内和下载页指向它们；源码不能使用不同版本或 latest/master 漂移替代。
5. 产品分发条款保留 LGPL/MPL 对相关组件的修改、源码取得等权利，不冒称 root BSD/MIT 覆盖全部文件。

在上述条件实际完成前，本记录的结论保持为：**候选可按条件分发；本地对应源材料调查已完成，发行许可门槛仍需以最终源 kit、许可配套和同地点下载核验为准；不得先发布二进制再把源码配套当作未来待办。**

## 8. 后续实际源归档复核与材料收集

独占调查目录：`D:/MediaSail-build-0512/source-audit/`。入口为其中 `README.md` 与 `source-assembly-manifest.json`；后者记录每份原始归档的官方 URL、下载后 SHA-256/SHA-512、实际本地路径、补入位置、源树恢复注意和未完成的发行步骤。所有归档保留原件；没有全量解压到代码仓库、编译、发布或操作浏览器。

### 实际 Chromium full tar

完整顺序读取本机 `D:/MediaSail-build-0512/chromium-156.0.8078.73.tar.xz`，独立算得 4,422,774,264 字节，SHA-256 与 SHA-512 均匹配第 4 节官方 full 基准。成员总数 1,343,931，其中 regular files 1,179,216、目录 157,652、symlink 7,037、hardlink 26。完整索引为 `chromium-members.jsonl`，结果及所选文件哈希为 `chromium-tar-audit.json`。

只写出经路径检查的必要 regular files 到 `selected/`；所有链接仅索引、不抽取。未发现绝对路径或 `..` 越界成员。两个 Linux sysroot 的 systemd 文件名含字面反斜杠，不适合 Windows 抽取，已明确拒绝；未改动原始源归档。

| 子树 | regular files | 实际结论 |
| --- | ---: | --- |
| FFmpeg | 11,114 | 含实际代码、构建配置和许可 |
| Blink | 20,986 | 含实际源码和许可 |
| Dawn | 49,592 | 含递归源依赖 |
| Dawn 下 DXC src | 18,345 | 含实际代码及 LICENSE.TXT |
| tools/gn | 1,088 | 含 GN 源码与 bootstrap 版本头 |
| third_party/depot_tools | 4,238 | 含源码 |
| 三个 microsoft_* Windows src | 0 | 只有上层构建/元数据，须补源文件 |
| Chromium PGO | Linux profile + lock | 缺目标 Windows PGO |
| V8 builtins profiles | meta、四份 profile、.gitkeep | 已含 15.6.75.25 的实际数据 |

`DEPS`、`chrome/VERSION`、FFmpeg README/BUILD/Chrome win-x64 config/h264dec.c、Blink LICENSE、Dawn DEPS、DXC README/LICENSE.TXT/CodeGenAction.cpp、V8 version header，共 **12 项**与固定官方 commit 的源文件逐字节 SHA-256 一致。三项 Windows 补入文件也与固定官方 commit 一致；证据为 `upstream-keyfile-comparison.json`。这是一组具体抽查，不是对 117 万文件逐个与 Git 对象比对的声明。

版本资料在归档中已齐：LASTCHANGE 指向 Chromium `2f9a11097447f226133bc1a31c787291a5eeab98`；GPU_LISTS_VERSION 同值；DAWN_VERSION/DAWN_COMMIT_HASH 是 `0caf3649477f7c3ffbd4b1ca4764a81b469b1582`；GN bootstrap 为 `2578 (510ec7992c30)`；V8 版本 `15.6.75.25` 与固定 DEPS 的 `235050a0df6db2c9d92a419af2b72fbf3b2dd73b` 对应。

### 已收集的补充源码

`archives/` 保留 **8 个实际源归档**：完整 Windows 包装源码、完整 UGC 子模块源码、DirectX-Headers、WebAuthn、Multimedia Redirection、windows-rs 0.52.0、BrowserSkill 0.4.1、Mediabunny 1.61.3。每项都有成员索引，均无链接或越界路径。完整 URL、hash 与目录映射见 `collected-source-artifacts.json`。

- 两层 UGC 已安全解包为 `packaging/ungoogled-chromium-windows/`，54 + 198 个文件，保留原始 scripts、patches、flags、LICENSE。
- 三个 Windows 固定源码已安全解包到 `overlays/build/src/third_party/` 对应 src 目录，共 81、8、15 个文件，含原始声明。
- `rust-windows-create-0.52.0.zip` 为 35,516,630 字节，SHA-256 `96379ad8ab18901040f007a0fe27431edd7b16db5e3853d90f0f4ee9be5aa926`，SHA-512 匹配固定 downloads.ini。固定 Windows Rust 补丁引用 `vendor/windows-rs-0.52.0/crates/targets/...`，因此必须保留 zip 原始根目录，不能误放成 windows-0.52.0 crate。[固定 Rust 补丁](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/patches/ungoogled-chromium/windows/windows-fix-building-with-rust.patch)

### Windows PGO 与 V8 数据

缺少的 Windows profile 已从固定文件名的官方 GCS 对象取到，锁定 generation `1793042311841323`，核对官方存储 MD5。该对象带 `contentEncoding=gzip`，存储原件与构建输入需分清：

| 形态 | 字节数 | SHA-256 |
| --- | ---: | --- |
| archives/*.profdata.gcs.gz 原始 GCS 字节 | 110,416,711 | `8cf0357d2b7ac4e45018ceee24da72a2483110a60a85cbd056d93ddd72fe2147` |
| build-inputs/chrome/build/pgo_profiles/*.profdata 解压数据 | 511,730,384 | `916714580bb7ce350ae1ed8d27e580bed005273df4aa383b9ac3115187cd413d` |

原始存储 MD5 不应用于透明解压后的文件，gzip 原件也不直接作为 LLVM profdata 使用。完整 URL、generation、原件/解压路径与 hash 在 `profile-inputs.json`。[官方 Windows PGO 对象元数据](https://storage.googleapis.com/storage/v1/b/chromium-optimization-profiles/o/pgo_profiles%2Fchrome-win64-8078-1793037244-d459387cb65a37df804537d0ab2530efbf533140-1f3ddf983a1013f6a0abc513cd3ca62c1c9aef51.profdata)

另实际收集 V8 15.6.75.25 的 meta、x64/x86 及各自 rl profiles 共五份，核对每个 GCS 对象大小和 MD5，另计算 SHA。meta 的 revision 等于 Chromium DEPS 的 V8 commit。这是原 tar 已有数据的可核验备用副本，不列为原 tar 缺失项。[官方 V8 meta](https://storage.googleapis.com/chromium-v8-builtins-pgo/by-version/15.6.75.25/meta.json)

### 后续组装交接

本地对应源资料已可供组装：原始 Chromium full + manifest 指定的两层包装源、Windows 源覆盖归档、Windows profile 和已有生成资料。后续选择性还原与全量补丁/域名检查已在第 9 节完成；full 树和编译未执行。实际 BrowserSkill 适配补丁/依赖声明与同一发行下载地点仍由最终发行组装核验。

固定 `build.py --ci` 在 `build/src/BUILD.gn` 已存在时跳过初始准备块，不能把未 patch 的预填源树直接传给它后宣称准备完成。原 `--tarball` 路径选择 lite；若用本次 full 基底，应明确记录 source kit 的下载配置调整，供给 full 的实际文件与官方 hashes，不能改名冒充 lite。[固定 build.py](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/build.py)

本次没有完整编译或发布；最终发行门槛继续按第 7 节核验。

## 9. 离线源码准备与补丁可应用性实测

**结果：本次所测试的源码准备路径通过，未留下无法解决的实物材料缺口。** 这不是全构建通过结论。只写独占 `D:/MediaSail-build-0512/source-audit/`，原始归档未改动；没有修改主产品代码、操作浏览器或发布。

### 可放入源码 kit 的材料

- `source-kit/restore-source.py`：离线还原/审查工具，不联网，不编译，不自动清理，拒绝覆盖已有审查目录。
- `source-kit/source-kit-manifest.json` 与 `MATERIALS.tsv`：相对 `materials/` 布局，11 份真实输入的大小、SHA-256/512、原始 URL、补入路径；包含完整基底、9 个源/构建输入归档和 gzip Windows PGO。
- `source-kit/README.md`：实际恢复步骤、原 CI 静态配置、动态 Python clang 参数、工作目录与原 `build/src/` 的映射，以及明确的编译边界。
- `source-kit/VERIFICATION.json`、`VERIFICATION.md`：实际结果。完整本机审计在 `patch-review-1/result.json`；逐补丁日志在其 `logs/`；769 个最终补丁目标的 SHA-256 在 `transformed-patch-targets-sha256.json`。

`audit-local-input-map.json` 只用于把本机已有原件映射给本次测试，不属于最终可移植材料布局。发行时应按相对清单实际放入全部文件，不能仅分发脚本和清单。

### 实际执行结果

| 项目 | 核验结果 |
| --- | --- |
| 原始基底 | 再次完整顺序读取，并匹配官方 SHA-256/SHA-512 |
| 选择性审查树 | 18,478 个基底 regular files，776,195,289 字节；不全量展开 117 万源文件 |
| 补丁 | core 110 + Windows 27，共 137 个按 series 顺序实际应用成功 |
| offset / fuzz / failure | **0 / 0 / 0**；没有手改源文件才能通过的补丁 |
| 精确裁剪 | 14,135 项在原基底全部存在且为 regular files，共 1,056,093,330 字节，与补丁目标无交集 |
| 域名替换 | 固定 UGC 原实现处理完整 17,862 项；17,846 个文件改变，0 路径缺失，另 16 项无替换 |
| 变更结果 | 769 个最终补丁目标文件已保存 SHA-256；每个域名改变文件保存前后哈希 |
| 必要 Rust 输入 | 9 个补丁改指向的路径均存在，3 个 import libraries 另验证 archive magic 与哈希 |
| PGO | gzip 原件与实际解压文件均校验；解压文件另验证 LLVM indexed-profile magic |
| 静态配置 | x64、PGO phase 2、is_component_build=false、FFmpeg Chrome codec 集合等与原 CI 配置一致 |
| 目录保护 | 实测拒绝已有输出目录，原 result.json 哈希不变；不执行递归 cleanup |

裁剪在本次还原器中以抽取时省略精确清单成员执行，已对原归档逐项验证存在/类型。这与固定 `build.py` 调用 `prune_files` 在补丁前逐个 unlink 的内容结果相同；没有假称从选择性树里删除了未抽取的二进制。完整原始归档仍保留以供分发。依据为固定 [build.py](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/build.py) 与 [prune_files](https://github.com/ungoogled-software/ungoogled-chromium/blob/6d3e3de2f9d404649842f7457cd3b5ac04dc952f/utils/prune_binaries.py)。

### 新发现并解决的 TypeScript 输入缺口

Windows 固定补丁修改 `third_party/typescript/windows-amd64/src/lib/lib.dom.d.ts`，而 full tar 没有该 Windows 工具输入。因此补取固定 downloads.ini 指定的 TypeScript 7.0.2 官方归档，9,776,626 字节，SHA-256 `61fc4e141d2bc687db580e71bbfa63b9c209f0310645d82ca1b457eb3a24fd19`，SHA-512 `d014371e40071e528b4a9d6a46f7f7494846a46b03ba107f8e0170ef982ecaa6f126a11a4b40b0fd514ef22da71e094953340246d30c47f20100a137113302e2` 与上游锁值一致。原件保留在 archives/，声明文件与 LICENSE 安全抽入审查树；未运行其中编译器。[固定下载配置](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/downloads.ini)、[官方归档](https://github.com/microsoft/TypeScript/releases/download/v7.0.2/typescript-win32-x64.tgz)、[相应固定补丁](https://github.com/ungoogled-software/ungoogled-chromium-windows/blob/c8317bab03c9d861781f58f85286076e4a80439c/patches/ungoogled-chromium/windows/windows-fix-typescript-lib-dom.patch)

其余最初在基底缺失的 5 个 flag headers 均由先前 core 补丁创建；全序列实测证明这些是正常创建顺序，不是额外缺源。

### 配置与结论边界

进一步核对固定原构建发现 `--tarball` 会追加 `chrome_pgo_phase=0`，原发行 CI 的 clone 路径保留 phase 2。因此本还原器独立执行原准备步骤，并保留 phase 2 及固定 Windows PGO，未用 full 改名冒充 lite，也未用 phase 0 冒称原配置。`build.py --ci` 在 BUILD.gn 已存在时跳过初始准备，故不能把未 patch 源树直接交给它并假定准备会自动执行。

只生成实际静态配置与明确的动态参数模板；未提供已安装 Python clang bindings 路径时，不生成会被误当作已准备好的真实 args.gn。实际编译前仍按固定 CI 准备 LLVM/libclang、Python clang 21.1.7、VS/SDK 与其他构建工具。此次没有 GN generation、bindgen、编译、链接或浏览器运行，也没有执行工具的 full 模式。

对应源资料和全补丁适用性证据现已具备本地实物。最终发行仍需携带完整原始基底与所有补件、实际 BrowserSkill 适配源码/声明及离线许可，并验证同一 Release 的接收者下载配套；不得只提供本选择性审查树。

## 10. Microsoft d3dcompiler_47.dll 原始声明与安装呈现

### 已取得准确原件与授权条目

浏览器该 DLL 与 `D:/MediaSail-build-0512/msvc/Windows Kits/10/Redist/D3D/x64/d3dcompiler_47.dll` 逐字节一致，均为 4,753,904 字节，SHA-256 `3e56c1a0867aa04cbca948b3664fcac5d51275865cd044a45a3fd6ce636ee914`，有效 Microsoft 签名，版本 10.0.28000.2705。

本机精简 SDK 没有完整 Licenses 目录，cppwinrt/LICENSE 也不是 SDK 总许可。随后从官方 VS manifest 找到 Win11SDK_10.0.28000、包版本 10.0.28000.5，其 Windows Store Apps Tools MSI 的 SHA-256 与本机已下载 MSI 一致。再取得**同一个官方 SDK 包**中的 EULA MSI 与对应 CAB，核对 manifest SHA-256；只读查询 MSI 表并抽出两个 RTF，没有安装或执行 MSI。

调查目录 `D:/MediaSail-build-0512/source-audit/microsoft-sdk/` 保存 MSI、CAB、文件表、原始来源元数据及原件。可供最终产品复制的原始文件在 `distribution-notices/`：

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Microsoft-Windows-SDK-10.0.28000-LICENSE.rtf | 248,573 | `0f4a26ac9dc50066f8a1bfeaaf3f092d1b9e4791df5487b9f3c31e7c3dc4d7f5` |
| Microsoft-Windows-SDK-10.0.28000-THIRD-PARTY-NOTICES.rtf | 22,279 | `ebb6640a8246b39b70322c5cec9aad7a71e86ea7b86c9c604d3a7f3ff1b30e89` |
| Microsoft-Windows-SDK-REDIST.md | 19,214 | `ff4dc82936ef9e8449927a3d06ee1fca801933c1464ceee60fa14003eb656dd0` |
| Microsoft-Windows-SDK-SOURCES.json | 见文件 | 记载原始 MSI/CAB 地址与 hash、组件范围和来源链 |

EULA MSI SHA-256 为 `da0754c508eb37b7997d5671e2ea10e240e64f375a4558a2730d3772025de517`，签名有效；CAB SHA-256 为 `e5848d03a5b8f81cf277fc146687888b077354605db672b629f827d04a536f36`。[官方 EULA MSI](https://download.visualstudio.microsoft.com/download/pr/8d861047-d6bf-46c3-895e-2ceca5bd8fee/Win11Sdk/Aug2026Servicing28000/Installers/Windows%20SDK%20EULA-x86_en-us.msi)；[官方原件 CAB](https://download.visualstudio.microsoft.com/download/pr/8d861047-d6bf-46c3-895e-2ceca5bd8fee/Win11Sdk/Aug2026Servicing28000/Installers/598442d9f84639d200d4f3af477da95c.cab)

SDK EULA §2(a)(i) 引用的 fwlink 524842 实际跳转 Microsoft 官方 `legal/windows-sdk/redist`。其条目明确包含 Redist/D3D/x64/d3dcompiler_47.dll，可随 Classic Windows applications 分发，不能按 UWP 分发；该页报告源 commit `5517c932e1189e1d731dc4a24ae8f6b2fdf38bd4`、更新日期 2024-10-21。[官方 REDIST](https://learn.microsoft.com/en-us/legal/windows-sdk/redist)

### 真实的同意条件与升级路径

精确条款位置：原始 sdk_license.rtf §2(a)(ii)，忠实文本转换 `sdk_license.rtf.txt` 第 34 行。它明确要求 distributors 和 external end users 同意至少同等保护该 Distributable Code 的条款。SDK 没有规定必须采用何种 checkbox，但仅附声明文件不能证明已满足此同意条件。§2(a)(ii) 的其他条件还包括主要功能、相应未修改分发、程序版权及 Microsoft indemnity；§2(a)(iii) 包含保留 Microsoft 声明、不冒称背书、Microsoft OS 范围等限制。反编译限制在该原件 **§7**、文本第 88 行，不能误标为 §6。

只读检查当前代码发现实际升级路径需单独处理：`desktop/updates.cjs:70` 调用 quitAndInstall(true,true)；`scripts/installer.nsh` 虽将 force-run 更新 SetSilent normal，当前安装的 app-builder-lib `assistedInstaller.nsh:13–15` 仍在默认 licensePage 前执行 skipPageIfUpdated。因此**只配置 nsis.license 不足以证明升级用户会看到并同意该组件条款**。

最小建议是在复制/替换新 DLL 前，提供一个明确仅适用于 Microsoft d3dcompiler_47.dll 的组件许可页，可查看原始 RTF/REDIST；首次安装及升级都检查同一组件/条款的明确同意，不能被 isUpdated 默认跳过。拒绝则不安装该版含该组件的程序。已有相同条款的同意记录可按组件与许可 hash 复用，没有记录时不推定旧版本已经取得同意。无需把整份 SDK 约束扩展到 MediaSail；分发者仍需核对其他 SDK 条件。具体范围要素及精确行号已保存为 `microsoft-sdk/INSTALLATION-SCOPE-RESEARCH.md`。此次未改安装器。

### LGPL 权利是否存在已验证的实际冲突

LGPL 2.1 §6 对相应链接工作要求保留用户修改及为调试这些修改进行逆向的权利。SDK §7 约束其 Microsoft software，§2(a)(iii) 的 Excluded License 文字针对 Microsoft 代码的源码修改/分发，并不是对所有包含其他开源库的 Windows 应用作一概禁止。

当前技术事实是独立未改动的 Microsoft DLL；固定 ANGLE `HLSLCompiler.cpp` 的非 UWP 分支通过 LoadLibraryA 加载 DLL，再使用公开 D3DCompile/D3DDisassemble 导出。Chromium/Blink/FFmpeg 的对应源码与变更输入另外提供，源码准备步骤已实测，无须修改或逆向该 Microsoft DLL。[固定 ANGLE 调用路径](https://chromium.googlesource.com/angle/angle/+/127e783de33425c27a70a3f48da9d9202d6a0745/src/libANGLE/renderer/d3d/HLSLCompiler.cpp)；[固定 LGPL §6](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f/COPYING.LGPLv2.1)

据此，**当前未发现迫使用户为修改/调试 LGPL 部分而必须修改或逆向 Microsoft DLL 的已成立阻断条件**；组件限定条款与开源权利保留可以避免新增一个明确的合同冲突。这是对已核实结构/源码准备路径的判断，不是宣称已完成修改版浏览器的编译/运行。不得为 Microsoft DLL 擅自增加原文未授予的逆向权；也不得把 Microsoft 的反编译限制扩展到 Chromium、Blink、FFmpeg 或 BrowserSkill。若最终产品统一禁令覆盖这些开源部分，就会直接抵触 LGPL §6，必须修正。

当前具体剩余发行门槛是正确落实该组件的下游同意与限定范围，以及其他已列的源码/许可实际分发配套；不是“root BSD 自动覆盖”，也不是已经确认存在必须弃用此 DLL 的许可证冲突。


## 11. bsk 实际静态 CRT：原件、权限边界与明确门槛

研究对象是父任务提供的实际 MSVC 14.51.36231 构建：`D:/MediaSail-build-0512/cargo-target-static/x86_64-pc-windows-msvc/release/bsk.exe`，18,544,128 字节，SHA-256 `2e305f6ed069ec03764e90dd66a8fbb19d1546b4228868be394b7f9f1a9ba7f5`，构建脚本明确使用 `-C target-feature=+crt-static`。独立读取 PE/PDB，先匹配 RSDS GUID/age，再解析 DBI 模块表：574 个总模块中有 libcmt.lib 39、libvcruntime.lib 27、libucrt.lib 197 个，未发现 libcpmt.lib 模块。故这次确实复制了静态 CRT，不能因无 VCRUNTIME/MSVCP imports 就说许可消失。证据及脚本在 `source-audit/microsoft-msvc/bsk-static-crt-evidence.json`、`bsk-pdb-crt-modules.json` 与父目录的 `audit_bsk_static_crt.py`。[LLVM PDB 模块表原理](https://llvm.org/docs/PDB/DbiStream.html)

同一固定官方 VS manifest SHA-256 `417b8d3fee577bdb0e192835692446de51b4626526e4b555162fd9c2fca7dff1` 已保存为 `microsoft-msvc/VisualStudio.vsman`。5 个本地 MSVC VSIX 均与 manifest SHA-256 匹配；libcmt/libvcruntime 另与固定 Desktop VSIX 内文件逐字节一致。文件夹版本 14.51.36231 与包 servicing 版本不同，元数据已分别记录。SDK 的实际 libucrt.lib 为 43,298,182 字节、SHA-256 `9d9c74fc00d0d43b3ded5328d1f197e919236645dfaf80a84ece1f1b99465a1e`，另通过 MSI File 表及对应 CAB 内容证明与同一固定官方 SDK 包逐字节一致；未安装 MSI。

### 组件分别适用何种条款

| 组件/条款 | 已核实结论 |
| --- | --- |
| SDK UCRT 静态代码 | SDK 官方 REDIST 的 Static LIB files（已保存 Markdown 第 48–59 行）明确包括 ucrt/x64；SDK §2(a)(ii) 包括 `.lib` 只分发链接结果、下游保护同意等条件。若保留本 MSVC 候选，SDK 呈现范围需同时写清 bsk 内这一 Microsoft UCRT 部分，不能仍声称只含 D3D DLL。[原始清单](https://learn.microsoft.com/en-us/legal/windows-sdk/redist) |
| Community 工具使用 | Community 2026 原件允许 individual 使用和 OSI 开源应用开发。固定 catalog 的 Community → NativeDesktop → VC.Tools → 同一 CRT Desktop 包链已经验证。可如实记录共享组件、公开 Apache/MIT 项目及适用的 Community 使用依据，不能虚称安装 IDE、持有付费授权或已有未记录的许可同意。[Community 2026 原件](https://visualstudio.microsoft.com/license-terms/vs2026-ga-community/) |
| 专有 libcmt/VCRuntime | Community 的 Distributable Code 条款引用外部清单；保存的 2026 官方清单列 VC/redist，但没有列实际 libcmt.lib、libvcruntime.lib 或 VC/Tools/MSVC/<version>/lib。固定 VSIX 内未找到补充许可，因此这两项的精确分发授权链尚未建立。[2026 官方清单](https://learn.microsoft.com/en-us/visualstudio/releases/2026/redistribution) |
| BuildTools 与 Runtime 原件 | 已分别保存；它们是工具/终端使用条款，不应当作发布者额外分发授权，也不能据此对整个 bsk 增加一份新合同。[BuildTools](https://visualstudio.microsoft.com/license-terms/vs2026-ga-diagnostic-buildtools/)；[Runtime](https://visualstudio.microsoft.com/license-terms/vs2026-ga-visualcpp-v14-redist-runtime/) |
| STL 的公开许可 | 本机 STL 文件为 Apache-2.0 WITH LLVM-exception；vcruntime、UCRT 文件保留 Microsoft 专有声明，且这次 PDB 没有 libcpmt 模块。不能把 STL 许可套到实际 CRT。 |

Microsoft 的官方部署文章确实明确支持将静态库对象链接入应用后部署，所以这里**不作“所有 MSVC 静态应用不能发行”的判断**。但一般部署说明未补齐当前文件/当前条款的清单授权缺口；在本任务要求的逐组件正面证据门槛下，这个 MSVC bsk 候选的许可项不能标通过。用户同意页也不能替发布者补出缺失的复制分发权。[官方静态部署说明](https://learn.microsoft.com/en-us/cpp/windows/deployment-in-visual-cpp?view=msvc-170)

可执行处理：若不能取得覆盖确切静态 MSVC 组件的许可依据，采用父任务提出的**同一 BrowserSkill 源码及适配的 Windows GNU/MinGW 构建**，重新核对产物与实际运行库许可；无需更换浏览器或产品工具。若新 bsk 未复制 SDK UCRT/MSVC CRT，SDK 组件许可页可以继续只覆盖浏览器的 d3dcompiler_47.dll。此次未修改代码、安装器或编译程序。

### 原件路径、精确位置与源码 kit 边界

完整研究、SHA-256 与原始 URL 在 `D:/MediaSail-build-0512/source-audit/microsoft-msvc/STATIC-CRT-RESEARCH.md`、`originals-manifest.json`、`other-product-terms-manifest.json`、`fixed-msvc-package-metadata.json`。BuildTools DOCX SHA-256 `ff03a242ec131e8353643612cdf58ae3d6cc9b51d7dce929351d140ba24a8b83`；Runtime DOCX `08651651a7602fc7c0e2763de0fde1ff9f868df2780597cd1775ee9d6441c783`；Community DOCX `02ac07637f4a513a807cd3721c7620433fc483bc049d25784b0c10c54b05e1fb`。对应忠实文本中，Community 第 12、14–15 行为使用依据，第 51–64 行为分发段（53 为清单、58 为下游条件）；BuildTools 第 9–13、26–32 行和 Runtime 第 8–19 行分别界定使用/范围，不能移花接木作分发授权。

LGPL 2.1 §6 的 compiler/system-component 源码例外界定对应源码范围，不是 Microsoft 复制分发授权，更不是把专有 CRT 变成 Apache/MIT。调查原件/VSIX 只在本地内部留存，不应把 MSVC 编译器、`.lib`、Source VSIX 或专有 CRT 源码直接塞入公开源码 kit。也不能把 Microsoft 对其组件的限制扩展到 Rust/BrowserSkill 或 Chromium/FFmpeg。当前没有从此 bsk 实物核对得到新的 LGPL 调试修改权冲突；明确未通过的门槛是以上专有静态 MSVC 组件授权链。

截至本项研究，父任务已报告第 10 节的 D3D 组件页及升级/静默行为通过真实 NSIS 小包测试；上节原代码检查描述是研究时的历史快照，不再作为“当前升级路径未修复”的结论。这里没有独立复测安装器。


## 12. 正式 gnullvm 候选：运行库实物核验通过

父任务最终使用同一适配 BrowserSkill 的 **Rust x86_64-pc-windows-gnullvm + LLVM-MinGW UCRT** 构建，旧 MSVC bsk 和首次未链接成功的 GNU/MSVCRT 尝试均不发行；未伪造 GCC 兼容库别名。浏览器仍为前述固定 UGC。本节只判断该新 bsk 的运行库来源和声明；产品功能验收及最终打包由父任务执行。

### 固定输入及哈希

官方开发工具为 `llvm-mingw-20261104-ucrt-x86_64.zip`，191,037,046 字节，SHA-256 `552191b5754c49a5a20723276a6fc56541ea1922c4c50b7b669022333fc1b40f`，GitHub API 官方 digest 与本机原件一致。前次 MSVCRT 归档也曾校验，但不是正式输入。两个变体的五份许可原文逐字节相同。[官方发行资产](https://github.com/mstorsjo/llvm-mingw/releases/tag/20261104)

| 输入 | 固定来源 |
| --- | --- |
| llvm-mingw 20261104 | `70bc9a60eec2410124a9e3fe1611929705cb6574`，annotated tag 另保存 |
| LLVM 23.1.5 | `392dfff97d29b59d77e5cac6d4b6ef2585fe7117` |
| MinGW-w64 | `ee9bd87644156c41072a11ad957d1e11831a72df`，固定构建脚本锁定 |
| Rust 1.99.1 | `58cf8f9c35b355199727627d07ae34a4e2846d67`，私有 rustc 与 channel manifest 一致 |
| 实际 bsk.exe | 13,979,136 字节；SHA-256 `5cd02e7aeb2a8ff2fe1326af41140d84f979a2d80c76597b9276eb02dc559694` |
| 同次构建 link-map | 20,335,256 字节；SHA-256 `977e7ad3bc378b052533b42580350124895f2815b8227253e449b5b790e4f11b` |

原件、GitHub API、固定脚本、项目/MinGW source archives、LLVM 各组件 LICENSE 均在 `D:/MediaSail-build-0512/source-audit/gnu-runtime/`。两个源归档分别有 95、7,027 个 regular files，扫描无绝对路径、.. 或链接，未全量抽取。归档的 MinGW runtime、project、ZPL、winpthreads 原文均与固定上游字节一致。[固定 LLVM 配置](https://github.com/mstorsjo/llvm-mingw/blob/70bc9a60eec2410124a9e3fe1611929705cb6574/build-llvm.sh)；[固定 MinGW 配置](https://github.com/mstorsjo/llvm-mingw/blob/70bc9a60eec2410124a9e3fe1611929705cb6574/build-mingw-w64.sh)

### 确实导入系统 UCRT，没有复制 SDK 静态 CRT

独立解析正式 PE 得到 21 个 Windows 系统 DLL/API-set import，其中 11 个 api-ms-win-crt 集合，delay imports 为 0；没有 MSVC、LLVM、GCC、C++ 或 pthread 独立运行库 DLL。正式输出没有直接导入旧 msvcrt.dll，而是调用 Windows 自带 UCRT API-set。Microsoft 官方确认 UCRT 是 Windows 10 及更新系统的 OS 组件；它的系统导入与复制 SDK libucrt.lib 是不同情形。[官方 UCRT 说明](https://learn.microsoft.com/en-us/cpp/windows/universal-crt-deployment?view=msvc-170)

实际 map 的 349 种输入中，核对到 48 个 MinGW runtime 成员（mingw32 14、mingwex 25、UCRT compatibility 9）、3 个 MinGW startup .o、5 个 LLVM libunwind 成员。startup 文件及所审相关 `.a` 均与官方 UCRT ZIP 对应成员字节一致。没有 SDK/MSVC `.lib` 输入、GCC runtime 或 profiling 输入；libc++、libc++abi、winpthread 的 archive 中没有实际映射成员，也未用之前 Rust GNU sysroot 的 crt2/dllcrt2。

该 UCRT 包的 libmsvcrt.a 与 libucrt.a 为同 SHA-256 的开源 import/compatibility archive：`062960e8846d48e81dcb58057c2bcc4f0c466a3ef8bd94879d8f8061b4f9c5e4`。其中 libucrt_extra 命名不表示 Microsoft SDK 实现；已核对的 __getmainargs、amsg_exit、snprintf、vfprintf 等固定源码明确属于 MinGW Public Domain 实现。全部 51 个 startup/MinGW 对象均找到固定源码候选（52 文件），逐项记录 Public Domain、gdtoa 明确许可、无版权限制许可或根 ZPL 默认许可；没有把根 ZPL 当作所有组件的唯一许可。

完整证据为 `bsk-gnullvm-runtime-verification.json`、`bsk-gnullvm-map-inputs.json`、`linked-mingw-source-license-audit.json`。LLD map 有时只记成员名而不记母 archive，材料保留这一局限，以实际 `.a` 成员及官方归档 hash 交叉验证；父任务提供 EXE/map 为同次构建。本研究未声称存在 PE 与 map 的密码学绑定，也未运行产品。

### 最终应随包的原件

应复制 **`source-audit/gnu-runtime/final-distribution-notices/`**，不是此前更宽的 12 文件准备目录。最终为 8 份未改动原件、共 1,543,468 字节，另附可移植来源 JSON：

- MinGW-w64-runtime-COPYING.txt，完整保留 gdtoa 等贡献者声明。
- MinGW-w64-ZPL-2.1-COPYING.txt、MinGW-w64-DISCLAIMER.PD.txt。
- LLVM-libunwind-LICENSE.TXT，覆盖实际 5 个 linked members，保留 Apache/LLVM exception 与 legacy 原文。
- Rust-1.99.1-LICENSE-APACHE、LICENSE-MIT、COPYRIGHT、COPYRIGHT-library.html（均带 Rust-1.99.1 前缀）。

Rust 标准库未包含在应用 Cargo 清单中，因此另保留官方 COPYRIGHT-library.html，1,499,465 字节、SHA-256 `5647be074c8edf7339fd863055923a8fc80bc5610a8d4661ec3b767b9d392c27`。Rust 官方 COPYRIGHT 明确该 HTML 为标准库子集的第三方声明。原始库的多重许可证选择及既有 MPL 源码配套不能因“应用自身 MIT/Apache”被省略。[Rust 固定版权说明](https://github.com/rust-lang/rust/blob/58cf8f9c35b355199727627d07ae34a4e2846d67/COPYRIGHT)；[MinGW 固定运行库声明](https://github.com/mingw-w64/mingw-w64/blob/ee9bd87644156c41072a11ad957d1e11831a72df/COPYING.MinGW-w64-runtime/COPYING.MinGW-w64-runtime.txt)

逐文件 SHA-256、原始 URL、实际适用组件在 `final-distribution-notices-manifest.json` 与随包 GNU-RUNTIME-SOURCES.json 中。亦已制成 `gnu-runtime-notices-gnullvm-1.99.1.zip`，60,803 字节、SHA-256 `5a61de278a7efcc677a9664c45572c2c8ec23615ad4ac5b98ff9f4fc59ead475`；ZIP 通过 CRC/安全路径检查，只有 9 个平面成员，没有编译器、Windows DLL、运行库二进制或本机私人路径。

**本项运行库许可/声明收集门槛通过。** 这些开源运行库条款无需新增安装同意页；当前 bsk 未复制 SDK/MSVC 静态 CRT，Windows 实现留在系统中，SDK 组件页继续只覆盖实际另行分发的浏览器 d3dcompiler_47.dll。不得把 SDK/BuildTools 开发工具约束扩展到 Rust/BrowserSkill。BrowserSkill、Cargo 依赖、浏览器 notices、对应源码同 Release 实际分发及最终打包检查，仍由前述各自材料/父任务完成，本项不替代它们。
