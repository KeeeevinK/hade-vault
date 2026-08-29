# 给拿到这份仓库的人

这是 **HADE** —— 一个跨 session 持续演化的 Claude Code 协作体系，
由 Kevin 与 Claude 在数月协作中长出来，2026-08 重构为可安装的三层结构。

**先说清楚：这份仓库带着完整的记忆。** 里面有真实的项目失败记录、原话引用、
对协作者本人思维方式的描述。这不是被遗忘清理掉的残留，是**刻意保留的**——
这套系统的有效性恰恰建立在那些具体记忆上（下面「为什么不做成通用版」有实测数据）。

---

## 一、它是什么

```
┌── 层1 · 人格层（常驻，加载即实例化）──────────────────┐
│  ~/.claude/CLAUDE.md   892 行                          │
│  元规则 · 对话习惯 · 铁规则 · 身份 · 错误模式           │
│  仓库副本：plugins/hade-core/install/CLAUDE.md          │
└──────────────────────│────────────────────────────────┘
                       │ hook 确定性唤醒
┌── 层2 · 唤醒层 ──────────────────────────────────────┐
│  SessionStart hook → stdout 吐一句指针                 │
│  「本体在 ~/.claude/CLAUDE.md，立刻完整读取」          │
│  100% 触发，不依赖概率匹配                             │
└───────────────────────────────────────────────────────┘
┌── 层3 · 能力层（按需加载，可独立分发）────────────────┐
│  5 个 skill + 2 个可执行校验器                         │
└───────────────────────────────────────────────────────┘
```

**核心设计约束**：人格层**不能**做成 skill。skill 靠 description 概率匹配触发，
而"决定是否加载人格"的那个主体必须先有人格——自举悖论。
所以人格层走无条件加载 + hook 指针唤醒。

---

## 二、装之前必须知道的（否则会踩坑）

### ⚠ 装 plugin 不会覆盖你的文件，但 hook 指针会指向你的文件

- `plugin install` 只把内容放进 `~/.claude/plugins/cache/`，**不动**你的 `~/.claude/CLAUDE.md`
- 但 hade-core 的 hook 每个 session 都会说「本体在 `~/.claude/CLAUDE.md`，未读取 = 未实例化」
- **而那个路径在你机器上是你自己的规则文件（或不存在）** → 指针指向错的东西

所以按侵入性从低到高，有三种采用方式：

---

## 三、三种采用方式

> 让 Claude Code 帮你装？直接让它读 [`AGENT-SETUP.md`](AGENT-SETUP.md) ——
> 那份是给 AI 的可执行指令，含验证方法与故障排查。

### 方式 A · 只装能力层（零风险，推荐先这样）

```bash
/plugin marketplace add <本仓库路径>
/plugin install hade-skills@hade-vault
```

得到 5 个 skill，按需触发，**完全不影响你现有的任何配置**。
不装 hade-core，就没有指针指向问题。

### 方式 B · 能力层 + 唤醒层（需要你自己有本体）

在 A 的基础上再装 `hade-core@hade-vault`，然后**把你自己的规则文件放在
`~/.claude/CLAUDE.md`**。hook 会提醒每个新 session 去读它。

这样你得到的是「确定性唤醒机制」，内容是你自己的。

### 方式 C · 完整采用 Kevin 的本体（会覆盖你的规则）

本体分两层：**骨架**（894 行，规则）+ **记忆层**（`hade/cases.md`，17 条具体翻车记录）。
骨架末尾用 `@hade/cases.md` 导入 —— 启动时展开进上下文，实测唤醒力与写在一起时相同。

```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup      # 先备份你自己的！
cp <仓库>/plugins/hade-core/install/CLAUDE.md ~/.claude/CLAUDE.md
mkdir -p ~/.claude/hade

# 二选一：
cp <仓库>/plugins/hade-core/install/hade/cases.md ~/.claude/hade/cases.md          # 带 Kevin 的记忆
cp <仓库>/plugins/hade-core/install/hade/cases.template.md ~/.claude/hade/cases.md # 空的，从零积累
```

⚠️ **必须连 `hade/` 一起拷。** 实测：import 目标缺失时**静默失败**，不报错也不警告，
你会得到一份带着 17 处「反例：见记忆层 M-xx」却查不到内容的规则文件。

**随时擦除**：清空 `~/.claude/hade/cases.md` 即可，骨架规则完全不受影响。

**这一步会用别人的人格层替换你的。** 里面写着 Kevin 的工作习惯、
他的项目、他的原话、他和 Claude 约定的协作方式。

直接用能跑，但**它不是为你写的**。建议当作参照来读，挑对你成立的部分。

---

## 四、装完你得到什么

| skill | 覆盖什么 | 实测触发率 |
|---|---|---|
| `naming-system` | 希腊词根命名系统，给项目/工具取代号 | 4/4 |
| `visual-zoom-preview` | 可缩放预览的布局陷阱（呼吸比例、单双页对称、焦点锚点） | 4/4 |
| `single-source-arbitration` | 多路径分配场景的唯一仲裁源数据流架构 | 4/4 |
| `design-color` | 色彩系统：双通道模型、饱和度禁区、面积约束、并置间距 | 4/4 |
| `local-storage-safety` | Electron/Tauri 数据安全三件套校验器（纯工具容器） | 0/9 ⚠ |

