# tools/ — HADE 的卸载 / 还原 / 体检

`hade-uninstall.js` 把「卸载 HADE、让 Claude Code 回到初始状态」做成可体检、可回退、不误伤的确定性操作。

**零依赖**，只用 Node 标准库。Node 是 HADE 的硬依赖（唤醒 hook 要跑它），所以**有 HADE 可卸 ⇒ 必然能跑这个工具**。

---

## 不想敲命令？双击这个

```
tools/HADE-卸载器.cmd
```

浏览器会打开一个界面：装了什么、每项多大、**哪些会删、哪些会保留**并排列出，
还有你装 HADE 之前的原规则、漂移与断链告警、可用备份。

**这个界面只看不动手。** 它在代码层面就没有删除路径 —— 传给子进程的参数是三条硬编码字面量
（`doctor --json` / `uninstall --json` / `restore --json`），界面上的任何输入都进不了命令行。
点「生成卸载命令」只会给你一条填好令牌的命令，你自己粘到终端里跑，
真正的删除仍旧走下面那三道闸。

四条本地安全约束：只绑 `127.0.0.1` · 每次启动随机会话密钥 · 校验 `Host` 与 `Origin` 防 DNS 重绑定 ·
15 分钟无操作自动关闭。跨平台可用 `node tools/hade-ui.js`（加 `--no-open` 则不自动开浏览器）。

---

## 顺带：文档数字体检

```bash
node tools/check-docs.js          # 有过期就报文件与行号，退出码 1
node tools/check-docs.js --json   # 机器可读
```

同一个数字散在 4-5 份分发文档里是**有意的**——拿 zip 的人只读 `GETTING-STARTED.md`，
让 AI 装的只喂 `AGENT-SETUP.md`，两边都得看到「必须连 `hade/` 一起拷」这条致命警告。
合并成单一来源反而害人。

代价是改一处别处就地过期。已经栽过三次：`892 行` / `40 份 eval` / `1499 行`，
每次都是偶然翻到才发现。所以不消除冗余，只让冗余**可校验**：
7 个断言全部从仓库现场量，对不上就报。改完文档、提交前跑一次。

`archive/` 不扫——那里是当时的原话，不该被后来的事实改写。

---

## 三个命令

```bash
node tools/hade-uninstall.js doctor        # 只读扫描，不动任何东西
node tools/hade-uninstall.js uninstall     # dry-run：打印清单 + 发令牌
node tools/hade-uninstall.js restore       # 列出可用备份
```

真执行需要两个参数一起给：

```bash
node tools/hade-uninstall.js uninstall --apply --confirm 确认销毁 --token <8位>
node tools/hade-uninstall.js restore <时间戳> --apply --confirm 确认销毁 --token <8位>
```

在真实终端里手动跑时，可以省掉 `--confirm` 和 `--token`，改走交互式提问。

### 参数

| 参数 | 说明 |
|---|---|
| `--home <路径>` | 覆盖 `~/.claude` 的位置。沙箱测试用，也能修别的机器挂载过来的目录 |
| `--backup-root <路径>` | 覆盖备份落点，默认 `HADE_Vault/uninstall-backups/` |
| `--with-vault` | 把 `~/.hade`（实例化数据仓）也一并移走。默认不动 |
| `--apply` | 真执行（否则一律 dry-run） |
| `--confirm 确认销毁` | 破坏性确认，必须明文 |
| `--token <8位>` | 来自 30 分钟内的一次 dry-run，且清单未变 |

### doctor 的退出码

| 码 | 含义 |
|---|---|
| `0` | 未安装 —— Claude Code 处于初始状态 |
| `1` | 已安装且正常 |
| `2` | 有真异常（`@import` 断链 / JSON 解析失败） |

**本体与仓库副本漂移只报告，不改退出码** —— 本地改了还没同步是常态，不是故障。

---

## 它管哪些

清单来自一次**独立普查**（不预设答案，从"HADE 声明装了什么"和"磁盘上实际有什么"两头查），
不是照着记忆列的。本机实测 13 项。

```
外科式 JSON 键删除（同文件其它内容一律保留）
  settings.json            enabledPlugins.<两个 @hade-vault>
                           extraKnownMarketplaces.hade-vault
  installed_plugins.json   plugins.<两个 @hade-vault>
  known_marketplaces.json  hade-vault

Markdown 行级删除（文件其余内容保留）
  projects/*/memory/MEMORY.md    指向 HADE 桥接指针的那一行索引

整体移走（先备份、校验 hash、再删源）
  CLAUDE.md                      人格层骨架
  hade/                          记忆层
  references/                    参考库（空则跳过）
  plugins/cache/hade-vault/      两个 plugin
  plugins/data/*hade*/           plugin 数据（大小写不敏感，含旧命名残留）
  projects/*/memory/*.md         HADE 写的记忆桥接指针（见下）

卸载后还原（这才是真正的"恢复初始状态"）
  CLAUDE.md.backup* → CLAUDE.md  你装 HADE 之前的原规则，检测到就改回去

可选 · 默认不动（要加 --with-vault）
  ~/.hade/                       实例化数据仓，含 persona / preferences /
                                 profile / relationship 等个人画像

只报告 · 工具永不碰
  ~/.claude.json 的 skillUsage.* / pluginUsage.*   纯计数器，不影响行为
```

