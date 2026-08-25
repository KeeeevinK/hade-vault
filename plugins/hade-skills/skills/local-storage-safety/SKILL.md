---
name: local-storage-safety
description: Electron / Tauri 桌面工具的本地数据安全铁律 —— userData 路径必须 setPath 锁死不靠 package.json.name 推断、deleteAppDataOnUninstall 必须显式 false、历史路径清单与自动迁移、单实例锁，四条缺一即静默数据炸弹。以下任一情况必须先读本 skill 再动手，没有例外：① 要动 package.json 的 name / productName / appId / version 以外任何字段；② 要改 userData 路径、localStorage key 前缀、IndexedDB 库名、任何数据定位相关的字符串；③ 给项目改名、取代号、换 slug；④ 写或改打包配置（nsis / build / electron-builder）；⑤ 新建带本地存档的桌面工具；⑥ 用户问"升级会不会丢数据"。判据不是"这算不算大改" —— 只要你正要碰的那个字符串参与决定数据存在哪里，就必须读。这些条目全部来自真实的数据丢失事故（Taxis 改名后用户"我的项目不见了"）。MUST read before touching ANY data-location config in a desktop app: userData path, package.json name/productName/appId, storage key prefix, or packaging config.
---

# 本地存档与打包 — 数据安全铁律

> 来自 HADE 本体 §九 I 组，逐字平移。条目编号沿用原编号（§九.24 ~ §九.27）。
> **本 skill 对应的失败代价是「用户数据不可逆丢失」** —— Global 内留有哨兵行，
> 但哨兵只防「没想起来」；真正动手前请对 §九.27 的三件套逐项打勾。

## 动手前先跑校验（§九.27 三件套的可执行版）

**脚本路径**：本 skill 载入时最开头的 `Base directory for this skill:` 一行给出绝对路径，
脚本在其下的 `scripts/check_electron_safety.py`。**用那一行拼接，不要猜** —— 路径含版本号，
每次更新都会变。

```bash
BASE="<把上面 Base directory 那一行的路径填进来>"
python "$BASE/scripts/check_electron_safety.py" <项目根目录>
```

一次性检出三件套缺失：① 单实例锁 ② userData setPath 锁定（含 LEGACY 清单）
③ deleteAppDataOnUninstall。退出码 0 = 齐备，1 = 有缺失（= 静默数据炸弹）。

**铁律：不许靠读代码代替跑脚本。**
本条的失败代价是**用户数据不可逆丢失**，不是"这次做得不够好"。
`design-color` 那边已有实测教训：HADE 规则记得、诊断对、却在手算时全错
（推荐的三个替代色全部仍在禁区）。这里错一次的代价高得多。

**改任何数据定位字段之前**（name / productName / appId / userData 路径 / storage key 前缀），
先对目标项目跑一遍拿到基线，改完再跑一遍确认没退化。

**脚本跑不了时**（权限被拦 / 无 python）：明确声明"未执行脚本"，然后**逐项**人工核对并
写出证据 —— 主进程文件里 `requestSingleInstanceLock` 与 `second-instance` 的实际行号、
`setPath('userData'` 的实际行号、`package.json` 里 `build.nsis.deleteAppDataOnUninstall`
的实际取值。不得凭印象说"应该有"。

---

> 用户协作的大部分工具都有本地存档（localStorage / IndexedDB / 文件）。数据丢失 = 不可逆 = 顶级翻车。以下条目不允许再犯。
>
> **顶级承诺（用户原话）**：**不管如何改名，只要是同一个软件的更新，就必须保留本地数据。**
> —— 项目代号可以改（外层包装），数据定位路径（userData / localStorage key 前缀 / 文件名）必须锁死不随改名漂移。

**24. Electron 项目必须锁定 userData 路径，不靠 package.json.name 推断** (→ 元A + 元C)
触发：创建新 Electron 项目 / 改 `package.json` 的 `name` 或 `productName` 字段 / 做项目改名（如"给项目取希腊代号"）
动作：`electron/main.js` 顶部必加：
 ```
 app.setPath('userData', path.join(app.getPath('appData'), '<固定标识符>'));
 ```
 `<固定标识符>` 一旦选定永不更改（推荐：项目首次发布时的 name，或专门的固定 slug）
