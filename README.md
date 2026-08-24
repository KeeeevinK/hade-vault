# HADE-vault

HADE 的可安装体 —— 一个 git 仓库同时是 marketplace、备份保险箱、版本化历史。

```
.claude-plugin/marketplace.json   目录文件
plugins/HADE-core/                人格层：SessionStart 唤醒指针（不做成 skill）
plugins/HADE-skills/              能力层：按需 skill，可独立分发
archive/snapshots-2026-08-24/     批0 全量快照（9 份，SHA256 可校验）
GLOBAL_PATCH.md                   待在本机应用的本体改动
INSTALL.md                        安装与验证步骤
```

**核心约束**：人格层**不**做成 skill。skill 是按需加载的，
而决定「是否加载人格」的那个主体必须先有人格 —— 自举悖论。
所以人格层走 `~/.claude/CLAUDE.md` 无条件加载 + hook 指针唤醒。

当前：批0 完成、批1 待验证。批2/批3 见 `../HADE_Plan_form-refactor_2026-08-24.md`。
