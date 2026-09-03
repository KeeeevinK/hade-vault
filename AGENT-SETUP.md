# 安装执行指令（给 Claude Code 读）

> 你正在帮用户安装 **HADE** —— 一套从别人的协作体系里长出来的 Claude Code 三层架构。
> 本文件是**可直接执行的指令**，不是介绍。介绍在 `GETTING-STARTED.md`。
>
> ⚠️ **不要读 `INSTALL.md`** —— 那是原作者机器上 2026-08-24 的一次性执行记录，
> 含他的绝对路径与已废弃的旧 plugin 名，照做会失败。

---

## 环境要求（先确认，省得装到一半才发现）

| | 要求 | 原作者验证环境 |
|---|---|---|
| Claude Code | 支持 plugin / marketplace 的版本 | 2.1.246 |
| Python | **3.8+**（两个校验器需要） | 3.12.7 |
| Node | hook 用（仅方式 B/C 需要） | v22.17.1 |
| Git | 看历史用，非必需 | 2.50.1 |

```bash
python --version && node --version && claude --version
```

Python 缺失不影响 skill 本身，只影响两个校验脚本。

---

## 第 0 步 · 先问用户，不要自己决定

这份仓库带着**原作者的完整人格层**（`plugins/hade-core/install/CLAUDE.md`，894 行），
里面是他的工作习惯、项目历史、原话。

**在做任何事之前，把下面三种方式给用户看，让他选一个：**

| | 装什么 | 对用户现有配置的影响 |
|---|---|---|
| **A** | 只装 `hade-skills` | **零影响**。5 个 skill 按需触发，不碰任何现有文件 |
| **B** | `hade-skills` + `hade-core` | 装 hook。用户需自备 `~/.claude/CLAUDE.md`（用他自己的规则） |
| **C** | A/B + 采用原作者的人格层 | **会覆盖用户的 `~/.claude/CLAUDE.md`** |

**默认推荐 A。** 用户没明确选 C 之前，**绝对不要**复制 `install/CLAUDE.md`
到 `~/.claude/CLAUDE.md`。那会用别人的人格替换掉用户自己的规则。

---

## 方式 A · 只装能力层（零风险）

```
/plugin marketplace add <本仓库的绝对路径>
/plugin install hade-skills@hade-vault
```

**注意**：marketplace 路径要指向**解压后 `HADE-vault` 目录本身**
（里面有 `.claude-plugin/marketplace.json` 的那一层）。

### 验证装成功

⚠️ **不要靠找 hook 事件判断**。原作者在这里踩过坑：PostToolUse 之类的 hook
**不产生** `hook_started` / `hook_response` 事件，只有 SessionStart 产生。
拿"事件不存在"当"没装上"会得出错误结论。

正确做法 —— 开一个新 session，确认这 5 个 skill 出现在可用列表里：

```
hade-skills:naming-system
hade-skills:visual-zoom-preview
hade-skills:single-source-arbitration
hade-skills:design-color
hade-skills:local-storage-safety
```

或者直接功能验证（更可靠）：新 session 里说一句
**「帮我给这几个状态标签配色」** —— 应触发 `design-color`。

---

## 方式 B · 加装唤醒层

```
/plugin install hade-core@hade-vault
```

装完后**每个新 session** 开头都会收到：

```
[HADE 唤醒指针]
HADE 本体（人格层）位于 ~/.claude/CLAUDE.md。
立刻完整读取该文件，然后按其 §一「新会话启动协议」执行。
```

**这句话指向 `~/.claude/CLAUDE.md`。** 如果用户那里是他自己的规则文件，
hook 就成了"提醒每个 session 去读用户自己的规则"—— 这正是方式 B 的用途。

如果那个文件**不存在**，指针会指向空气，用户会看到无意义的提示。
遇到这种情况，问用户是要（a）写一份自己的，还是（b）走方式 C，
还是（c）卸载 hade-core 退回方式 A。

---

## 方式 C · 采用原作者的人格层（破坏性）

**只有用户明确要求才做。执行前必须备份。**

⚠️ **本体末尾有 `@hade/cases.md` 导入。实测：导入目标缺失时静默失败 ——
不报错、不警告，内容就是不在。** 只拷 `CLAUDE.md` 会得到一份带着 17 处
「反例：见记忆层 M-xx」却永远查不到内容的规则文件。**必须连 `hade/` 一起拷。**

先问用户要哪种记忆层：

**C-1 · 带原作者的记忆**（能看到真实的项目翻车记录，最有参考价值）
```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup-$(date +%Y%m%d)   # 先备份
cp <仓库>/plugins/hade-core/install/CLAUDE.md ~/.claude/CLAUDE.md
mkdir -p ~/.claude/hade
cp <仓库>/plugins/hade-core/install/hade/cases.md ~/.claude/hade/cases.md
```

