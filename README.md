# HADE-vault

HADE 的可安装体 —— 一个 git 仓库同时是 marketplace、备份保险箱、版本化历史。

**HADE 是什么**：一套让 Claude Code 跨 session 保持同一套工作方式的配置。
不是应用、不是 Agent 框架，就是"每次开对话都自动带上的一份规则 + 一批按需触发的领域知识"。
它由 Kevin 与 Claude 在数月协作中长出来，规则里的每一条都对应一次真实的翻车或约定。

装完之后分三层，各自的生效机制完全不同：

```
人格层   ~/.claude/CLAUDE.md 894 行 + hade/cases.md 17 条翻车记录
         无条件加载，100% 生效 —— 每次开 session 必到

唤醒层   SessionStart hook，75 行
         确定触发，吐一句「本体在哪、去读它」的指针

能力层   5 个 skill + 2 个可执行校验器
         靠 description 概率匹配，实测 0/9 到 4/4 不等 —— 这层不保证生效
```

**最重要的一条设计**：把不能失效的东西放在无条件加载那一侧。
为什么不能反过来，见下面「核心约束」。

---

## 它能干什么

### 人格层：每次对话自动带上的工作方式

不是"更聪明"，是**行为可预期**。894 行规则里典型的几条：

- 代价不可逆的操作（删除、覆盖、迁移、发布）先发预警，等你明确确认才动手
- 指代有多个可能对象时列候选让你选，不猜
- 连续两次修不好就停下来问具体问题，不进入"再试一个数字"的循环
- 完成后给可复核的证据，不说"应该没问题"

配套的 17 条记忆层是**真实翻车记录**（带日期、项目名、原话）。规则说"要问不要猜"，
记忆层说"上次你猜了 5 轮全错，直到让用户开 F12 才发现是 Word VML 标签"。
实测：加了具体反例的 skill，手算准确率从 0/3 提到 3/3。

### 能力层：5 个领域 skill + 2 个可执行校验器

| skill | 覆盖什么 | 实测触发率 |
|---|---|---|
| `naming-system` | 希腊词根命名系统，给项目/工具取代号 | 4/4 |
| `visual-zoom-preview` | 可缩放预览的布局陷阱（呼吸比例、单双页对称、焦点锚点） | 4/4 |
| `design-color` | 色彩系统：双通道模型、饱和度禁区、面积约束、并置间距 | 4/4 |
| `single-source-arbitration` | 多路径分配场景的唯一仲裁源数据流架构 | 4/4 → 1/4 ⚠ |
| `local-storage-safety` | Electron/Tauri 数据安全三件套（纯工具容器，规则正文留在本体） | 0/9 ⚠ |

**两个校验器跨项目通用，价值最高** —— 不依赖任何触发机制，随时手动跑：

```bash
python .../design-color/scripts/check_colors.py "#ff3b30" "#34c759"
python .../local-storage-safety/scripts/check_electron_safety.py <项目根>
```

后者在一个真实项目上抓到过：单实例锁缺失 + userData 未锁定 + `deleteAppDataOnUninstall: true`
三件套全缺，且 userData 目录已经漂移。退出码 0 通过 / 1 有问题，非 Electron 项目自动跳过。

### 比 skill 更值钱的：方法论

重构过程中**实测出来**的几条结论，跨项目通用，全在
[`GETTING-STARTED.md`](GETTING-STARTED.md) 第五节：三种「这条规则不能做成 skill」的否决理由、
「迁走即删原文」的前置条件、量具必须先校准（出现过 5 次假阴性）、
反例是唤醒力的来源、能力充分时工具会被跳过。

### 它不干什么

不是 Agent 框架、不接管你的工作流、不联网、不收集任何数据。
装上之后 Claude Code 还是 Claude Code，只是每次开口前先读过同一份规则。