禁：依赖 Electron 默认的"按 name 派生 userData"行为 → 改名瞬间数据与新路径失联
原因：Electron 默认 userData = `%APPDATA%\<package.name>\`。改 name 后新版本指向空目录，用户开应用看到"数据全没了"。旧数据还在老目录，但用户不懂迁移。
反例：Taxis 项目从 `outing-tool` 改名 `taxis` → 新安装包打开空白 → 用户"我的项目不见了" → 靠手动 Copy-Item 迁移才救回。如果早锁定 userData 路径，改名和数据彻底解耦。

**25. `deleteAppDataOnUninstall` 默认必须 `false`** (→ 元A + 元C)
触发：写 `package.json` 的 `build.nsis` / 任何 Electron 打包配置
动作：显式声明 `"deleteAppDataOnUninstall": false`，不省略也不信默认值
禁：留 `true` 或省略让它默认
原因：NSIS 升级流程 = 卸载旧版 → 安装新版。`true` 意味着每次升级都清空 AppData，用户本地存档全丢。这是静默数据炸弹。
反例：Taxis 配置曾是 `true`，用户问过"升级会不会丢数据"，HADE 没核对字段就回"不会"。幸运的是实际数据丢失是改名导致的；但这颗 `true` 炸弹本身就是地雷。
例外：工具性质就是"一次性纯无状态"（不存任何用户数据），才可以 `true`。99% 项目走默认 `false`。

**26. 做本地存档工具时，改任何"数据定位相关"配置前必须三问** (→ 元C)
触发：动 `package.json.name` / `productName` / `appId` / userData 路径 / 存储 key 前缀（`localStorage.getItem('xxx_projects')` 的 `xxx_`）
三问：① 老数据现在存在哪？② 改动后新代码去哪找数据？③ 数据会不会失联？
失联 → 必须提供迁移路径（自动迁移函数 / 明确告知用户手动操作）
禁：沉默改字段，让用户下次打开应用自己发现"数据没了"
反例：HADE 把 `name: outing-tool` 改成 `name: taxis` 没提数据路径问题，用户自行升级后才炸。

**27. 桌面本地存储工具 · 三件套机制（防多进程 + 防漂移 + 防丢失）** (→ 元A + 元C)
触发：开始做任何带"本地数据 + 桌面快捷方式"的 Electron / Tauri 类工具，或对此类工具做打包配置 / 改名 / 升级。
动作：上线前必须三件套齐备，缺一不可：

① **单实例锁**：`app.requestSingleInstanceLock()` + `second-instance` 事件 → restore + focus 现有窗口；抢不到锁立即 `app.quit()`
- 防止：双击桌面快捷方式开出多个独立进程，第二个进程读到空状态显示"初始化界面"，用户以为数据丢了

② **userData 路径锁定 + 历史路径清单（追加式自动迁移）**：
- 一个 `FIXED_USERDATA_KEY`（一旦选定永不更改），`app.setPath('userData', ...)` 显式锁死
- 一个 `LEGACY_USERDATA_KEYS = []` 数组，记录历史用过的所有 key
- 启动时检测：当前路径不存在 + 历史路径中有数据 → `fs.cpSync` 自动复制到当前路径，旧目录保留不删（保险底）
- 维护规则：未来想换 `FIXED_USERDATA_KEY`（不推荐），必须先把当前值追加到 `LEGACY_USERDATA_KEYS`，再换新值
- 用户层面承诺：**不论 productName / package.json.name 怎么改，用户本地数据永远是同一个对象**

③ **NSIS 打包 `deleteAppDataOnUninstall: false`**：显式声明，不靠默认值

原因：桌面级本地存储工具的核心承诺 = 用户数据的连续性。三件套分别拦截三种典型翻车：多进程互踩 / 改名漂移 / 卸载误清。任何一条缺失 = 静默数据炸弹。
反例：
- Hora V2.5 早期：单实例锁缺失 → 用户双击快捷方式 → 第二个进程开出"初始化界面"
- Hora V2.5 早期：userData 跟随 `package.json.name = "aaa-temp"` 漂移 → 改名计划被卡住，怕丢数据
- Taxis：`deleteAppDataOnUninstall: true` 没纠正 → 升级流程会清空 AppData（侥幸先被改名问题暴露）

注：本条是 §九.24 / §九.25 / §九.26 的**机制级整合**。前三条是单点禁令（"必须设 setPath"、"必须 false"、"改字段必三问"），本条是"桌面本地存储工具的标准三件套上线 checklist"，做新工具时直接对此条逐项打勾。