**为什么记忆桥接指针必须删**：那是 HADE 按自己的规则（Global §八.3）写进
`projects/*/memory/` 的文件，内容是"HADE 本体在 `~/.claude/CLAUDE.md`，任何 session 先读它"。
memory 会被加载进上下文 —— 卸载后本体没了、指针还在，就成了**指向不存在文件的悬空指针**，
会误导之后每一个新 session。判定要求同时命中 `HADE` 和本体路径两个条件，
所以别的记忆（项目笔记、工具用法）不会被误伤。

`doctor` 会把**同文件里被保留的内容**也列出来，让影响面一眼可见。比如
`settings.json 保留：effortLevel · tui · skipWorkflowUsageWarning · agentPushNotifEnabled`。

### 绝对不碰（代码级硬名单，命中即中止）

- `~/.claude/skills/` —— 那里是与 HADE 无关的 skill
- `~/.claude/backups/` —— Claude Code 自己的备份
- `~/.claude.json` —— 里面的 `projects` 是你的使用痕迹，不是 HADE 装的
- 仓库本身

---

## 卸载后还剩什么，为什么（三向差分实测）

用对照组量过：造一个**从未装过 HADE** 的干净环境 A，和一个装了 HADE 再完整卸载的 B，
逐字节比对。两种起点（本来就有别的 plugin / 从没装过任何 plugin）× 开不开 `--with-vault`，共四轮。

```
① A 有、B 无（多删了）      四轮全空 ✓
② B 有、A 无（没删净）      见下表
③ 同名内容不同（改坏了）    只剩 ~/.claude.json 的使用计数键（设计如此）
```

**方向①四轮全空 = 卸载从未多删过任何东西。** 交叉验证：非 HADE 的 skill、别人的 plugin 注册、
无关的项目记忆、Claude Code 自己的备份与运行时产物，卸载后全部逐字节存活；
被删过一行的 `MEMORY.md` 也与对照组完全一致。

`settings.json` 逐字节回到出厂：个人偏好键的内容与顺序不变，别人的 plugin 保留，
**HADE 安装引入的空容器（`enabledPlugins` / `extraKnownMarketplaces`）会被一并清掉** ——
依据是对照组实证：从没装过任何 plugin 的 `settings.json` 里本来就没有这两个键。

### 剩下的三类，都是有意的

| 残留 | 为什么不删 |
|---|---|
| `plugins/cache/` `plugins/data/` 空目录<br>`installed_plugins.json` `known_marketplaces.json` 空文件 | **这是 Claude Code 的结构，不是 HADE 的**。HADE 只是触发了它们被创建。删掉别人的文件（哪怕现在是空的）超出「卸载 HADE」的授权范围 —— 那才是非必要删除。留空目录无害，删别人的文件有害 |
| `~/.hade/` | 可选项，要 `--with-vault` 才动。里面是个人画像数据，不该随一次 Claude Code 卸载静默消失 |
| `~/.claude.json` 的 `skillUsage` / `pluginUsage` | 纯计数器，不影响行为。该文件在硬名单里，工具永不写它 |

同理，`installed_plugins.json` 的 `plugins` 键**空了也保留**：只有"整个文件不存在也能跑"的实证，
没有"文件在但缺 `plugins` 键也能跑"的实证 —— 没实证就不动。

> 一条诚实的保留：空容器 `{}` 与「键不存在」对 Claude Code 是否**绝对**等价，
> 没有它的源码无法证明。判断依据是从未装过 plugin 的初始状态本来就没有这些键。

### 普查确认干净的面

环境变量 · shell 配置 · PowerShell profile · `%APPDATA%` / `%LOCALAPPDATA%` ·
注册表 `HKCU\Software` 与 `HKCU\Environment` · 用户持久 PATH ·
唤醒 hook 自身（读 3 个文件后 `console.log`，零写入）·
plugin 声明（只有 hooks 和 skills，无 commands / agents / MCP server）

---

## 六道闸

1. **身份校验** —— `~/.claude/CLAUDE.md` 必须同时命中 `§零`、`元规则`、`HADE` 三个锚点才判定为 HADE 本体。不满足就报告并跳过：在别人的机器上，那个路径可能是他自己的规则文件。`hade/cases.md` 同理校验 `M-01` / `反例库`。