> **第一次拿到这份仓库？**
> · 人读 → [`GETTING-STARTED.md`](GETTING-STARTED.md)（三种采用方式 · 坑 · 方法论）
> · 让 AI 装 → [`AGENT-SETUP.md`](AGENT-SETUP.md)（可直接执行的安装指令）
> · 自己换新电脑 → [`MIGRATE.md`](MIGRATE.md)（完整迁移：骨架 + 记忆层 + skill）
> · 想卸载 / 先体检 → [`tools/README.md`](tools/README.md)（双击 `tools/HADE-卸载器.cmd` 开可视化界面）
> · 拿到这份 zip 的人 → 先看本文末尾「使用与分发」（含真实个人记录，勿公开转发）
> · `INSTALL.md` / `GLOBAL_PATCH.md` 是过时的历史记录，**勿照做**

> **状态**
> · 2026-08-24 形式重构完成（批0 → 批3 + §6.6 校验层 + 结构审查）
> · 2026-08-26 收尾轮完成（私有远端 · 同步探针 · 记录清理 · hook 三项核验）
> · 2026-09-03 卸载工具链完成（`tools/`：体检 · 卸载 · 还原 · 只读可视化界面）
>
> 完整执行记录见 `archive/PLAN-AND-EXECUTION-LOG.md`。
> 下一轮 Plan 见 `archive/HADE_Plan_r2_2026-08-24.md`。

---

## 验收入口（新 session 从这里开始）

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

**远端**：`https://github.com/<用户>/hade-vault`（**private**）。
异地 clone 已验证：commits/HEAD/文件数一致。
（`.gitattributes` 的 `* -text` 禁止行尾转换 —— 归档哈希、批处理文件、跨平台 diff 都靠它，理由见该文件注释。）

**数字口径**（此前混用致飘忽，现钉死）：行数按换行符分段计，末尾换行算一段，
故 `wc -l` 会少 1；字节按磁盘实际存储计，本机为 CRLF。

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

## 安装

需要：Claude Code（支持 plugin / marketplace）· Node（唤醒 hook 要跑它）·
Python 3.8+（两个校验器要跑，缺了不影响 skill 本身）。

**要装的是两样独立的东西**，这是最容易踩空的地方：

```
plugin（能力层 + 唤醒层）   走 /plugin 命令 → ~/.claude/plugins/cache/
本体（人格层）              两个文件，得自己拷 → ~/.claude/
```

`/plugin install` **不会**帮你放本体。只装 plugin 不拷本体，
唤醒 hook 每个 session 都会指向一个不存在的文件。

### 第 0 步 · 先把仓库弄到本机

```bash
git clone https://github.com/<用户>/hade-vault.git      # 私有仓库，需先 gh auth login
```

或把 `HADE-vault-share-*.zip` 解压出来（无 remote，两台机器将来要手动合并）。
**记下绝对路径**，下面记作 `<仓库>`。

### 第 1 步 · 选一种采用方式

按侵入性从低到高，三选一：

| | 装什么 | 对你现有配置的影响 |
|---|---|---|
| **A** | 只装 `hade-skills` | **零影响**。5 个 skill 按需触发，不碰任何现有文件 |
| **B** | A + `hade-core` | 装唤醒 hook，**用你自己的规则**。需要你自备 `~/.claude/CLAUDE.md` |
| **C** | B + 采用本仓库的本体 | **会覆盖你的 `~/.claude/CLAUDE.md`** |

不确定就先 A。它随时可以升到 B 或 C，反过来也随时能退。

#### 方式 A · 只装能力层

```
/plugin marketplace add <仓库>              ← 指向含 .claude-plugin/ 的那一层
/plugin install hade-skills@hade-vault
```

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

**这一步会用别人的人格层替换你的。** 先备份：

```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup      # 已有就先备份
```

再拷本体与记忆层（**两个文件都要拷**）：

```bash
mkdir -p ~/.claude/hade
cp <仓库>/plugins/hade-core/install/CLAUDE.md      ~/.claude/CLAUDE.md
cp <仓库>/plugins/hade-core/install/hade/cases.md  ~/.claude/hade/cases.md
```

