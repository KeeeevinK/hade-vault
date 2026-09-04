# HADE-vault

[![verify](https://github.com/KeeeevinK/hade-vault/actions/workflows/verify.yml/badge.svg)](https://github.com/KeeeevinK/hade-vault/actions/workflows/verify.yml)

一套让 Claude Code 跨会话保持同一套工作方式的配置，外加把它做出来时**实测**到的几条结论。

**如果你只看一件事，看这个**：Claude Code 的 skill 靠 `description` 语义匹配触发，
而这层匹配**不可靠** —— 同一批测试 query，实测触发率从 **0/9 到 4/4** 不等，
其中一条 skill 隔几小时重测，`description` 与 query **一字未改**，
却从 **4/4 掉到 1/4**。

所以这套系统把规则分了两侧：

```
不能失效的  →  ~/.claude/CLAUDE.md 无条件加载，100% 到场
可以缺席的  →  skill 按需触发，接受它有时不来
```

**推论**：如果你在写 Claude Code 插件，别把「不能漏」的规则放进 skill 的 description 里。
判断一条规则能不能外移，仓库里有[三条实测出来的否决理由](#核心约束)。

支撑材料：22 份原始 eval 结果（[可自己复跑](#这些数字可以自己复跑)）、
1500 行执行记录、10 条决策史，以及每个 commit 都可回滚的完整 git 历史。

**所有断言都在 CI 里跑**，不靠作者担保：

```bash
node tools/tests/uninstall.test.js      # 卸载器 75 项沙箱断言
node tools/tests/roundtrip-audit.js     # 对照组：装过再卸 vs 从未装过，逐字节比对
node tools/check-docs.js                # 文档里的数字有没有过期
node tools/check-context.js             # 常驻上下文开销是多少
```

每次推送自动重跑（[`.github/workflows/verify.yml`](.github/workflows/verify.yml)），
其中「卸载器多删项必须为零」是硬门槛，不满足直接失败。

> **第一次拿到这份仓库，按你的情况挑一条：**
> · 想先搞清这是什么 → 往下读，五分钟看完「这是什么」和「它能干什么」
> · 想装 → [跳到安装](#安装)（三种方式，最轻的一种零影响）
> · 让 AI 代装 → 把 [`AGENT-SETUP.md`](AGENT-SETUP.md) 丢给一个新 session
> · 深入了解设计与实测数据 → [`GETTING-STARTED.md`](GETTING-STARTED.md)
> · 自己换新电脑迁移 → [`MIGRATE.md`](MIGRATE.md)
> · 想卸载或先体检 → [`tools/README.md`](tools/README.md)
> · ⚠️ 含真实个人记录，**勿公开转发** → 见文末[使用与分发](#使用与分发)
> · `INSTALL.md` / `GLOBAL_PATCH.md` 是过时的历史记录，**勿照做**

---

## 这是什么

**不是应用、不是 Agent 框架**，就是"每次开对话都自动带上的一份规则 + 一批按需触发的领域知识"。

它由 Kevin（本仓库作者）与 Claude 在数月协作中长出来，规则里的每一条都对应一次真实的翻车或约定。

装完之后分三层，**各自的生效机制完全不同 —— 这个差异是整套设计的核心**：

```
人格层   ~/.claude/CLAUDE.md 894 行 + hade/cases.md 17 条翻车记录
         无条件加载，100% 生效 —— 每次开 session 必到

唤醒层   SessionStart hook，75 行
         确定触发，吐一句「本体在哪、去读它」的指针

能力层   5 个 skill + 2 个可执行校验器
         概率匹配，实测 0/9 到 4/4 不等 —— 这层不保证生效
```

**最重要的一条设计**：把不能失效的东西放在无条件加载那一侧。
为什么不能反过来，见[核心约束](#核心约束)。

<details>
<summary><b>几个术语（不熟悉 Claude Code 的话先看这里）</b></summary>

- **`~/.claude/`** —— Claude Code 的用户级配置目录。Windows 上是 `C:\Users\<你>\.claude\`。
  放在这里的 `CLAUDE.md` 对**所有项目**生效，每次开会话自动读进上下文。
- **marketplace / plugin** —— Claude Code 的插件机制。一个本地目录只要含
  `.claude-plugin/marketplace.json` 就能当作插件源，用 `/plugin` 命令安装。本仓库就是这样一个源。
- **skill** —— 插件里的按需知识包。每个 skill 有一段 `description`，Claude 拿你这句话
  跟它做**语义匹配**，觉得相关才加载。所以是概率的：说法变一变就可能不触发。
- **hook** —— 插件可以注册在特定事件上执行的脚本。本仓库用的是 `SessionStart`，
  每次开会话必定执行，不依赖概率。
- **本体** —— 指 `~/.claude/CLAUDE.md` 那份规则文件本身（894 行的骨架）。
  仓库里的 `plugins/hade-core/install/CLAUDE.md` 是它的副本，装的时候拷过去。
- **「4/4」「0/9」** —— 实测触发率。4 个测试 query 命中 4 次 / 9 次里 0 次命中。
  测试集与原始结果都在 `plugins/hade-skills/evals/`，[可以自己复跑](#这些数字可以自己复跑)。

</details>

---

## 它能干什么

### 人格层：每次对话自动带上的工作方式

不是"更聪明"，是**行为可预期**。894 行规则里典型的几条：

- 代价不可逆的操作（删除、覆盖、迁移、发布）先发预警，等你明确确认才动手
- 指代有多个可能对象时列候选让你选，不猜
- 连续两次修不好就停下来问具体问题，不进入"再试一个数字"的循环
- 完成后给可复核的证据，不说"应该没问题"

### 长什么样

规则条目是固定的四要素结构（触发 / 动作 / 原因 / 反例），不是散记。原文摘一条：

```
**3. 测试数据隔离** (→ 元A + 元B)
触发：准备测试时
动作：只用默认配置数据；需测试文本时生成给用户自行粘贴
禁：读取用户粘贴的真实数据做测试（污染 + 一旦错了无回退）
原因：真实数据一旦被我污染/误操作 → 不可逆 → 典型"假节省真浪费"
```

**「触发」字段是锚点** —— 没有它，规则读过也不会在对的时刻被想起来。
末尾的 `(→ 元A)` 标的是它归属哪条元规则（全部条目都挂在 3 条公理下）。

记忆层是配套的具体事故，一条一个：

```
### M-04 · 三、对话习惯
2026-05-05 某文档工具"原文窄"我猜 margin / word-break / overflow-wrap /
inline-style 共 5 轮全错。直到拉用户跑 F12 看 innerHTML → 发现
<v:shape style="position:absolute;width:96.6pt"> Word VML 标签把布局卡住。
第一轮就该让用户跑 F12，不该猜。
 - 任何"先试试看"的念头都是猜。试试看 = 不知道因 + 想拿用户当试错回路。
```

规则说"要问不要猜"，记忆层说"上次你猜了 5 轮"。894 行都是这个密度。
实测：给 skill 加一段这样的具体反例，同一道色彩计算题的准确率从 0/3 提到 3/3 ——
起作用的不是新知识，是"你上次在这里错过"。

### 代价：每次会话约 2 万 token

「无条件加载」的另一面是无条件占用。实测字符数：

| | 行数 | 字符 | 其中中文 |
|---|---|---|---|
| 本体 `CLAUDE.md` | 894 | 32,184 | 16,043 |
| 记忆层 `cases.md` | 83 | 2,834 | 1,324 |

粗估 **≈ 2.1 – 2.8 万 token**，每个会话、每个项目、在你打第一个字之前就已经花掉。
长对话里这是实打实被挤掉的空间。

**自己量一遍**（读你机器上真正装着的那份，没装则读仓库副本）：

```bash
node tools/check-context.js
```

它按章节列出占比，直接告诉你砍哪里最有效：

```
 30.5%   9,811 字符  ███████████████  八、HADE 身份与协作原则
 27.2%   8,769 字符  ██████████████   九、HADE 的已知易犯错误模式
 14.7%   4,736 字符  ███████          七、文档维护规则
 12.2%   3,923 字符  ██████           三、对话习惯
```

最重的两章合计 **58%**。降开销有三条路：走[方式 A](#第-1-步--三选一)（只装 skill，
人格层不加载，常驻成本为 **0**）；用空模板换掉记忆层（省 8%）；砍掉对你不成立的章节。

**没测过的部分必须说清楚**：仓库里 22 份实测数据量的是 **skill 触发率**，
不是「装了 HADE 之后任务完成质量的净变化」。
这 2 万多 token 换来多少收益，目前**没有端到端的对照实验支撑** ——
有的只是几百轮协作里作者本人的判断，以及下面那条 0/3 → 3/3 的单点实测。
2026-08 的重构把骨架压掉 24.7% 字节，但那是为结构清晰做的，不是为省上下文，
也没有前后质量对比。

### 能力层：5 个领域 skill + 2 个可执行校验器

| skill | 覆盖什么 | 实测触发率 |
|---|---|---|
| `naming-system` | 希腊词根命名系统，给项目/工具取代号 | 4/4 |
| `visual-zoom-preview` | 可缩放预览的布局陷阱（呼吸比例、单双页对称、焦点锚点） | 4/4 |
| `design-color` | 色彩系统：双通道模型、饱和度禁区、面积约束、并置间距 | 4/4 |
| `single-source-arbitration` | 多路径分配场景的唯一仲裁源数据流架构 | 4/4 → 1/4 ⚠ |
| `local-storage-safety` | Electron/Tauri 数据安全三件套（纯工具容器，规则正文留在本体） | 0/9 ⚠ |

#### 这些数字可以自己复跑

不用信我 —— 测试集与评测器都在仓库里：

```bash
cd <仓库>/plugins/hade-skills/evals
python run_eval_win.py --eval-set converted/naming-system.json \
    --skill-path ../skills/naming-system --runs-per-query 3 --verbose
```

它测的是**已安装 skill 的真实触发**，不注入、不模拟临时名。

> 官方的 `run_eval.py` 在 Windows 上跑不对：它用 `select.select()` 读子进程 stdout，
> 而 Windows 的 `select` 只支持 socket，传 pipe 直接抛 `OSError(WinError 10093)` ——
> 异常被 `except Exception` 吞掉、记为「未触发」，于是**安静地输出一份全 0 的假报告**。
> 这比崩溃危险得多，也正是「量具必须先校准」那条方法论的来源。

#### 两个校验器

**跨项目通用，价值最高** —— 不依赖任何触发机制，随时手动跑
（下面 `<仓库>` 换成你解压/clone 出来的绝对路径）：

```bash
python <仓库>/plugins/hade-skills/skills/design-color/scripts/check_colors.py "#ff3b30" "#34c759"
python <仓库>/plugins/hade-skills/skills/local-storage-safety/scripts/check_electron_safety.py <你的项目根>
```

后者在一个真实项目上抓到过：单实例锁缺失 + userData 未锁定 + `deleteAppDataOnUninstall: true`
三件套全缺，且 userData 目录已经漂移。退出码 0 通过 / 1 有问题，非 Electron 项目自动跳过。

### 比 skill 更值钱的：方法论

重构过程中**实测出来**的几条结论，跨项目通用，全在
[`GETTING-STARTED.md`](GETTING-STARTED.md) 第五节：三种「这条规则不能做成 skill」的否决理由、
「迁走即删原文」的前置条件、量具必须先校准（出现过 5 次假阴性）、
反例是唤醒力的来源、能力充分时工具会被跳过。

### 适合谁

- 反复跟 Claude Code 协作、被同类问题咬过几次、想把教训沉淀下来的人
- 想要一份现成的参照，看看别人怎么组织这类规则的人
- 做 Electron / 桌面工具、需要那两个校验器的人

**不适合**：只偶尔用一次 Claude Code 的人（规则的价值来自反复）；
期待"装上就变强"的人（能力层本来就不保证触发）；
想要通用开箱产品的人 —— 这是一个人的工作方式，不是为你写的。

### 它不干什么

不是 Agent 框架、不接管你的工作流、不联网、不收集任何数据。
装上之后 Claude Code 还是 Claude Code，只是每次开口前先读过同一份规则。

---

## 安装

### 环境要求

| | 要求 | 作者的验证环境 |
|---|---|---|
| Claude Code | 支持 plugin / marketplace 的版本 | 2.1.246 |
| Node | 唤醒 hook 要跑它（方式 B/C 需要） | v22.17.1 |
| Python | 3.8+，两个校验器要跑（缺了不影响 skill 本身） | 3.12.7 |
| Git | 看历史用，非必需 | 2.50.1 |

```bash
claude --version && node --version && python --version
```

### 先理解一件事

**要装的是两样独立的东西**，这是最容易踩空的地方：

```
plugin（能力层 + 唤醒层）   在 Claude Code 里用 /plugin 命令装
                            → 落到 ~/.claude/plugins/cache/

本体（人格层）              两个文件，得你自己拷
                            → 落到 ~/.claude/
```

`/plugin install` **不会**帮你放本体。只装 plugin 不拷本体，
唤醒 hook 每个 session 都会指向一个不存在的文件。

> 下面 `/plugin ...` 开头的是 **Claude Code 内的斜杠命令**，在对话框里敲；
> ```bash 块里的是**终端命令**。两者不要混。

### 第 0 步 · 把仓库放到本机

**拿到的是 zip**（多数情况）：把 `HADE-vault-share-*.zip` 解压到任意位置即可，
里面自带完整 `.git` 历史，但没有 remote —— 能查 `git log`，不能 `git pull`。

**有仓库访问权限**：

```bash
gh auth login                                       # 私有仓库需先认证
git clone https://github.com/<用户>/hade-vault.git
```

**记下绝对路径**，下面统一记作 `<仓库>`。

### 第 1 步 · 三选一

按侵入性从低到高：

| | 装什么 | 对你现有配置的影响 |
|---|---|---|
| **A** | 只装 `hade-skills` | **零影响**。5 个 skill 按需触发，不碰任何现有文件 |
| **B** | A + `hade-core` | 装唤醒 hook，**用你自己的规则**。需要你自备 `~/.claude/CLAUDE.md` |
| **C** | B + 采用本仓库的本体 | **会覆盖你的 `~/.claude/CLAUDE.md`** |

**不确定就先 A。** 它随时能升到 B 或 C，反过来也随时能退。

#### 方式 A · 只装能力层

在 Claude Code 对话框里：

```
/plugin marketplace add <仓库>
/plugin install hade-skills@hade-vault
```

路径要指向**含 `.claude-plugin/` 的那一层**，不是它的父目录。

到此为止即可。得到 5 个 skill，不装 `hade-core` 就没有指针指向问题。

#### 方式 B · 加装唤醒层，内容用你自己的

```
/plugin install hade-core@hade-vault
```

hook 会在每个新 session 开头说「本体在 `~/.claude/CLAUDE.md`，立刻读它」。
**那个路径在你机器上是你自己的规则文件** —— 这正是方式 B 的用途：
你拿到的是「确定性唤醒机制」，规则内容是你的。

若那个文件不存在，指针会指向空气。要么写一份自己的，要么走 C，要么退回 A。

#### 方式 C · 采用本仓库的本体

**这一步会用别人的人格层替换你的。** 先在终端备份：

```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup      # 已有就先备份
```

再拷本体与记忆层，**两个文件都要拷**：

```bash
mkdir -p ~/.claude/hade
cp <仓库>/plugins/hade-core/install/CLAUDE.md      ~/.claude/CLAUDE.md
cp <仓库>/plugins/hade-core/install/hade/cases.md  ~/.claude/hade/cases.md
```

⚠️ `@hade/cases.md` 导入缺失时**静默失败** —— 不报错、不警告，
只是本体里 17 处「见记忆层 M-xx」永远查不到内容。

### 第 2 步 · 记忆层二选一（仅方式 C）

| | 最后一行换成 | 得到什么 |
|---|---|---|
| **带记忆** | `hade/cases.md`（上面就是） | 17 条真实翻车记录，含日期、项目名、原话 |
| **空模板** | `hade/cases.template.md` | 从零积累自己的；骨架规则完整可用，只是少了那层具体经历 |

**随时可擦**：清空 `~/.claude/hade/cases.md` 即可，骨架不受影响。

### 平台差异

`cp` / `mkdir -p` 是 bash 语法。Windows 下用 Git Bash 或 WSL 直接可用；
PowerShell 里换成 `Copy-Item` / `New-Item -ItemType Directory`。
双击式卸载器 `tools/HADE-卸载器.cmd` 仅 Windows，其它平台走 `node tools/hade-uninstall.js`。

### 让 AI 代装

不想自己敲，把这句给一个新 session：

```
读 <仓库>/AGENT-SETUP.md，按它帮我安装 HADE。我要方式 C，带记忆层。
```

`AGENT-SETUP.md` 是 229 行可执行指令，含环境检查、每步验证、四个已知坑的排障。
后半句省一轮 —— 那份文件强制它先问你选 A/B/C。

### 验证

在**仓库目录下**跑（或写脚本的绝对路径）：

```bash
cd <仓库>
node tools/hade-uninstall.js doctor        # 装好后应报 13 项、退出码 1
```

或开个新 session 看开头有没有 `[HADE 唤醒指针]`。

**装完先读一遍已知局限** —— [`GETTING-STARTED.md`](GETTING-STARTED.md) 第七节。
关键一条：5 个 skill 里 `local-storage-safety` 实测触发率 **0/9**，
`single-source-arbitration` 同批 query 重测从 4/4 掉到 1/4。
能力层本来就不保证生效，别按"装了就会自动用上"预期。

完整步骤与排障见 [`MIGRATE.md`](MIGRATE.md)。

### 维护

版本更新：bump `plugin.json` 的 `version` → 卸载重装。
Windows 下改过 plugin 名要清 `~/.claude/plugins/cache/hade-vault`
（文件系统大小写不敏感，旧目录名会被沿用）。

改完文档后跑一次 `node tools/check-docs.js` —— 它把 7 个数字断言与仓库现场比对，
过期就报文件与行号。同一个数字散在四五份分发文档里是有意的，这个脚本让冗余可校验。

---

## 卸载

```bash
cd <仓库>
node tools/hade-uninstall.js doctor        # 只读体检：装了什么、影响面多大
node tools/hade-uninstall.js uninstall     # dry-run，出计划并打印一条带令牌的命令
```

第二条**不会删任何东西**，它打印完整清单，末尾给你一条填好令牌的命令 —— 复制那条去执行。
令牌 30 分钟有效，且只对你刚看到的那份清单有效（中途环境变了会拒绝执行）。
终端还会当面再问一次，手敲「确认销毁」才真动手。

不想敲命令就双击 `tools/HADE-卸载器.cmd`（仅 Windows），浏览器里把删什么/留什么并排看清。

卸载覆盖 HADE 装进 `~/.claude/` 的全部 13 处，**不碰**你的 skill、别人的 plugin、
Claude Code 自己的文件。

> 体检时如果看到「实例化数据仓 `~/.hade`」被列为可选项，**那不是本仓库装的** ——
> 它是另一条实验分支的产物，按本文步骤安装不会产生。工具默认不动它，
> 要一并移走得显式加 `--with-vault`。

**能完全恢复**：全程自动备份，`node tools/hade-uninstall.js restore` 一键装回，
JSON 走键级合并不会吃掉你后来改的键。细节见 [`tools/README.md`](tools/README.md)。

---

## 目录

```
.claude-plugin/marketplace.json      目录文件（列出两个 plugin）
plugins/hade-core/                   人格层：SessionStart 唤醒指针 + 本体安装件
  hooks/session-start.js               → 吐指针，不吐全文
  install/CLAUDE.md                    → 本体全文副本（894 行，随本体更新同步）
plugins/hade-skills/                 能力层：按需 skill，可独立分发
  skills/naming-system/                希腊词根命名系统
  skills/visual-zoom-preview/          可缩放预览布局陷阱
  skills/single-source-arbitration/    唯一仲裁源数据流
  skills/design-color/                 §十 色彩系统 + check_colors.py
  skills/local-storage-safety/         数据安全校验器（纯工具容器，规则正文留本体）
  evals/                               触发率评测：runner + 测试集 + 22 份实测结果
tools/                               卸载 / 还原 / 体检（零依赖 Node，不随 plugin 被删）
  HADE-卸载器.cmd                      → 双击即开可视化界面（只读）
  hade-uninstall.js                    → doctor · uninstall · restore
  hade-ui.js                           → 本地只读 UI 服务
  check-context.js                     → 量 HADE 每个会话吃掉多少上下文
  check-docs.js                        → 查文档里的数字断言有没有过期
  README.md                            → 命令速查 · 六道闸 · 会话协议
  MANUAL-UNINSTALL.md                  → 脚本跑不了时的手工降级路径
archive/
  PLAN-AND-EXECUTION-LOG.md          ★ 完整 Plan + 全部执行记录与实测证据
  decision-log.md                    决策史（10 条）
  HADE_Plan_r2_2026-08-24.md         下一轮计划（hook 容器赌注）
  HADE_PROMPT_收尾轮.md              收尾轮 F1-F4 的原始指令
  HADE_Response_to_B_2026-08-26.md   对外部质疑的逐条回应
  （批0 的 9 份全量快照与 SHA256SUMS.txt 已在 7580e60 脱敏时移除）
GLOBAL_PATCH.md · INSTALL.md         批0/批1 的原始安装文档（已执行完毕，留存备查）
```

---

## 核心约束

**人格层不做成 skill。** skill 是按需加载的，而决定「是否加载人格」的那个主体
必须先有人格 —— 自举悖论。所以人格层走 `~/.claude/CLAUDE.md` 无条件加载 + hook 指针唤醒。

**2026-08-24 实测补充的三条否决理由**（判断一条规则能否 skill 化）：

1. **触发信号在念头里的不能拆** —— 用户输入中无对应文本，description 原理上够不着
2. **信号强度决定成败** —— 弱信号场景会漏，代价不可逆的条目不能只靠一层
3. **已绑定在必然动作上的不能拆** —— 如「改 Global 必先读 Global」，外移是拿确定性换概率

**R3 的前置条件**：迁走即删原文这条，只有在**实测触发率达标**时才成立。
触发率 0 的 skill + 已删的原文 = 规则从体系消失，比留着当死条目更糟。

---

## 给验收者

> 这一节是给要复核这套东西怎么做出来的人看的。只想用的话可以跳过。

| 想确认什么 | 看哪里 |
|---|---|
| **整体完成度、每批的门与结论** | `archive/PLAN-AND-EXECUTION-LOG.md` → 搜「📊 整体完成度」 |
| **每一批的实测数字** | `plugins/hade-skills/evals/results/*.json`（22 个文件，含删原文前后对照） |
| **本体现状** | `~/.claude/CLAUDE.md`（894 行）；仓库内副本 `plugins/hade-core/install/CLAUDE.md` |
| **本体改了什么** | `git log`（重构前基线 **1090 行 / 91052 字节**）。批0 的 9 份快照已随脱敏移出工作区，仍可取回：`git show b4629a8:archive/snapshots-2026-08-24/<文件>` |
| **决策史** | `archive/decision-log.md`（10 条，2026-08-24 从 Global §八 外移至此） |
| **能力层装了什么** | `plugins/hade-skills/skills/`（5 个 skill + 2 个可执行校验器） |
| **卸载能不能信** | `tools/README.md` → 「卸载后还剩什么，为什么」。对照组实测：装过再卸 vs 从未装过，逐字节比对四轮，**多删项为零** |

一句话验收：`git log --oneline` 看做了什么，`archive/PLAN-AND-EXECUTION-LOG.md` 看为什么。

**状态**

- 2026-08-24 形式重构完成（批0 → 批3 + §6.6 校验层 + 结构审查）
- 2026-08-26 收尾轮完成（私有远端 · 同步探针 · 记录清理 · hook 三项核验）
- 2026-09-03 卸载工具链完成（`tools/`：体检 · 卸载 · 还原 · 只读可视化界面）

下一轮 Plan 见 `archive/HADE_Plan_r2_2026-08-24.md`。

**远端**：`https://github.com/<用户>/hade-vault`（**private**）。
异地 clone 已验证：commits/HEAD/文件数一致。
（`.gitattributes` 的 `* -text` 禁止行尾转换 —— 归档哈希、批处理文件、跨平台 diff 都靠它，理由见该文件注释。）

**数字口径**（此前混用致飘忽，现钉死）：行数按换行符分段计，末尾换行算一段，
故 `wc -l` 会少 1；字节按磁盘实际存储计，本机为 CRLF。

---

## 使用与分发

这是一套私人协作系统的快照，不是通用软件。里面有真实记录：`hade/cases.md`
的 17 条翻车记录带日期、项目名和原话，多份文档直接引用协作者本人的话，
git 历史的早期提交者字段留有一个真实邮箱（后续提交已改用 noreply 地址，
但历史按既定裁决保持完整，未改写）。

**可以**自用、修改、按 [`GETTING-STARTED.md`](GETTING-STARTED.md) 挑对你成立的部分。
**不要**转为公开仓库、推到公开托管、或原样转发给第三方。

未附开源协议 —— 标准协议都不贴合这类内容，默认保留一切权利。
