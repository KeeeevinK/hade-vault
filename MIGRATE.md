# 换新电脑 · HADE 完整迁移

> 给 HADE 的主人自己用。目标：新机器上得到与旧机器**完全一致**的 HADE
> （骨架 + 你自己的记忆层 + 5 skill + 2 校验器 + 唤醒 hook）。
>
> 给**别人**装是另一份：`AGENT-SETUP.md`（那里要先问选 A 还是 C，因为会覆盖对方的规则）。

---

## 第 0 步 · 新机器上先装这四样

| | 用途 | 检查命令 |
|---|---|---|
| **Claude Code** | 主体 | `claude --version` |
| **Git** | 取仓库 | `git --version` |
| **Node** | 唤醒 hook 要跑 | `node --version` |
| **Python 3.8+** | 两个校验器要跑 | `python --version` |

Node 缺失 → hook 不工作，没有唤醒指针。
Python 缺失 → skill 还能用，但两个校验脚本跑不了。

然后登录：

```bash
claude
```

走一次浏览器授权。**不登录后面全部无法验证。**

---

## 第 1 步 · 把仓库弄到新机器

### 方式一 · 从 GitHub 私有仓库 clone（推荐）

```bash
gh auth login                                  # 没装 gh 就先 winget install GitHub.cli
git clone https://github.com/<你的账号>/hade-vault.git
```

好处：以后两台机器能互相同步（一边 `git push`，另一边 `git pull`）。

### 方式二 · 拷 zip 过去

把 `HADE-vault-share-*.zip` 用 U 盘 / 网盘 / 微信传过去解压。
缺点：没有 remote，两台机器各改各的，将来要手动合并。

**记下解压后的绝对路径**，下一步要用。假设是 `D:\HADE-vault`。

---

## 第 2 步 · 装 plugin（能力层 + 唤醒层）

在 Claude Code 里：

```
/plugin marketplace add D:\HADE-vault
/plugin install hade-skills@hade-vault
/plugin install hade-core@hade-vault
```

路径要指向**含 `.claude-plugin/marketplace.json` 的那一层**，不是它的父目录。

---

## 第 3 步 · 装本体 + 记忆层（关键，别漏 `hade/`）

```bash
mkdir -p ~/.claude/hade
cp D:/HADE-vault/plugins/hade-core/install/CLAUDE.md      ~/.claude/CLAUDE.md
cp D:/HADE-vault/plugins/hade-core/install/hade/cases.md  ~/.claude/hade/cases.md
```

⚠️ **两个文件都要拷。** 骨架末尾有 `@hade/cases.md` 导入，而
**导入目标缺失时是静默失败** —— 不报错、不警告，你会得到一份带着
17 处「反例：见记忆层 M-xx」却永远查不到内容的规则文件。

如果新机器上已经有 `~/.claude/CLAUDE.md`（比如你先用了几天），先备份：

```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.backup
```

---

## 第 4 步 · 验证（三项都要过）

**开一个新 session**，然后：

**① 唤醒层** —— 对话最开头应出现：

```
[HADE 唤醒指针]
HADE 本体（人格层）位于 ~/.claude/CLAUDE.md。
```

**② 记忆层** —— 问一句：

> 不要读任何文件，你能说出记忆层 M-02 记的是什么吗？

应该复述出「贴了三段 JS 代码块 → 用户说不要给我看代码」。
答不上来 = `hade/cases.md` 没拷过去或路径不对。

**③ 能力层** —— 说一句：

> 帮我给这几个状态标签配色

应该唤起 `design-color`。

---

## 常见问题（都是实际踩过的）

### plugin 装了但 skill 不出现

Windows 文件系统**大小写不敏感**导致的缓存残留：

```bash
/plugin uninstall hade-skills@hade-vault
rm -rf ~/.claude/plugins/cache/hade-vault      # 这步是关键
/plugin install hade-skills@hade-vault
```

### 改了 skill 内容但不生效

缓存按 `version` 目录存。必须先 bump
`plugins/hade-skills/.claude-plugin/plugin.json` 的 `version`，
再卸载 → 清缓存 → 重装。**只改内容不改版本号，缓存不会更新。**

### 看到「⚠ 同步漂移」

本体 `~/.claude/CLAUDE.md` 与仓库副本 `plugins/hade-core/install/CLAUDE.md`
内容不一致。**这不是故障，是探针在干活。**

它会给出两边的行数、mtime、hash 前缀 —— 按 mtime 判断哪边新，
确认后把新的那份覆盖过去，然后 commit 留回滚点。

**不要凭直觉覆盖**，判断错方向会把对的那份冲掉。

### 两台机器都在用，怎么保持一致

改完本体后，把它同步回仓库副本再推：

```bash
cp ~/.claude/CLAUDE.md      <仓库>/plugins/hade-core/install/CLAUDE.md
cp ~/.claude/hade/cases.md  <仓库>/plugins/hade-core/install/hade/cases.md
cd <仓库> && git add -A && git commit -m "sync body" && git push
```

另一台机器 `git pull` 后，重复第 3 步把文件拷回 `~/.claude/`。

---

## 记忆层要不要一起带

**带**（上面第 3 步就是）—— 17 条翻车记录跟着走，新机器上的 HADE
仍然记得「你说过不要给我看代码」这类具体默契。这是默认做法。

**不带**（想在新机器上从零积累）：

```bash
cp D:/HADE-vault/plugins/hade-core/install/hade/cases.template.md ~/.claude/hade/cases.md
```

骨架里那 17 处引用会指向空 —— **规则本身仍完整有效**
（触发/动作/原因都在骨架里），只是少了「我在这里错过」那层具体记忆。
