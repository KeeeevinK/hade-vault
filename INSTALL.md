> ⛔ **过时文件，请勿照做。**
> 这是原作者机器上 2026-08-24 的一次性执行记录，含他的绝对路径、机器名，
> 以及已废弃的旧 plugin 名（`HADE-skills` → 现为 `hade-skills`）与已执行完的 GLOBAL_PATCH 步骤。
> **要安装请读 [`AGENT-SETUP.md`](AGENT-SETUP.md)**（给 AI 的执行指令）
> 或 [`GETTING-STARTED.md`](GETTING-STARTED.md)（给人的介绍）。
> 本文件仅作历史留存。

# INSTALL — 批0 + 批1 安装与验证

> 目标机器：Windows（laptop-286paatu）。以下命令在**本机 Claude Code session** 里执行。
> 全程不需要联网，不需要 GitHub —— 本地 marketplace 即可。

---

## 步骤 0 · 解压到位

把 `HADE-vault/` 整个目录放到：

```
E:\HuaweiMoveData\Users\Kevin\Desktop\HADE_Vault\HADE-vault\
```

## 步骤 1 · 初始化 git（第一个回滚点）

```powershell
cd E:\HuaweiMoveData\Users\Kevin\Desktop\HADE_Vault\HADE-vault
git init
git add -A
git commit -m "批0: 仓库骨架 + 本体全量快照归档(9份) + 批1 三个 skill"
```

此后每一批改动一个 commit。**`git log` 就是回滚点清单，取代日期后缀快照堆。**

## 步骤 2 · 应用 GLOBAL_PATCH 的改动 1、2

见 `GLOBAL_PATCH.md`。先扩保险箱，再装东西。

## 步骤 3 · 装 plugin

```
/plugin marketplace add E:\HuaweiMoveData\Users\Kevin\Desktop\HADE_Vault\HADE-vault
/plugin install HADE-skills@hade-vault
/reload-plugins
```

暂**不要**装 `HADE-core` —— 唤醒层要等能力层验证通过后再上（见步骤 6）。

## 步骤 4 · 确认 skill 已加载

```
/plugin list
```

应看到 `HADE-skills` 及其 3 个 skill：`naming-system` / `visual-zoom-preview` /
`single-source-arbitration`。

## 步骤 5 · 跑 eval（批1 的 gate）

测试集在 `plugins/HADE-skills/evals/*.json`，每个 skill **3 条正例 + 1 条负例**。

用 `skill-creator` 的脚本跑对照（需要 `claude -p`，Claude Code 里可用）：

```
scripts/run_eval.py     # 出触发率
scripts/run_loop.py     # description 自动优化闭环（60/40 训练/留出，每 query 跑 3 次，最多 5 轮）
```

**通过标准**：
- 3 条正例触发率 ≥ 目标值（先跑一轮看 baseline，再定阈值 —— 不预设数字）
- 1 条负例**不**触发（防过触发；description 写得 pushy 的副作用就在这里暴露）

跑不过 → 改 description，**不改正文**。正文是逐字搬来的，已校验与原 references 零差异。

## 步骤 6 · 真实 session 验证 + 上唤醒层

eval 过了之后，在一个真实项目 session 里自然地说一句
"这个新工具起个代号"，看 `naming-system` 是否被唤起。

确认后再装人格层：

```
/plugin install HADE-core@hade-vault
/reload-plugins
```

新开一个 session，应在最开头看到「[HADE 唤醒指针]」几行，并且 HADE 立刻去读
`~/.claude/CLAUDE.md`。

## 步骤 7 · 应用 GLOBAL_PATCH 改动 3

只有前面全部通过，才做 §十一 整章退役 + 删除 `~/.claude/references/` 三个文件。

---

## 已实测 / 未实测（诚实分栏）

**已实测：**
- ✅ 三个 SKILL.md 正文与原 references **逐字零差异**（`diff` 校验通过）
- ✅ 全部 JSON（marketplace / 2×plugin / hooks / 3×evals）解析通过
- ✅ `session-start.js` 在 node 下运行，输出符合预期
- ✅ `${CLAUDE_PLUGIN_ROOT}` 变量名、hooks.json schema、SessionStart 纯 stdout 进上下文
  —— 均已对官方文档核验（非训练记忆）

**未实测（需要在你本机验证）：**
- ⬜ 本地路径 marketplace 在 Windows 下的 `/plugin marketplace add` 行为
- ⬜ hook 在 Windows 上的实际执行（已用 `command: "node"` + `args` 的 exec 形式
  规避 shell 差异，但没在 Windows 上跑过）
- ⬜ skill 的实际触发率（这正是步骤 5 要测的东西）

---

## 回滚

任何一步出问题：

```powershell
git reset --hard HEAD        # 仓库回到上一个 commit
/plugin uninstall HADE-skills@hade-vault
```

本体从未被本轮改动 —— `archive/snapshots-2026-08-24/` 里有 9 份完整快照，
`archive/SHA256SUMS.txt` 可校验完整性。
