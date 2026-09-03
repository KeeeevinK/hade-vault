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

---

# 卸载 · 恢复成原始 Claude Code

> **卸载不碰仓库。** `HADE-vault/` 与 GitHub 私有远端保持不动，
> 随时可以照前面的步骤重新装回来。

## 最省事：双击 `tools/HADE-卸载器.cmd`

浏览器会开一个界面，把删什么 / 留什么并排摆给你看，再给一条可复制的命令。
界面只读，不会删任何东西。详见 [`tools/README.md`](tools/README.md)。

## 或者用命令行

```bash
node tools/hade-uninstall.js doctor        # 先看装了什么、影响面多大
node tools/hade-uninstall.js uninstall     # dry-run：打印清单 + 发令牌
```

确认清单没问题后，照 dry-run 打印的那行命令执行（带 `--confirm 确认销毁` 和令牌）。

工具比手工四步多做三件事：

- **管全 13 处**，包括手工版长期漏掉的 `plugins/data/*hade*` 两个残留目录，
  和会变成悬空指针的 `projects/*/memory/` 记忆桥接指针；
  检测到 `CLAUDE.md.backup*` 还会把你装 HADE 之前的原规则改回去
- **JSON 只删键不删文件** —— `settings.json` 里你的 `effortLevel` / `tui` 等个人偏好、
  `known_marketplaces.json` 里的 `claude-plugins-official` 都会原样保留
- **有备份和还原** —— 备份进 `HADE_Vault/uninstall-backups/`，
  `restore` 能一键装回来，且 JSON 走键级合并不会吃掉你后来改的键

细节见 [`tools/README.md`](tools/README.md)。工具跑不了（Node 缺失等）时看
[`tools/MANUAL-UNINSTALL.md`](tools/MANUAL-UNINSTALL.md)，或用下面的附录。

---

## 附录 · 手工四步（工具跑不了时）

> ⚠ 手工做没有幂等保证、没有备份校验、没有硬名单拦截。
> 尤其注意：**`claude plugin uninstall` 处理不了 `plugins/data/` 下的残留目录**，
> 必须自己补第 ⑤ 步。

```bash
# ① 卸 plugin（唤醒 hook + 5 个 skill 一起走）
claude plugin uninstall hade-core@hade-vault
claude plugin uninstall hade-skills@hade-vault

# ② 移除 marketplace 注册
claude plugin marketplace remove hade-vault

# ③ 清缓存（Windows 大小写不敏感，不清会留残骸）
rm -rf ~/.claude/plugins/cache/hade-vault

# ④ 移走人格层与记忆层 —— 建议改名而不是删除，留条后路
mv ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.hade-backup
mv ~/.claude/hade ~/.claude/hade.backup

# ⑤ 清 plugin 数据残留（CLI 不管这一层，长期被漏掉的就是它）
ls ~/.claude/plugins/data/            # 找所有名字里含 hade 的目录，大小写不敏感
rm -rf ~/.claude/plugins/data/hade-core-hade-vault
rm -rf ~/.claude/plugins/data/HADE-core-inline
```

第 ④ 步用 `mv` 不用 `rm`：万一想装回来，改回名字就行，不必再从仓库拷。
确定不要了再删那两个 backup。

第 ⑤ 步的 `HADE-core-inline` 是早期命名遗留。Windows 文件系统大小写不敏感，
靠肉眼很容易只看到其中一个 —— 用 `ls` 列一遍再删。

**绝对不要碰**：`~/.claude/skills/`（与 HADE 无关的 skill，可能上百个）、
`~/.claude/backups/`（Claude Code 自己的备份）、`~/.claude.json`（里面记的是你的使用痕迹）。

## 验证已恢复

开一个**新** session：

- 开头**不再有**「[HADE 唤醒指针]」
- 问「你有哪些 hade skill」→ 应答没有
- 行为回到默认 Claude Code：不发破坏性预警、不按 §九.23 拒绝猜测

## 只想停用、不想删

不删任何文件，只关掉：

```bash
claude plugin disable hade-core@hade-vault
claude plugin disable hade-skills@hade-vault
```

人格层（`~/.claude/CLAUDE.md`）仍会被 Claude Code 加载 ——
它是标准的用户级配置文件，与 plugin 无关。**要连规则一起停，必须移走那个文件。**

## 装回来

照本文档第 2、3 步做即可。仓库没动过，`git pull` 一下拿最新的就行。
