---
name: local-storage-safety
description: Electron / Tauri 桌面工具数据安全三件套的**可执行校验器** —— 一条命令查出 ① 单实例锁缺失 ② userData 未 setPath 锁定（改名即数据失联）③ deleteAppDataOnUninstall 为 true（升级即清空 AppData）。规则正文在 HADE 本体 §九 I 组，本 skill 只提供工具，不重复规则。以下任一情况必须跑一遍：改 package.json 的 name / productName / appId；改 userData 路径或 storage key 前缀；给项目改名换代号；写或改打包配置；新建带本地存档的桌面工具；用户问"升级会不会丢数据"。判据不是"这算不算大改" —— 只要正要碰的字符串参与决定数据存在哪里，就跑。Run this validator before touching ANY data-location config in an Electron/Tauri app.
---

# 数据安全三件套 — 可执行校验器

> **规则正文在 HADE 本体 §九 I 组（§九.24 ~ §九.27），不在这里。**
> 本 skill 是纯工具容器：Global 里已有的规则负责"知道该做什么"，
> 本脚本负责"确认真的做到了"。两者不重复（§七 单一源）。

失败代价是**用户数据不可逆丢失**（某文本转表格工具 改名后用户"我的项目不见了"），
所以这里需要的是确定性检查，不是又一份规则副本。

## 用法

**脚本路径**：本 skill 载入时最开头的 `Base directory for this skill:` 一行给出绝对路径，
脚本在其下的 `scripts/check_electron_safety.py`。**用那一行拼接，不要猜** —— 路径含版本号。

```bash
BASE="<把上面 Base directory 那一行的路径填进来>"
python "$BASE/scripts/check_electron_safety.py" <项目根目录>
```

退出码 0 = 三件套齐备，1 = 有缺失（= 静默数据炸弹）。
非 Electron 项目会自动跳过。

## 何时跑

- **改任何数据定位字段之前**：先跑拿基线，改完再跑确认没退化
- **接手 / 新建桌面工具时**：第一件事就是跑一遍，别等出事
- 用户问"升级会不会丢数据"时：跑完再回答，不要凭印象说"不会"
  （§九.25 反例正是 HADE 没核对字段就回"不会"）

## 铁律

**不许靠读代码代替跑脚本。** 姊妹 skill `design-color` 有实测教训：
HADE 规则记得、诊断对、目标说得准，手算时照样全错（推荐的三个替代色全在禁区）。
数据安全这边错一次的代价高得多。

**脚本跑不了时**（权限被拦 / 无 python）：明确声明"未执行脚本"，然后逐项人工核对并
写出证据 —— `requestSingleInstanceLock` 与 `second-instance` 的实际行号、
`setPath('userData'` 的实际行号、`build.nsis.deleteAppDataOnUninstall` 的实际取值。
不得凭印象说"应该有"。

## 检出项与对应条款

| 检查 | 缺失后果 | 条款 |
|---|---|---|
| 单实例锁 | 双击快捷方式开出第二进程，读到空状态，用户以为数据没了 | §九.27 ① |
| userData setPath 锁定 | 路径跟随 package.json.name 漂移，改名瞬间数据失联 | §九.24 · §九.27 ② |
| LEGACY_USERDATA_KEYS 清单 | 换过 key 却没留迁移路径，老数据成孤儿 | §九.27 ② |
| deleteAppDataOnUninstall | NSIS 升级=卸旧装新，true 则每次升级清空 AppData | §九.25 · §九.27 ③ |

脚本同时会打印当前 name / productName，并附 §九.26 三问提醒。
