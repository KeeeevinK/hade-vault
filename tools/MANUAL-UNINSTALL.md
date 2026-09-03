# 手工卸载 HADE（降级路径）

> **优先用脚本**：`node tools/hade-uninstall.js uninstall`
> 本文档只在脚本跑不了时用 —— Node 缺失、脚本被改坏、或你拿到的是分享包想手工卸。
>
> 代价要说清楚：手工做**没有幂等保证、没有备份校验、没有硬名单拦截**，
> 每执行一次就是一次全新的手工操作。下面每一步的"必须保留"都要自己盯住。

人和 AI 都能照做。全程不碰仓库。

---

## 第 0 步 · 先备份

```bash
mkdir -p <某个仓库外的目录>/hade-backup
cp -r ~/.claude/CLAUDE.md ~/.claude/hade ~/.claude/references \
      ~/.claude/settings.json ~/.claude/plugins/installed_plugins.json \
      ~/.claude/plugins/known_marketplaces.json ~/.claude/plugins/cache/hade-vault \
      <某个仓库外的目录>/hade-backup/
```

不存在的路径会报错，忽略即可。

---

## 第 1 步 · 确认那个 CLAUDE.md 真是 HADE 的

```bash
grep -c -e '§零' -e '元规则' -e 'HADE' ~/.claude/CLAUDE.md
```

三个锚点都命中才继续。**若不是**，说明那是你自己的规则文件 —— 跳过第 3 步里的 `CLAUDE.md`，别动它。

---

## 第 2 步 · 三个 JSON 做键级删除

⚠ **这三个文件里混着必须保留的内容，只能删键，不能删文件。**

### `~/.claude/settings.json`

删掉：
- `enabledPlugins` 里所有以 `@hade-vault` 结尾的键
- `extraKnownMarketplaces.hade-vault`

**必须保留**：`effortLevel`、`tui`、`skipWorkflowUsageWarning`、`agentPushNotifEnabled`，以及 `enabledPlugins` 里**任何非 `@hade-vault` 的 plugin**。

### `~/.claude/plugins/installed_plugins.json`

删掉 `plugins` 里所有以 `@hade-vault` 结尾的键。**必须保留** 顶层 `version` 字段。

### `~/.claude/plugins/known_marketplaces.json`

删掉顶层的 `hade-vault` 键。**必须保留** `claude-plugins-official` 等其它 marketplace。

### 删完键后：清空容器，但只清这两个

如果 `settings.json` 的 `enabledPlugins` 或 `extraKnownMarketplaces` 删完 HADE 的键后**变成了 `{}`**，
把这两个键本身也删掉 —— 从没装过任何 plugin 的 `settings.json` 里本来就没有它们，留空壳是残留。

⚠ **只清这两个。** `installed_plugins.json` 的 `plugins` 键空了也要留着，
`plugins/cache/` 和 `plugins/data/` 空目录也别删 —— 那些是 **Claude Code 的结构**，
不是 HADE 建的。删别人的文件（哪怕现在是空的）超出「卸载 HADE」的范围。

> 也可以改用 CLI（会自动处理这三个文件）：
> ```bash
> claude plugin uninstall hade-core@hade-vault
> claude plugin uninstall hade-skills@hade-vault
> claude plugin marketplace remove hade-vault
> ```
> 但 CLI 处理不了第 3 步的残留目录，两者要一起做。

---

## 第 3 步 · 移走文件与目录

用 `mv` 不用 `rm`，留条后路：

```bash
mv ~/.claude/CLAUDE.md  ~/.claude/CLAUDE.md.hade-backup     # 第 1 步确认过才做
mv ~/.claude/hade       ~/.claude/hade.backup
rm -rf ~/.claude/plugins/cache/hade-vault
```

`references/` 若非空也一并移走；空目录留着无所谓。

### 别漏了这两个（旧文档没记录过）

```bash
ls ~/.claude/plugins/data/          # 找所有名字里含 hade 的目录（大小写不敏感）
rm -rf ~/.claude/plugins/data/hade-core-hade-vault
rm -rf ~/.claude/plugins/data/HADE-core-inline
```

第二个是早期命名遗留。Windows 文件系统大小写不敏感，靠肉眼很容易只看到一个。

---

---

## 第 3.5 步 · 删记忆桥接指针（最容易漏，后果最坏）

HADE 会往 `~/.claude/projects/<项目>/memory/` 写一个桥接指针文件，内容大意是
"HADE 本体在 `~/.claude/CLAUDE.md`，任何 session 先读它"。memory 会被加载进上下文，
**卸载后本体没了、指针还在 = 指向不存在文件的悬空指针**，会误导之后每一个新 session。

```bash
grep -rl 'HADE' ~/.claude/projects/*/memory/*.md 2>/dev/null
```

在结果里挑出**同时**提到 HADE 和 `~/.claude/CLAUDE.md` 的那些（通常叫
`hade-global-pointer.md`），删掉它们；然后把同目录 `MEMORY.md` 里指向它们的索引行也删掉。

⚠ **只删这一类。** 同目录下常有与 HADE 无关的项目记忆（工具用法、排错笔记），
删错就是丢你自己的资料。

---

## 第 3.6 步 · 把你的原规则改回来

装 HADE 时文档要求你 `cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup`。那份是你自己的规则：

```bash
ls ~/.claude/CLAUDE.md.backup* 2>/dev/null
```

有的话改回去 —— 否则卸完你得到的是一个**没有任何规则文件的空环境**，而不是"初始状态"：

```bash
mv ~/.claude/CLAUDE.md.backup ~/.claude/CLAUDE.md
```

多份就挑最新的那份。

---

## 可选 · `~/.hade/`

如果存在，那是**实例化数据仓**（`persona.md` / `preferences.md` / `profile.md` /
`relationship.md` 等个人画像 + 生成产物）。**Claude Code 从不读它**，所以卸载
Claude Code 集成不需要动它。想彻底清就自己 `mv` 走，别直接 `rm` —— 里面是数据不是配置。

---

## 绝对不要碰

| 路径 | 为什么 |
|---|---|
| `~/.claude/skills/` | 里面是与 HADE 无关的 skill，可能有上百个 |
| `~/.claude/backups/` | Claude Code 自己的 `.claude.json` 备份 |
| `~/.claude.json` | 里面 `projects` 记的是你的使用痕迹，不是 HADE 装的 |
| 仓库目录 | 卸载不碰仓库，随时可以照 `MIGRATE.md` 装回来 |

---

## 第 4 步 · 验证

**完全退出 Claude Code**（整个退出，不是新开窗口）→ 重新打开，然后：

- 对话开头**不再出现**「[HADE 唤醒指针]」
- 问「你有哪些 hade skill」→ 应答没有
- 行为回到默认 Claude Code

Claude Code 运行时可能在退出时回写 `settings.json` 把注册项复活 —— 所以重启后要再看一眼那三个 JSON，确认键没回来。

若 Node 后来可用了，跑一次 `node tools/hade-uninstall.js doctor` 复检最省事。

---

## 装回来

照 `MIGRATE.md` 第 2、3 步做。若你在第 3 步用的是 `mv`，直接改回名字更快：

```bash
mv ~/.claude/CLAUDE.md.hade-backup ~/.claude/CLAUDE.md
mv ~/.claude/hade.backup           ~/.claude/hade
```

⚠ **两个都要还原。** 骨架末行有 `@hade/cases.md` 导入，而**导入目标缺失时是静默失败** —— 不报错、不警告，你会得到一份带着 17 处「见记忆层 M-xx」却永远查不到内容的规则文件。
