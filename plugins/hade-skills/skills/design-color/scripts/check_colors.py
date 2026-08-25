#!/usr/bin/env python3
"""§十 色彩系统 —— 可执行校验器。

把 §十 里**已有的数值约束**变成确定性检查，一个字的规则内容都不改。
为什么需要它：§十 已外移为 skill，触发率实测 2/3~3/3 —— 存在漏触发窗口。
哨兵防的是「没想起来」，本脚本防的是「想起来了但漏了一项」（两种失败模式，两层保险）。

§十.9 的反例白纸黑字写着：OutingTool V2.0 选了 12 色全在 S≈54、L≈36，
「如果走过三问第 1 条就会被挡下」—— 那正是本脚本三秒能挡下的事。

用法：
  python check_colors.py "#ff3b30" "#34c759"              逐色检查（默认小面积）
  python check_colors.py --area large "#007aff"           大面积约束（§十.8）
  python check_colors.py --palette "#a" "#b" "#c" ...     色板检查（§十.6 密度 + §十.7 并置）
  python check_colors.py --pair "#8e8e93" "#34c759"       翻牌姊妹色（§十.3）
退出码：0 = 全部通过，1 = 有违规
"""

import argparse
import colorsys
import re
import sys


def parse_color(s: str) -> tuple[float, float, float]:
    """接受 #rgb / #rrggbb / hsl(h,s%,l%)，返回 (H 0-360, S 0-100, L 0-100)。"""
    s = s.strip()
    m = re.fullmatch(r"hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?\s*\)", s, re.I)
    if m:
        return float(m.group(1)) % 360, float(m.group(2)), float(m.group(3))
    h = s.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        raise ValueError(f"无法解析颜色: {s}")
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    L, S = colorsys.rgb_to_hls(r, g, b)[1], colorsys.rgb_to_hls(r, g, b)[2]
    H = colorsys.rgb_to_hls(r, g, b)[0] * 360
    return H, S * 100, L * 100