2. **令牌把批准绑定到具体清单** —— dry-run 会算出待删项（路径 + 类型 + SHA256）的哈希，取前 8 位作令牌。`--apply` 时**重新扫描重算**，对不上就拒绝。拦的是两件事：你看到的清单和实际要删的不是同一份；以及半小时前的批准被拿来执行现在的操作。令牌 30 分钟过期。

   > **运行时标记不计入 hash。** Claude Code 会往 plugin 缓存里按 PID 写存活标记
   > （`.in_use/<pid>`），开关一次窗口就变。若把它算进去，dry-run 与 apply 之间
   > 只要动过窗口，令牌就会毫无理由地失效 —— 而"让 AI 代跑"全程都在会话里，
   > 正是这个目录最容易变动的场景。所以 `.in_use/` 既不计入 hash，也不计入
   > 显示的体积数字（否则数字会跳，看着像内容变了）。它仍会被一起移走。

3. **`--confirm 确认销毁` 必须明文写在命令行里** —— 不接受环境变量、不接受 `--yes` 缩写。它要在 Claude Code 的权限提示框里一眼可见：命令必须自己喊出"我是破坏性的"。

4. **大小写不敏感匹配** —— Windows 文件系统大小写不敏感，`HADE-core-inline` 这类旧命名残留必须和 `hade-core-hade-vault` 一起命中。

5. **硬名单前置** —— 每个计划项在执行前先过一次名单校验，命中即抛错中止。

6. **回写复活的复检回路** —— 见下。

---

## 会话协议（AI 执行时必须遵守）

AI 可以代跑，但**不能自己批准**。流程固定：

1. 先跑 `uninstall`（dry-run），把清单和令牌完整呈给用户
2. 贴出 Global §七 的破坏性预警块：

   ```
   🛑🛑🛑 DESTRUCTIVE OPERATION 🛑🛑🛑
   对象：… 动作：… 当前状态：… 执行后预期：… 备份落点：…
   回复关键词："确认销毁"才执行
   ```

3. **等用户在对话里明文回复「确认销毁」**
4. 才发起那条 `--apply` 命令

不得跳过第 3 步，不得替用户推断同意。

### 闸 6：跑完必须复检

AI 在会话里执行，意味着 **Claude Code 一定是开着的**，而它可能在退出时把内存里的 plugin 状态回写进 `settings.json`，让刚删掉的注册项复活。所以：

1. 完全退出 Claude Code（整个退出，不是新开窗口）
2. 重新打开
3. `node tools/hade-uninstall.js doctor`

若复检发现注册项回来了，再跑一次 `--apply` 即可 —— 工具是幂等的，此时文件已移走，只剩 JSON 键需要再删一次。

---

## 备份布局

默认落在 `HADE_Vault/uninstall-backups/<时间戳>/`。Vault 父目录**不是 git 仓库**（仓库是它里面的 `HADE-vault/`），所以备份既不污染版本历史，又让 `~/.claude/` 被清得真干净 —— 备份本身不会变成新的残留。

```
2026-08-31T224030/
  manifest.json      ← restore 的唯一依据：来源路径 · 类型 · SHA256 · 父容器键顺序
  home/…             ← 按相对 ~/.claude 的路径原样存放
  json-before/…      ← 改动前整份快照
  json-after/…       ← 改动后整份快照，便于 diff
```

**还原走键级合并，不整份覆盖。** 卸载后你改过 `settings.json` 的其它键不会被吃掉；同时按 `containerOrder` 把父容器恢复成原来的键顺序，让还原结果与卸载前逐字节一致。

---

## 跑不了怎么办

看 [`MANUAL-UNINSTALL.md`](MANUAL-UNINSTALL.md) —— 同一套 13 项清单的手工版，人和 AI 都能照做。代价是失去幂等和自动校验，所以只在 Node 缺失、脚本被改坏、或对方拿到分享包想手工卸时才用。

---

## 验证

沙箱测试 75 项断言全部通过，覆盖：dry-run 零改动、令牌四种拒绝路径 + 运行时标记 churn 不误伤、个人偏好键保留、`skills/` 原封不动、幂等、JSON 键级合并、键顺序恢复、身份校验跳过、**记忆指针精确删除（非 HADE 的记忆和索引行原封不动）**、**`--with-vault` 改变清单则令牌同步改变**、**原规则备份的检测 / 还原 / 复位**、**空容器清理后 restore 仍逐字节一致**。

测试**绝不碰真本体** —— 靠 `--home` 和 `--backup-root` 全程指向沙箱。真机上只跑 `doctor`。