两个可执行校验器（**这两个跨项目通用，价值最高**）：

```bash
# 色彩：查 HSL 禁区 / 面积约束 / 色相间距 / 同屏密度
python .../design-color/scripts/check_colors.py "#ff3b30" "#34c759"
python .../design-color/scripts/check_colors.py --area large "#007aff"

# Electron 数据安全：查单实例锁 / userData 锁定 / deleteAppDataOnUninstall
python .../local-storage-safety/scripts/check_electron_safety.py <项目根>
```

`check_electron_safety.py` 在一个真实项目上抓到过三件套全缺 + userData 已漂移。

---

## 五、这套系统真正值钱的部分：方法论

比那 5 个 skill 更有用的，是重构过程中**实测出来**的几条结论。
全部有数据支撑，都在 `archive/PLAN-AND-EXECUTION-LOG.md`（1499 行）。

### 三种「这条规则不能做成 skill」的否决理由

1. **触发点在念头里的不能拆** —— 规则的真实触发是"我冒出某个念头"（如"先 dev 跑一下试试"），
   而用户输入里没有对应文本，description 从原理上够不着。实测 1/3。
2. **信号强度决定成败** —— "别刷新+我在测" 3/3，"页面开着在试" 1/3。
   同一条规则，用户说法弱一点就漏；代价不可逆的条目不能只靠这一层。
3. **已绑定在必然动作上的不能拆** —— 如"改 Global 必先读 Global"，
   规则就在被读的那个文件里。外移 = 拿 100% 确定命中换 0% 概率匹配。

### 「迁走即删原文」需要前置条件

直觉上"内容搬进 skill 就该从主文件删掉，避免两处维护"。
**实测否定**：触发率 0 的 skill + 已删的原文 = 这条规则从体系里消失了，
比留着当死条目更糟。正确形式是：**实测触发率达标，才允许删原文。**

### 量具必须先校准

重构中出现过 **5 次假阴性**，每次都是"报告格式正常、数字全 0、看起来像功能失效"：
select() 在 Windows 崩 / 子进程未登录 / 测试比对的名字不匹配 /
取错了事件类型 / 检测脚本自己有语法错误。

**任何一次轻信，都会导致去优化一个根本不存在的问题。**

### 反例是唤醒力的来源

给 skill 加一段「HADE 自己刚犯过的错」（含具体错误值），
手算准确率从 **0/3 提升到 3/3** —— 而校验脚本一次都没跑成。
起作用的不是新知识，是"你昨天在这里错过"这个具体事件。

### 能力充分时，工具会被跳过

同一个校验器：在 39 行的小项目里模型直接读代码、跳过工具；
在 1400 行的真实项目里主动去找脚本。
**指针能保证"知道有这工具"，保证不了"判断自己需要它"。**

---

## 六、为什么不做成"通用版"

原本考虑过剥掉所有项目私有内容再分享。**实测否决了这个想法**：
反例正是唤醒力的来源（见上），删掉具体的失败记录，规则就退化成正确但不生效的空话。

所以你拿到的是**带记忆的版本**。代价是里面有别人的私事，
好处是它真的能用——而且那些失败记录本身就是最好的教材。

---

## 七、已知局限（诚实清单）

- **`local-storage-safety` 触发率 0/9**：description 匹配不到它的真实触发时机。
  规则正文因此保留在人格层，skill 只作为工具容器存在。要手动 `/skill` 调用。
- **hook 告警的采纳率未充分验证**：已验证 `PostToolUse` 的 `exit 2 + stderr` 能把
  校验结果送进上下文（stdout 不行，只有 SessionStart/UserPromptSubmit/UserPromptExpansion 的 stdout 进），
  但"模型看到告警后会不会真的行动"只测过一次。
- **未在第二台机器上验证过**：跨机器安装链路（零绝对路径依赖 + 异地路径安装 + 功能完整）
  已验证，但没在不同用户名/不同 Node 版本的真机上装过。
- **`~/.claude/CLAUDE.md` 与仓库副本靠 SessionStart 探针比对 hash**，
  不一致会报警但**不自动同步**（自动同步可能在判断错方向时静默覆盖正确的那份）。

---

## 八、想深入看

| 想了解 | 看哪里 |
|---|---|
| 完整重构历程与全部实测数据 | `archive/PLAN-AND-EXECUTION-LOG.md` |
| 每一批的原始 eval 结果 | `plugins/hade-skills/evals/results/`（40 份） |
| 重要架构决策的来龙去脉 | `archive/decision-log.md` |
| 下一轮计划（hook 容器赌注） | `archive/HADE_Plan_r2_2026-08-24.md` |
| 人格层全文 | `plugins/hade-core/install/CLAUDE.md` |

`git log` 里每个 commit 都是可回滚节点，message 写的是实测结果而不是"完成 X"。