def hue_gap(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


# —— §十.1 双通道模型 ——
FORBIDDEN_HUES = {"玫红": 335, "黄绿": 80}

# §十.4 列出的 iOS 锚点。其中绿/靛/紫三色实测 S 分别为 58.6/61.0/68.0%，
# 落在 §十.1 的 6-69% 禁区 —— 即 §十.4「位于通道A中心的坐标」与 §十.1 数值约束
# 存在内部不一致。本脚本**不擅自放行**（判定忠于 §十.1 主条款），仅在命中时附注，
# 避免使用者误以为是自己选错了色。该冲突待用户裁决，见 SKILL.md「已知冲突」。
IOS_ANCHORS = {
    (3, 100, 59): "红 #ff3b30", (35, 100, 50): "橙 #ff9500", (135, 59, 49): "绿 #34c759",
    (211, 100, 50): "蓝 #007aff", (191, 60, 46): "青 #30b0c7", (349, 100, 59): "粉 #ff2d55",
    (241, 61, 59): "靛 #5856d6", (280, 68, 60): "紫 #af52de", (240, 2, 57): "灰 #8e8e93",
}


def ios_anchor(H: float, S: float, L: float) -> str | None:
    for (h, s_, l_), label in IOS_ANCHORS.items():
        if hue_gap(H, h) < 3 and abs(S - s_) < 3 and abs(L - l_) < 3:
            return label
    return None


def check_one(name: str, hsl: tuple[float, float, float], area: str) -> list[str]:
    H, S, L = hsl
    errs = []

    if S <= 5:                                   # 通道 B · 无彩色
        if 15 <= L <= 35 or 50 <= L <= 60:
            pass
        elif L > 75:
            errs.append(f"§十.1 通道B: L={L:.0f}% > 75% 为禁用档（黑字场景除外）")
        else:
            errs.append(f"§十.1 通道B: L={L:.0f}% 不在 15-35 / 50-60 / >75 任一档位")
    elif S < 70:                                 # 中间地带禁区
        errs.append(f"§十.1 **禁区**: S={S:.0f}% 落在 6-69% 严禁区间 —— 浑浊廉价感")
    else:                                        # 通道 A · 彩色
        if not (48 <= L <= 60):
            errs.append(f"§十.1 通道A: L={L:.0f}% 超出 48-60% 区间")
        for hue_name, hue_val in FORBIDDEN_HUES.items():
            if hue_gap(H, hue_val) < 8:
                errs.append(f"§十.1 禁用色相: H={H:.0f}° 接近{hue_name}(≈{hue_val}°) —— 双色骑墙")
        if area == "large":                      # §十.8 面积约束
            errs.append(f"§十.8 大面积禁用通道A: S={S:.0f}% L={L:.0f}% "
                        f"—— 大面积只允许 通道A+L≥85% / 通道B / 深灰 L15-25")
    return errs


def main() -> int:
    # Windows 控制台默认 GBK，输出 ✔/✘/° 会崩
    for stream in (sys.stdout, sys.stderr):
        try: stream.reconfigure(encoding="utf-8")
        except Exception: pass
    ap = argparse.ArgumentParser(description="§十 色彩系统可执行校验")
    ap.add_argument("colors", nargs="+")
    ap.add_argument("--area", choices=["small", "large"], default="small",
                    help="small=chip/badge/图标/按钮(默认)  large=整行整列背景/弹窗底/页面底")
    ap.add_argument("--palette", action="store_true", help="按色板检查 §十.6 密度与 §十.7 并置")
    ap.add_argument("--pair", action="store_true", help="按翻牌姊妹色检查 §十.3")
    args = ap.parse_args()

    try:
        parsed = [(c, parse_color(c)) for c in args.colors]
    except ValueError as e:
        print(f"✘ {e}", file=sys.stderr)
        return 1

    violations = 0
    print(f"§十 校验 · {len(parsed)} 色 · 面积={args.area}\n" + "─" * 62)
    for c, hsl in parsed:
        H, S, L = hsl
        errs = check_one(c, hsl, args.area)
        violations += len(errs)
        print(f"{'✘' if errs else '✔'} {c:<10} H={H:6.1f}°  S={S:5.1f}%  L={L:5.1f}%")
        anchor = ios_anchor(H, S, L)
        for e in errs:
            print(f"    → {e}")
        if errs and anchor:
            print(f"    ⓘ 此色为 §十.4 列出的 iOS 锚点（{anchor}）—— §十.4 与 §十.1 数值约束"
                  f"存在已知内部冲突，非选色失误；裁决前本脚本以 §十.1 为准")

    if args.pair:
        print("─" * 62)
        if len(parsed) != 2:
            print("✘ --pair 需要正好 2 个颜色"); return 1
        (c1, (h1, s1, l1)), (c2, (h2, s2, l2)) = parsed
        dl = abs(l1 - l2)
        if dl > 10:
            print(f"✘ §十.3 姊妹色: 亮度差 {dl:.0f}% > 10%"); violations += 1
        else:
            print(f"✔ §十.3 姊妹色: 亮度差 {dl:.0f}% ≤ 10%")
        ca = "A" if s1 >= 70 else ("B" if s1 <= 5 else "禁区")
        cb = "A" if s2 >= 70 else ("B" if s2 <= 5 else "禁区")
        if "禁区" in (ca, cb):
            print(f"✘ §十.3 组合跨越禁区: {c1}={ca} / {c2}={cb}"); violations += 1
        else:
            print(f"✔ §十.3 组合合法: 通道{ca} + 通道{cb}")

    if args.palette:
        print("─" * 62)
        chroma = [(c, hsl) for c, hsl in parsed if hsl[1] >= 70]
        hues = [hsl[0] for _, hsl in chroma]
        distinct = []
        for h in hues:
            if all(hue_gap(h, d) >= 15 for d in distinct):
                distinct.append(h)
        if len(distinct) > 6:
            print(f"✘ §十.6 密度: 同屏 {len(distinct)} 种色相 > 6 —— 最弱语义应退化为通道B(灰)")
            violations += 1
        else:
            print(f"✔ §十.6 密度: 同屏 {len(distinct)} 种色相 ≤ 6")
        bad = [(chroma[i][0], chroma[i+1][0], hue_gap(hues[i], hues[i+1]))
               for i in range(len(chroma) - 1) if hue_gap(hues[i], hues[i+1]) < 30]
        if bad:
            for a, b, g in bad:
                print(f"✘ §十.7 并置: {a} 与 {b} 色相间距 {g:.0f}° < 30° —— 相邻会打架")
            violations += len(bad)
        elif len(chroma) > 1:
            print(f"✔ §十.7 并置: 相邻彩色色相间距均 ≥ 30°")

    print("─" * 62)
    print(f"{'✘ 发现 %d 处违规' % violations if violations else '✔ 全部通过'}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