⚠️ `@hade/cases.md` 导入缺失时**静默失败** —— 不报错、不警告，
只是本体里 17 处「见记忆层 M-xx」永远查不到内容。

### 第 2 步 · 记忆层二选一（仅方式 C）

| | 命令末行换成 | 得到什么 |
|---|---|---|
| **带记忆** | `hade/cases.md`（上面就是） | 17 条真实翻车记录，含日期、项目名、原话 |
| **空模板** | `hade/cases.template.md` | 从零积累自己的；骨架规则完整可用，只是少了那层具体经历 |

**随时可擦**：清空 `~/.claude/hade/cases.md` 即可，骨架不受影响。

### 平台差异

`cp` / `mkdir -p` 是 bash 语法。Windows 下用 Git Bash 或 WSL 直接可用；
PowerShell 里换成 `Copy-Item` / `New-Item -ItemType Directory`。
双击式卸载器 `tools/HADE-卸载器.cmd` 仅 Windows；其它平台走 `node tools/hade-uninstall.js`。

### 让 AI 代装

不想自己敲，把这句给一个新 session：

```
读 <仓库>/AGENT-SETUP.md，按它帮我安装 HADE。我要方式 C，带记忆层。
```

`AGENT-SETUP.md` 是 229 行可执行指令，含环境检查、每步验证、四个已知坑的排障。
后半句省一轮 —— 那份文件强制它先问你选 A/B/C。

### 验证

```bash
node tools/hade-uninstall.js doctor        # 装好后应报 13 项、退出码 1
```

或开个新 session 看开头有没有 `[HADE 唤醒指针]`。

**装完先读一遍已知局限** —— [`GETTING-STARTED.md`](GETTING-STARTED.md) 第七节。
关键一条：5 个 skill 里 `local-storage-safety` 实测触发率 **0/9**，
`single-source-arbitration` 同批 query 重测从 4/4 掉到 1/4。
能力层本来就不保证生效，别按"装了就会自动用上"预期。

完整步骤与排障见 [`MIGRATE.md`](MIGRATE.md)，让 AI 代劳见 [`AGENT-SETUP.md`](AGENT-SETUP.md)。

### 维护

版本更新：bump `plugin.json` 的 `version` → 卸载重装。
Windows 下改过 plugin 名要清 `~/.claude/plugins/cache/hade-vault`
（文件系统大小写不敏感，旧目录名会被沿用）。

改完文档后跑一次 `node tools/check-docs.js` —— 它把 7 个数字断言与仓库现场比对，
过期就报文件与行号。同一个数字散在四五份分发文档里是有意的，这个脚本让冗余可校验。

---

## 卸载

```bash
node tools/hade-uninstall.js doctor        # 只读体检：装了什么、影响面多大
node tools/hade-uninstall.js uninstall     # dry-run，出计划 + 发令牌
```

不想敲命令就双击 `tools/HADE-卸载器.cmd`，浏览器里把删什么/留什么并排看清。
真执行需要 `--apply --confirm 确认销毁 --token <8位>`，且终端会当面再问一次。

卸载覆盖 HADE 装进 `~/.claude/` 的全部 13 处，**不碰**你的 skill、别人的 plugin、
Claude Code 自己的文件。`~/.hade`（实例化数据仓，若存在）默认保留，
要一并移走得显式加 `--with-vault`。

全程有备份，`restore` 可一键装回。细节见 [`tools/README.md`](tools/README.md)。

---

## 使用与分发

这是一套私人协作系统的快照，不是通用软件。里面有真实记录：`hade/cases.md`
的 17 条翻车记录带日期、项目名和原话，多份文档直接引用协作者本人的话，
git 历史的早期提交者字段留有一个真实邮箱（后续提交已改用 noreply 地址，
但历史按既定裁决保持完整，未改写）。

**可以**自用、修改、按 [`GETTING-STARTED.md`](GETTING-STARTED.md) 挑对你成立的部分。
**不要**转为公开仓库、推到公开托管、或原样转发给第三方。

未附开源协议 —— 标准协议都不贴合这类内容，默认保留一切权利。