**C-2 · 空记忆层，从零积累自己的**（推荐给长期使用）
```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup-$(date +%Y%m%d)   # 先备份
cp <仓库>/plugins/hade-core/install/CLAUDE.md ~/.claude/CLAUDE.md
mkdir -p ~/.claude/hade
cp <仓库>/plugins/hade-core/install/hade/cases.template.md ~/.claude/hade/cases.md
```

C-2 之后骨架里那 17 处 `反例：见记忆层 M-xx` 会指向空 —— 这**不影响规则可用**
（触发/动作/原因都在骨架里），但可以让用户逐步用自己的经历填回去。

**验证导入是否生效**（缺失是静默的，必须主动验）：
新 session 里问「不要读文件，你能看到记忆层里的内容吗」——
C-1 应能复述具体条目，C-2 应回答记忆层是空模板。

装完提醒用户：**这份人格层不是为他写的**。里面的项目名、原话、
协作约定都是原作者的。建议他当参照读，逐条挑对自己成立的部分，
而不是整体照搬。

---

## 附带的两个可执行校验器（跨项目通用，价值最高）

不依赖任何触发机制，随时可手动跑：

```bash
# 色彩：查饱和度禁区 / 面积约束 / 色相间距 / 同屏密度
python <仓库>/plugins/hade-skills/skills/design-color/scripts/check_colors.py "#ff3b30" "#34c759"
python <仓库>/plugins/hade-skills/skills/design-color/scripts/check_colors.py --area large "#007aff"
python <仓库>/plugins/hade-skills/skills/design-color/scripts/check_colors.py --palette "#a" "#b" "#c"

# Electron 数据安全三件套：单实例锁 / userData 锁定 / deleteAppDataOnUninstall
python <仓库>/plugins/hade-skills/skills/local-storage-safety/scripts/check_electron_safety.py <项目根目录>
```

退出码 0 = 通过，1 = 有问题。非 Electron 项目会自动跳过第二个。

**建议在改任何 Electron 项目的 `package.json` 之前跑一次** ——
它在真实项目上抓到过三件套全缺 + userData 目录已漂移。

---

## 故障排查（都是原作者实际踩过的）

### plugin 装了但 skill 不出现

**Windows 文件系统大小写不敏感**导致的缓存残留。清缓存重装：

```bash
# 卸载
/plugin uninstall hade-skills@hade-vault
# 清缓存（关键）
rm -rf ~/.claude/plugins/cache/hade-vault
# 重装
/plugin install hade-skills@hade-vault
```

### 改了 skill 内容但不生效

plugin 缓存按 `version` 目录存。改内容后必须 bump
`plugins/hade-skills/.claude-plugin/plugin.json` 的 `version`，
然后卸载 → 清缓存 → 重装。只改内容不改版本号，缓存不会更新。

### `plugin validate` 报 Unrecognized keys

`plugin.json` 里只放 schema 认的字段。`displayName`、`defaultEnabled`
这类**不被接受**（原作者从训练记忆里写出来过，validate 直接报错）。

### 校验器跑不了

需要 `python` 在 PATH 里。在受限权限模式下，`python` 调用可能被拦
——这种情况下脚本会静默失效，**不要**因此认为"检查通过了"。
拿不到脚本输出时，明确告诉用户"未执行校验"，别用手算代替
（原作者实测：手算替代色值时 3 个全部踩线）。

---

## 关于 git remote

分享包里的 `.git` 已移除 remote 配置 —— 这份仓库是**快照**，不是原作者仓库的克隆。
`git log` 可查看完整历史与每个回滚点，但 `git pull` 无处可拉（原仓库是私有的）。

如果用户想让它变成自己的仓库：`git remote add origin <他自己的私有仓库>` 即可。
**不要推到公开仓库** —— 见下。

---

## 绝对不要做的事

1. **不要在用户没明确选方式 C 时覆盖 `~/.claude/CLAUDE.md`**
2. **不要照着 `INSTALL.md` 做** —— 那是过时的一次性记录
3. **不要因为"没看到 hook 事件"就判定安装失败** —— 见上文验证方法
4. **不要把这份仓库转为公开或推到用户自己的公开仓库** ——
   里面有原作者的真实邮箱、项目历史、对其本人思维方式的描述

---

## 装完之后

告诉用户可以读什么：

| 想了解 | 文件 |
|---|---|
| 这套系统是什么、三种采用方式、方法论 | `GETTING-STARTED.md` |
| 完整重构历程与全部实测数据（1500 行） | `archive/PLAN-AND-EXECUTION-LOG.md` |
| 重要架构决策的来龙去脉 | `archive/decision-log.md` |
| 人格层全文 | `plugins/hade-core/install/CLAUDE.md` |

其中最值得读的是 `GETTING-STARTED.md` 的「方法论」一节 ——
那几条（三种否决理由、量具要先校准、反例是唤醒力来源）
比 5 个 skill 本身更通用。
