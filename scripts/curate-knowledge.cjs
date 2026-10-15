const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const policy=require('./knowledge-policy.cjs');
const yaml=require('js-yaml');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const slash=p=>p.split(path.sep).join('/');
function walk(root,prefix=''){
 const out=[];
 for(const e of fs.readdirSync(path.join(root,prefix),{withFileTypes:true})){
  const rel=prefix?prefix+'/'+e.name:e.name;
  if(e.isSymbolicLink())throw new Error('Symbolic link in staged knowledge: '+rel);
  if(e.isDirectory())out.push(...walk(root,rel));else out.push(rel);
 }return out;
}
function header(source){
 const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
 const front=match?match[1]:'';
 const name=front.match(/^name:\s*(.+)$/m)?.[1]?.trim();
 const layer=front.match(/^layer:\s*(.+)$/m)?.[1]?.trim()||'produce';
 let description;try{description=yaml.load(front)?.description||'';}catch{description='';}
 description=String(description).replace(/\s+/g,' ').trim();
 return {front,name,layer,description,body:match?source.slice(match[0].length):source};
}
const fenceExecution=/\b(?:python3?|node|npm|npx|pnpm|yarn|ffmpeg|ffprobe|curl|wget|bash|redbook|openclaw|clawhub|remotion|pip3?)\b|\.py(?:\s|$)|\.sh(?:\s|$)|\.ps1(?:\s|$)|\$ROOT|<ROOT>/i;
function neutralize(markdown,{method=false}={}){
 let text=markdown.replace(/\r\n/g,'\n');
 // Shell recipes belong in the verified Windows helper guide. Keep data, formulas,
 // text examples and professional prose; only retire command execution blocks.
 text=text.replace(/(^|\n)([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n[ \t]*\3(?=\n|$)/g,(whole,lead,indent,fence,lang,body)=>{
  const shell=/^(?:bash|sh|shell|powershell|ps1|cmd|bat|zsh)\b/i.test(lang.trim());
  if((method&&shell)||fenceExecution.test(body)){
   const comments=body.split('\n').filter(l=>/^\s*#\s+[^!]/.test(l)).map(l=>l.replace(/^\s*#\s*/,''));
   return lead+'> 实现说明：使用当前 Agent 可用的工具完成本节目标；旧版命令不随本版提供。'+(comments.length?'\n> 原例的处理目的：'+comments.join('；'):'');
  }return whole;
 });
 // Old runtime injection is neither available nor needed for an external agent.
 text=text.replace(/^.*(?:TURN_REMINDER|persona_prefix|\[PERSONA[:_]|\[PROFILE[:_]|系统(?:已|会|自动).*注入|自动注入.*(?:画像|Profile)|每轮.*(?:先读|必读|技能路由)).*$/gmi,'');
 text=text.replace(/easel-profiles\//g,'profiles/').replace(/<ROOT>|\$\{ROOT\}|\$ROOT/g,'<workspace>');
 text=text.replace(/\bpython3\s+(?=skills\/)/g,'python ');
 if(method){
  // Backtick commands are implementation details; parameter/visual examples stay.
  text=text.replace(/`([^`\n]+)`/g,(whole,value)=>fenceExecution.test(value)?'当前 Agent 的相应工具':whole);
  text=text.replace(/^.*(?:SDK 已|SDK已|内置.*(?:SDK|Remotion|FFmpeg|whisper)|bootstrap\.sh|安装.*(?:npm|Node\.js)|调.*硅基流动|SILICONFLOW_|MODEL_REGISTRY|skills\/shared\/scripts\/(?:ai_|audio_|video_|image_|tts|asr|render_|install_)).*$/gmi,'');
  text=text.replace(/(?:必须|强制|一律)(?:先)?(?:调用|使用|执行|运行)[^。\n]*(?:工具|脚本|技能|命令|SDK)[。]?/g,'可以采用当前 Agent 的工具实现相同目标。');
  text=text.replace(/(?:Remotion|Hyperframes|FFmpeg|ffmpeg)\s*(?:引擎|管线|产线)/g,'所选制作工具');
  text=text.replace(/^.*(?:配置检查路径铁律|闭源强制优先|配音必须闭源|VOICE_PROVIDER|配了.*key.*闭源|完全没配.*闭源|已部署.*技能可执行|FFmpeg.*已安装|不要现场手拼 ffmpeg|不要手拼 ffmpeg|每个操作调对应子命令).*$/gmi,'根据任务选择可用工具，核对实际声音/画面质量，不预设供应商或本地已安装的引擎。');
  text=text.replace(/^.*(?:python\s+skills\/|ffmpeg\s+-[iy]|ffprobe\s+-|npm\s+(?:install|run)|npx\s+|pip\s+install).*$/gmi,'');
  text=text.replace(/去 AI 门（强制）|去 AI \+ 质量门（强制，不可跳过）|去 AI 化（强制）/g,'表达风格与质量自检（可选参考）');
  text=text.replace(/不达标先改再交付/g,'分数用于定位改进点，结合任务判断是否需要修改');
  text=text.replace(/\*\*不要手拼[^*\n]+\*\*/g,'可以按任务选择实现方式，保留时间轴与同步关系。');
  text=text.replace(/\b(?:VOICE_PROVIDER|IMG_BASE_URL|VOICE_BASE_URL)\b/g,'所选工具配置');
 }
 // A method may propose a sequence; it cannot impose an agent-wide ceremony.
 text=text.replace(/触发场景（沾边就用）/g,'适用场景').replace(/必须走.*五层[^。\n]*[。]?/g,'可按任务选择相关方法。');
 text=text.replace(/仅在有竞品账号且配置了 Playwright\/Firecrawl MCP 时执行。/g,'有竞品账号和可访问的公开材料时，可用外部 Agent 自己的工具观察。').replace(/无 MCP 工具时跳过并在报告中注明。/g,'没有可获得的材料时注明缺口，也可使用用户提供的数据。');
 text=text.replace(/（\*\*不要自己心算加权\*\*）/g,'（可使用该脚本或自己的工具复现相同公式）');
 text=text.replace(/\n{4,}/g,'\n\n\n');
 return text;
}
function curatePayload({payloadRoot,sourceRoot}={}){
 if(!payloadRoot)throw new Error('payloadRoot is required');
 const payload=path.resolve(payloadRoot),root=path.join(payload,'easel');
 if(sourceRoot){const source=path.resolve(sourceRoot);if(root===source||source.startsWith(root+path.sep)||root.startsWith(source+path.sep))throw new Error('Staging root overlaps source');}
 const mf=path.join(payload,'manifest.json');
 const manifest=JSON.parse(fs.readFileSync(mf,'utf8'));
 if(!fs.existsSync(path.join(root,'skills/openclaw')))throw new Error('Missing staged skills');
 const keepScripts=new Set(policy.keptScripts), excludedFiles=[],sanitizedFiles=[],knowledgeFiles=[];
 const put=(rel,bytes)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
 const drop=rel=>{fs.unlinkSync(path.join(root,rel));excludedFiles.push(rel);};
 for(const rel of walk(root)){
  if(!rel.startsWith('skills/'))continue;
  const match=rel.match(/^skills\/openclaw\/([^/]+)\/(.+)$/),name=match?.[1],sub=match?.[2];
  if(policy.RETIRED_SKILLS.has(name)){drop(rel);continue;}
  // Retire engine/system installation material, generic executors and their fixtures.
  const isCode=/\.(?:py|js|cjs|mjs|ts|tsx|jsx|sh|ps1|bat|cmd|whl|exe|dll|zip)$/i.test(rel);
  const engine=/\/vendor\/|\/node_modules\/|\/(?:deps|tests|__pycache__)\//.test(rel);
  const rootSystem=/(?:^|\/)(?:AGENTS\.md|TURN_REMINDER(?:\.md)?|SOUL\.md|HEARTBEAT\.md|openclaw\.json)$/.test(rel);
  if(rootSystem||engine||isCode&&!keepScripts.has(rel)||/skill-xhs-analyzer\/(?:package(?:-lock)?\.json|references\/commands\.md)$/.test(rel)){
   if(rel.endsWith('/video-pipeline-sdk/LICENSE'))put('skills/openclaw/video-production/references/upstream-sdk-LICENSE.txt',fs.readFileSync(path.join(root,rel)));
   // Copy professional video knowledge out of the vendor SDK before retiring it.
   if(rel.includes('/video-pipeline-sdk/references/')&&rel.endsWith('.md')&&!rel.endsWith('remotion-pipeline-SNAPSHOT.md')){
    const target='skills/openclaw/video-production/references/'+path.basename(rel);
    put(target,neutralize(fs.readFileSync(path.join(root,rel),'utf8'),{method:true}));knowledgeFiles.push(target);
   }
   drop(rel);continue;
  }
  if(match&&!policy.BUSINESS.has(name)&&!rel.endsWith('.md')&&!/\/(?:LICENSE|NOTICE)(?:\.[^/]*)?$/i.test(rel)&&!/^references\/.*\.(?:png|jpg|jpeg|svg|webp)$/i.test(sub)){
   drop(rel);continue;
  }
  if(rel.endsWith('.md')){
   const original=fs.readFileSync(path.join(root,rel),'utf8');
   let next=neutralize(original,{method:!!match&&(!policy.BUSINESS.has(name)||name==='skill-xhs-analyzer')});
   if(name==='skill-social-performance-review')next=next.replace(/\*\*先把标准化数据落成 JSON，交给 `scripts\/review\.py` 做确定性计算，再由你解读。\*\*\n不要手算互动率、不要心排 Top\/Bottom、不要心算环比和加权评分。/,'可以把标准化数据交给 scripts/review.py 做确定性计算，也可使用自己的工具复现同一口径。保留分母选择、缺值处理、权重归一和数据质量说明，再结合业务解释。评分是本方法采用的经验口径，不是跨平台统一交付门槛。');
   if(name==='skill-wechat-publisher'){
    next=next.replace(/### 阶段 5\.5：AI 味自检 gate（publish\.py 内置强制拦截）[\s\S]*?(?=###|##|$)/,'### 阶段 5.5：可选文字诊断\n\nai_score.py 是正则与句长统计的经验诊断，没有调用模型，也无法证明文本由谁生成。本版发布默认不以它阻断草稿创建；可把原分值、权重与示例用于比较同一批稿件，不作为跨任务强制门槛。具体内容质量由 Agent 结合用户目标判断。\n\n');
    next=next.replace(/^> \*\*不要调用[^\n]+$/gm,'').replace(/9 条强制清单/g,'9 条表达自检参考').replace(/每条阈值、完整禁用词表、改写示例\*\*必须逐条对照\*\*/g,'具体阈值、词表示例与改写方法可按需查阅');
    next=next.replace(/^\| 生成配图[^\n]+$/gm,'| 配图创作 | 由外部 Agent 自主完成 | 通用图像执行器不随软件提供 |');
   }
   if(name==='skill-douyin-upload')next=next.replace(/\*\*马上调用 `ask_user` 工具弹【验证码卡片】要码——不要用普通文字消息\*\*[^\n]*/,'如平台要求验证码，由用户通过当前 Agent 或软件支持的输入方式提供；不假设外部 Agent 具有旧 ask_user 卡片协议。');
   next=next.replace(/^.*检测\s*`=== EASEL ACCOUNT PROFILE ===`.*$/gm,'从当前任务指定的画像或连接资料的 selectedProfile 提示定位 profiles/<名称>/；没有系统自动注入全文。');
   if(name==='video-strategy'){
    next=next.replace(/### 2\. 选择制作方案[\s\S]*?(?=### 4\.)/,'### 2. 选择制作方案\n\n先根据表达目标、已有素材、预算、可修改性和复用需求判断：程序化适合重复和数据驱动；生成画面适合补充原创镜头；真人/数字呈现适合讲述；剪辑适合已有素材重组。外部 Agent 自选当前可用工具，不预设引擎、模型或供应商。\n\n### 3. 生成画面的质量判断\n\n比较画质、运动控制、时序与角色一致性、镜头长度、音频需求、成本、版权和数据处理方式。版本、规格与价格变化很快，按实际工具核对，不使用旧厂商表作为本版承诺。提示词方法继续见 [ai-video-prompting.md](references/ai-video-prompting.md)。\n\n');
    next=next.replace(/### 5\. 程序化视频框架[\s\S]*?(?=### 6\.)/,'### 5. 实现方式\n\n需要数据驱动或批量复用时，明确内容变量、版式规则、时间轴和导出规格，再选择合适的制作工具。复杂动效看表达需要与维护成本，工具选择不代替创意判断。\n\n');
    next=next.replace(/### 7\. Agent 可直控的管线[\s\S]*?(?=## 常见错误)/,'### 7. 自主实现与回存\n\n外部 Agent 结合画像、平台和素材，自主完成制作；内容成品及报告按项目元数据契约回存。软件不附带通用制作引擎。\n\n');
    next=next.replace(/Hyperframes\/Remotion 建模板/g,'用所选工具建立可复用结构').replace(/85% 社媒视频静音观看，必须加字幕/g,'考虑静音观看与无障碍场景，按内容提供可读字幕');
   }
   if(sub==='SKILL.md'){
    const h=header(next),kind=policy.BUSINESS.has(name)?'business':'method';
    // Strip agent-framework installation metadata, keep business name/layer/description.
    const description=kind==='method'?(h.body.match(/^#\s+(.+)$/m)?.[1]||name)+'的专业方法资料；由外部 Agent 自选工具实现。':h.description||name;
    next='---\nname: '+name+'\ndescription: '+JSON.stringify(description)+'\nlayer: '+h.layer+'\nkind: '+kind+'\n---\n\n'+h.body;
    next=next.replace(/\n(# [^\n]+)\n/,'\n$1\n\n> 本文保留上游专业方法。步骤、参数和评分属于可选择的经验口径，按任务判断适用性；不是固定审批或每轮执行协议。创作由外部 Agent 选择工具。软件业务脚本以 [业务工具清单](../../business-tools.md) 为准。\n');
   }
   if(next!==original){put(rel,next);sanitizedFiles.push(rel);}
   knowledgeFiles.push(rel);
  }
 }
 // Explicit method edits preserve source-specific expertise and replace whole old
 // state-machine/SDK recipes, rather than blindly renaming an engine in commands.
 const overrides=require('./knowledge-overrides.cjs');
 for(const [name,body]of Object.entries(overrides)){
  const rel='skills/openclaw/'+name+'/SKILL.md';
  if(!fs.existsSync(path.join(root,rel)))continue;
  put(rel,body);if(!sanitizedFiles.includes(rel))sanitizedFiles.push(rel);
 }
 put('skills/shared/README.md','# 共享业务资料\n\n本目录保留业务计算、账号/登录、采集/发布、日历和成果登记支持。准确可运行脚本见 [业务工具清单](../business-tools.md)。\n\n## 专业知识\n\n- [热点资料](hotlist-apis.md)：原聚合源与数据结构说明；来源可用性以实际查询为准。\n- [内容支柱与节奏](pillar-and-cadence.md)：策划方法与案例。\n- [评分维度](scoring-dimensions.md)：经验性分析维度及标尺，非统一交付门槛。\n\n通用图像、音频、视频、字幕、模型供应商执行器不随本版提供；外部 Agent 自选工具，不从旧 README 猜测不存在的脚本或依赖。目录名与业务 Python 路径保持兼容，不依赖 OpenClaw。\n');
 sanitizedFiles.push('skills/shared/README.md');
 // Keep WeChat's deterministic optional diagnostic, but do not turn its
 // heuristic into a mandatory creative/publishing quality gate.
 const wechat='skills/openclaw/skill-wechat-publisher/scripts/publish.py';
 if(fs.existsSync(path.join(root,wechat))){
  const before=fs.readFileSync(path.join(root,wechat),'utf8');
  let after=before.replace(/skip_ai_score: bool = False/g,'skip_ai_score: bool = True');
  after=after.replace(/("--skip-ai-score",\s*\n\s*action="store_true",)/,'$1\n        default=True,');
  if(after!==before){put(wechat,after);sanitizedFiles.push(wechat);}
 }
 // Remove dangling local links left by retired executors; keep their descriptive
 // text and point to the explicit retirement list, never pretend a missing tool exists.
 for(const rel of walk(root).filter(p=>p.startsWith('skills/')&&p.endsWith('.md'))){
  const file=path.join(root,rel),before=fs.readFileSync(file,'utf8');
  const after=before.replace(/(!?)\[([^\]]+)\]\(([^)]+)\)/g,(whole,bang,label,href)=>{
   if(/^(?:https?:|#|mailto:|data:)/.test(href)||href.includes('<'))return whole;
   const target=href.split('#')[0];if(!target)return whole;
   const resolved=path.resolve(path.dirname(file),decodeURI(target));
   const generated=['skills/business-tools.md','skills/curation-report.json','skills/KNOWLEDGE.md','skills/knowledge-index.json'];
   return fs.existsSync(resolved)||generated.includes(slash(path.relative(root,resolved)))?whole:label+'（旧实现已退出，参见 skills/business-tools.md）';
  });if(after!==before){put(rel,after);if(!sanitizedFiles.includes(rel))sanitizedFiles.push(rel);}
 }
 const index=fs.readdirSync(path.join(root,'skills/openclaw'),{withFileTypes:true}).filter(e=>e.isDirectory()).flatMap(e=>{
  const document='skills/openclaw/'+e.name+'/SKILL.md';if(!fs.existsSync(path.join(root,document)))return[];
  const h=header(fs.readFileSync(path.join(root,document),'utf8'));
  return [{name:e.name,title:h.body.match(/^#\s+(.+)$/m)?.[1]||e.name,description:h.description,layer:h.layer,kind:policy.BUSINESS.has(e.name)?'business':'method',document,scripts:policy.keptScripts.filter(p=>p.startsWith('skills/openclaw/'+e.name+'/'))}];
 });
 const present=policy.keptScripts.filter(p=>fs.existsSync(path.join(root,p)));
 put('skills/knowledge-index.json',JSON.stringify(index,null,2)+'\n');
 const md=['# MediaSail 业务能力与专业方法索引','','目录名 openclaw 是兼容旧版的路径，不表示需要 OpenClaw。外部 Agent 按任务查阅；无需逐项执行。业务数据和计算留在本机，研究、解释与创作由外部 Agent 自主完成。','','## 业务能力与分析方法','',...index.filter(e=>e.kind==='business').map(e=>'- ['+e.title+'](openclaw/'+e.name+'/SKILL.md)：'+e.description),'','## 创作方法（不绑定制作工具）','',...index.filter(e=>e.kind==='method').map(e=>'- ['+e.title+'](openclaw/'+e.name+'/SKILL.md)：'+e.description),'','方法原文来自固定 Easel 基线；保留作者署名、LICENSE/EASEL-META。数值经验不等于平台官方保证。'];
 put('skills/KNOWLEDGE.md',md.join('\n')+'\n');
 put('skills/business-tools.md',['# 业务工具与退出范围','','以下脚本保留在可写工作目录。先读帮助与方法文档，再按任务使用；无需运行每个脚本。PowerShell 用 Skill 的 mediasail.ps1 python 入口，工作目录自动设为 workspace。脚本中的相对路径从该目录解释。','','## 可运行的业务脚本','',...present.map(p=>'- `'+p+'`'),'','## 业务依赖边界','','- Python 与业务库由软件提供。平台网页采集/登录/发布通过 Playwright 使用系统 Chrome/Edge；未安装时由用户或外部 Agent 准备。FFmpeg、Node、OpenClaw、图像/语音/视频模型不随包提供。','- 公众号 Markdown/HTML 转换和官方草稿适配保留。ai_score 是正则/统计启发式，非 AI 检测事实；选用参考不等于交付门槛。multi_publish 是可选外部 Wechatsync 适配，其浏览器插件/Node 不随包提供，不属于默认能力。','- 数据tracker、发布日志、账号快照各有数据契约，不能因字段同名混算；详见接入 Skill 的画像与分析文档。','','## 已退出的实现','','通用生图、视频、音频、字幕、剪辑、卡片渲染、文档转换等脚本，以及视频产线 SDK、模型供应商适配、安装脚本、OpenClaw 系统指令不随安装包提供。混合技能中的专业方法继续可读，纯工具型技能不再进入默认列表；外部 Agent 自选可用工具完成。没有另发旧工具包；原始实现可在固定上游及 Git 历史查阅。','','退出文件和改写文档的准确清单见 [curation-report.json](curation-report.json)。'].join('\n')+'\n');
 const report={schema:1,upstream:manifest.upstream,keptScripts:present,excludedFiles:excludedFiles.sort(),sanitizedFiles:sanitizedFiles.sort(),knowledgeFiles:[...new Set(knowledgeFiles)].sort(),index:'skills/knowledge-index.json'};
 put('skills/curation-report.json',JSON.stringify(report,null,2)+'\n');
 manifest.files={};for(const rel of walk(root))manifest.files[rel]=digest(fs.readFileSync(path.join(root,rel)));
 fs.writeFileSync(mf,JSON.stringify(manifest,null,2)+'\n');return report;
}
module.exports={curatePayload,neutralize,header};
if(require.main===module){const report=curatePayload({payloadRoot:process.argv[2],sourceRoot:process.argv[3]});console.log(JSON.stringify({keptScripts:report.keptScripts.length,excludedFiles:report.excludedFiles.length,sanitizedFiles:report.sanitizedFiles.length,knowledgeFiles:report.knowledgeFiles.length}));}
