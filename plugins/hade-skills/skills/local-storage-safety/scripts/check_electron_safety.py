#!/usr/bin/env python3
"""§九 I 组 —— 桌面工具数据安全三件套 · 可执行校验。

把 §九.24 / §九.25 / §九.27 里**已有的可判定条件**变成一条命令。规则内容一字未改。

为什么必须有它：§九.I 的失败代价是**用户数据不可逆丢失**（Taxis 改名后用户
"我的项目不见了"）。skill 触发是概率的，哨兵行防的是"没想起来"；
本脚本防的是"想起来了但漏了一项" —— 三件套缺一即静默数据炸弹。

用法：
  python check_electron_safety.py <项目根目录>
  python check_electron_safety.py .          当前目录
退出码：0 = 三件套齐备，1 = 有缺失（=数据炸弹）
"""

import json
import re
import sys
from pathlib import Path


def find_main(root):
    for c in ["electron/main.js", "electron/main.cjs", "electron/main.ts",
              "src/main/index.js", "main.js", "app/main.js"]:
        p = root / c
        if p.exists():
            return p
    hits = [p for p in root.rglob("main.*")
            if p.suffix in (".js", ".cjs", ".ts")
            and "node_modules" not in p.parts and "release" not in p.parts
            and re.search(r"\bapp\b.*\bwhenReady\b|require\(['\"]electron", p.read_text(encoding="utf-8", errors="ignore"))]
    return hits[0] if hits else None


def main():
    for st in (sys.stdout, sys.stderr):
        try: st.reconfigure(encoding="utf-8")
        except Exception: pass

    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    print(f"§九.I 数据安全三件套校验 · {root}\n" + "─" * 66)

    pkg_path = root / "package.json"
    if not pkg_path.exists():
        print(f"✘ 找不到 package.json —— 这不是项目根目录？")
        return 1
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))

    is_electron = any("electron" in k.lower()
                      for k in list(pkg.get("devDependencies", {})) + list(pkg.get("dependencies", {})))
    if not is_electron:
        print("ⓘ 未检出 electron 依赖 —— 本脚本只适用于 Electron 项目，跳过")
        return 0

    fails = []

    # ① 单实例锁（§九.27 ①）
    main_js = find_main(root)
    if not main_js:
        fails.append("① 单实例锁: 找不到主进程文件，无法校验 —— 请手动确认")
        src = ""
    else:
        src = main_js.read_text(encoding="utf-8", errors="ignore")
        rel = main_js.relative_to(root)
        if "requestSingleInstanceLock" in src:
            extra = "" if "second-instance" in src else "（有锁但缺 second-instance 事件 → 第二次双击不会 restore+focus 现有窗口）"
            if extra:
                fails.append(f"① 单实例锁: {rel} {extra}")
            else:
                print(f"✔ ① 单实例锁      {rel}  requestSingleInstanceLock + second-instance")
        else:
            fails.append(f"① 单实例锁: {rel} 里没有 requestSingleInstanceLock "
                         f"→ 双击快捷方式会开出第二个进程，读到空状态，用户以为数据没了")

    # ② userData 路径锁定（§九.24 + §九.27 ②）
    if src:
        m = re.search(r"setPath\s*\(\s*['\"]userData['\"]", src)
        if m:
            key = re.search(r"(?:FIXED_USERDATA_KEY|USERDATA_KEY)\s*=\s*['\"]([^'\"]+)['\"]", src)
            legacy = re.search(r"LEGACY_USERDATA_KEYS\s*=\s*\[([^\]]*)\]", src)
            note = f"  固定标识符={key.group(1)}" if key else ""
            print(f"✔ ② userData 锁定  setPath('userData', …){note}")
            if legacy is None:
                print("    ⓘ 未见 LEGACY_USERDATA_KEYS 清单 —— 若将来换 key，"
                      "必须先把旧值追加进清单再换（§九.27 ②）")
        else:
            fails.append(f"② userData 锁定: 没有 app.setPath('userData', …) "
                         f"→ 路径跟随 package.json.name='{pkg.get('name')}' 漂移，改名瞬间数据失联")

    # ③ deleteAppDataOnUninstall（§九.25 + §九.27 ③）
    nsis = (pkg.get("build") or {}).get("nsis")
    if nsis is None:
        b = pkg.get("build")
        if b is None:
            cfgs = [p for p in root.glob("electron-builder.*")] + [p for p in root.glob("build.config.*")]
            if cfgs:
                fails.append(f"③ deleteAppDataOnUninstall: build 配置在 {cfgs[0].name} 中，脚本未解析 —— 请手动确认为 false")
            else:
                fails.append("③ deleteAppDataOnUninstall: package.json 无 build 段，未找到打包配置")
        else:
            fails.append("③ deleteAppDataOnUninstall: build 段无 nsis 配置 → 走默认值，"
                         "而默认可能为 true = 每次升级清空 AppData")
    elif nsis.get("deleteAppDataOnUninstall") is True:
        fails.append("③ deleteAppDataOnUninstall = **true** → NSIS 升级流程"
                     "（卸旧装新）每次都清空 AppData，用户本地存档全丢。这是静默数据炸弹")
    elif "deleteAppDataOnUninstall" not in nsis:
        fails.append("③ deleteAppDataOnUninstall 未显式声明 → §九.25 要求不省略也不信默认值")
    else:
        print("✔ ③ 卸载不删数据  deleteAppDataOnUninstall: false")

    print("─" * 66)
    if fails:
        print(f"✘ 三件套缺 {len(fails)} 项 —— 静默数据炸弹：\n")
        for f in fails:
            print(f"  → §九.27 {f}")
        print(f"\n名称字段现状：name={pkg.get('name')!r}  productName={pkg.get('productName')!r}")
        print("§九.26 提醒：若本轮要动上面任何字段，先答三问 —— "
              "① 老数据现在存在哪 ② 改动后新代码去哪找 ③ 会不会失联")
        return 1
    print("✔ 三件套齐备")
    return 0


if __name__ == "__main__":
    sys.exit(main())
