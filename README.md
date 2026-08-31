# HADE-vault

HADE 的可安装体 —— 一个 git 仓库同时是 marketplace、备份保险箱、版本化历史。

> **第一次拿到这份仓库？**
> · 人读 → [`GETTING-STARTED.md`](GETTING-STARTED.md)（三种采用方式 · 坑 · 方法论）
> · 让 AI 装 → [`AGENT-SETUP.md`](AGENT-SETUP.md)（可直接执行的安装指令）
> · 自己换新电脑 → [`MIGRATE.md`](MIGRATE.md)（完整迁移：骨架 + 记忆层 + skill）
> · `INSTALL.md` / `GLOBAL_PATCH.md` 是过时的历史记录，**勿照做**

> **状态：2026-08-24 形式重构完成（批0 → 批3 + §6.6 校验层 + 结构审查）；
> 2026-08-26 收尾轮完成（私有远端 · 同步探针 · 记录清理 · hook 三项核验）。**
> 完整执行记录见 `archive/PLAN-AND-EXECUTION-LOG.md`。
> 下一轮 Plan 见 `archive/HADE_Plan_r2_2026-08-24.md`。

---

## 验收入口（新 session 从这里开始）

| 想确认什么 | 看哪里 |
|---|---|
| **整体完成度、每批的门与结论** | `archive/PLAN-AND-EXECUTION-LOG.md` → 搜「📊 整体完成度」 |
| **每一批的实测数字** | `plugins/hade-skills/evals/results/*.json`（40 个文件，含删原文前后对照） |
| **本体现状** | `~/.claude/CLAUDE.md`（892 行）；仓库内副本 `plugins/hade-core/install/CLAUDE.md` |
| **本体改了什么** | `git log`（重构前基线 **1090 行 / 91052 字节**，快照见 git 历史） |
| **决策史** | `archive/decision-log.md`（10 条，2026-08-24 从 Global §八 外移至此） |
| **能力层装了什么** | `plugins/hade-skills/skills/`（5 个 skill + 2 个可执行校验器） |

一句话验收：`git log --oneline` 看做了什么，`archive/PLAN-AND-EXECUTION-LOG.md` 看为什么。

**远端**：`https://github.com/<用户>/hade-vault`（**private**）。
异地 clone 已验证：commits/HEAD/文件数一致。
（`.gitattributes` 的 `* -text` 保证 CRLF 不被改写。）

**数字口径**（此前混用致飘忽，现钉死）：行数按换行符分段计，末尾换行算一段，
故 `wc -l` 会少 1；字节按磁盘实际存储计，本机为 CRLF。

---

## 目录

```
.claude-plugin/marketplace.json      目录文件（列出两个 plugin）
plugins/hade-core/                   人格层：SessionStart 唤醒指针 + 本体安装件
  hooks/session-start.js               → 吐指针，不吐全文
  install/CLAUDE.md                    → 本体全文副本（892 行，随本体更新同步）
plugins/hade-skills/                 能力层：按需 skill，可独立分发
  skills/naming-system/                希腊词根命名系统
  skills/visual-zoom-preview/          可缩放预览布局陷阱
  skills/single-source-arbitration/    唯一仲裁源数据流
  skills/design-color/                 §十 色彩系统 + check_colors.py
  skills/local-storage-safety/         数据安全校验器（纯工具容器，规则正文留本体）
  evals/                               触发率评测：runner + 测试集 + 40 份实测结果
archive/
  PLAN-AND-EXECUTION-LOG.md          ★ 完整 Plan + 全部执行记录与实测证据
  decision-log.md                    决策史（10 条）
  snapshots-2026-08-24/              批0 全量快照（9 份，SHA256 可校验）
  SHA256SUMS.txt
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

```
/plugin marketplace add <本仓库路径>
/plugin install hade-skills@hade-vault      # 能力层，可给任何人装
/plugin install hade-core@hade-vault        # 人格层，只给自己装
```

版本更新：bump `plugin.json` 的 `version` → 卸载重装。
注意 Windows 下改 plugin 名后需清 `~/.claude/plugins/cache/hade-vault`
（文件系统大小写不敏感，旧目录名会被沿用）。
