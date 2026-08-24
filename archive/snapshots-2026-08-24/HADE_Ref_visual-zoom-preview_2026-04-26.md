# 可缩放预览视图 — 布局陷阱 & 对齐原则

> **何时读**: 做"带缩放的画布/文档/A4 预览"这类组件时。涉及 zoom/scale、滚动条、对称居中、呼吸比例、窗口自适应。
> 从 2026-04-18/19 周报分拣预览模块反复调试中提炼。多处 HADE 自以为对、用户反复纠正才拿到的教训。

---

## 核心设计原则

### 1. 呼吸比例锚点是"字号/内容",不是"窗口宽"

用户视觉感知 = 呼吸 / 字号。固定 `2.5% × 窗口宽` 的呼吸,在大字号(高 zoom)处显得小、在小字号(低 zoom)处显得大。

**正确做法**: 呼吸 = r × 内容宽度 × zoom,r 固定(如 2.63%)。

```js
// 单页 max: z = availW / (415 × (1 + 2r))  = availW / 437 (r=0.0263)
// 双页 max: z = availW / (2×415×(1+r) + middle)  = availW / 1044
// 两者呼吸/内容比例 = r 一致,视觉上字号周围"呼吸感"相同
```

**反例**: 双页 max 用 `availW × 0.95 / 1022` 看似 5% 呼吸,实际呼吸/单侧字号 = 6.3%,远大于单页 2.63% → 双页看起来太松。

### 2. 单双页规则对称

多面板布局(单页 vs 双页、一栏 vs 两栏)的 min/max/焦点/呼吸规则要"同构",不是并列的两套公式。统一参数化,只改 N(面板数) M(中间间距)。

### 3. 焦点锚点 = top center,不是 center center

放大时用户想"看清顶部开始的内容",不是"以中点为轴对称扩散"。`align-items: center` 会让放大后内容上下均等溢出 → 顶部被推出窗口上方,用户看不到。

**正确**: `align-items: flex-start` + `transform-origin: top center` + scrollTop 保持 0。

---

## CSS 陷阱(按踩坑顺序)

### 陷阱 1: `margin: auto` 在 flex 容器里,元素放大超出父级时失效

flex 容器 + `margin: auto` 让子元素居中 —— **仅当子元素 ≤ 父级宽度**。一旦子元素宽度 > 父级,`margin: auto` 变 0,子元素回到 flex-start(左对齐)。

**现象**: 小 zoom 居中,放大到超出窗口就左贴边。

**修**: 去 `margin: auto`,改用绝对定位:
```css
.scene {
  position: absolute;
  left: calc(50% - var(--inner-w) / 2);
  width: var(--inner-w);
}
```
`left: calc(50% - w/2)` 无论放大缩小都真居中(溢出时左右对称溢出,配合 `overflow: hidden` 等量裁)。

### 陷阱 2: CSS `zoom` 属性和 flex 混用,double-page 偏左

`zoom` 在 Chrome 里会改 layout size,但 flex 容器对它的支持不稳定,有时按未 zoom 尺寸算布局 → 放大后视觉向右溢出,观感像左对齐。

**修**: 放弃 `zoom` CSS,改 `transform: scale(z)`。但 scale 不改 layout size,所以需要 placeholder 维持滚动区域:
```jsx
<div style={{ height: innerH * z }}>  {/* placeholder for scroll */}
  <div style={{
    position: 'absolute',
    left: `calc(50% - ${innerW / 2}px)`,
    top: 0,
    width: innerW,
    height: innerH,
    transform: `scale(${z})`,
    transformOrigin: 'top center',
  }}>
    {/* 真实内容,自然尺寸 */}
  </div>
</div>
```

### 陷阱 3: 滚动条出现 → "50%" 偏移,兄弟元素不再对齐

主内容区(pv-main)有 overflow-y:auto,纵向溢出时滚动条出现,pv-main.clientWidth 减小 scrollbar_width(~15px),其 `50%` 向左偏 7.5px。

同级的顶栏(不滚动)的 `50%` 还在窗口真正的一半。两者对不齐。

**现象**: 默认缩放两者对齐,放大后内容左移 7-8px。

**修**:
```css
.pv-main {
  scrollbar-gutter: stable both-edges;
}
```
两侧都预留 scrollbar 空间,内容始终居中在 pv-main 的完整宽度,和不带 scroll 的兄弟元素对齐。

### 陷阱 4: 初始化 zoom 一帧闪烁 / HMR 保留旧 state

`useEffect(() => { setZoom(availH/H) }, [])` 在 paint 之后跑,首帧显示 `useState(1)` 的 1.0,然后跳到正确值。HMR 下 zoom state 还会残留上次调试的值。

**修**: 用 `useLayoutEffect`,paint 前同步读 clientHeight 设 zoom,不闪烁。

---

## 防御性配套

### ResizeObserver 替代 window.resize

Electron 里窗口内部尺寸变化(拖拽边缘、devtools 开合)不一定触发 `window.resize`。改用 `ResizeObserver` 监听容器本身:
```js
useEffect(() => {
  const ro = new ResizeObserver(() => calcZoomRange())
  ro.observe(containerRef.current)
  return () => ro.disconnect()
}, [calcZoomRange])
```

### Electron 主窗口最小尺寸

`new BrowserWindow({ minWidth: 960, minHeight: 640 })` 防止用户拖到极小导致 zoom 公式失效。

### min/max 防御 —— 保证 min ≤ max

当窗口极窄/极矮,fitContent 可能 < fitAll。用:
```js
setZoomRange({ min: fitAll, max: Math.max(fitAll, fitContent) })
```
保证滑块不会出现 min > max 的异常。

---

## 沟通 & 调试套路(人机协作)

### 当用户说"不对",我算出"对"时 — 不要防御

数学公式对 ≠ 视觉对。通常漏了:
- 滚动条宽度对中心计算的偏移
- 容器 padding / box-sizing
- HMR state 残留 vs 实际公式
- Transform origin 位置

**动作**: 让用户跑一段 eval,读 `getBoundingClientRect()` 的真实数值,对比理论值。真实数值是唯一裁判。

样板 eval:
```js
(() => {
  const main = document.querySelector('.pv-main')
  const iframe = document.querySelectorAll('.pv-page')[0]
  return {
    窗口宽: main.clientWidth,
    iframe左: iframe.getBoundingClientRect().left - main.getBoundingClientRect().left,
    当前zoom: document.querySelector('.pv-zoom-num-btn, .pv-zoom-num').textContent
  }
})()
```

### 用 ASCII 图对齐理解

多次纯文字讨论布局容易跑偏。一旦用户/HADE 重复 2+ 次还没对齐,立刻出 ASCII:
```
单页 max (z=293%, 窗口 1280):
┌────────────────────────────────────────┐
│←32→│━━ 文字内容 1216 ━━│←32→│
└────────────────────────────────────────┘
```
"具体数字 + 形状"比"呼吸很小"这类形容词精确百倍。

### 不要猜"用户指哪个"

用户说"缩小间距",可能指:
- 外呼吸(窗口边到内容)
- 内呼吸(两页中间)
- 内容区页边距(A4 模板的 90px)
- gap(iframe 间隙)

**必问**: 用 ASCII 圈出可能的多个位置,让用户指。猜一个去动是反复的根源。

### 防"回去" — 修改范围要可逆、小步

做视觉调整时每次只改一维(比如只改 gap,别同时改 gap+clip+formula),每步让用户看效果。一股脑改三处,只要一处不对用户会让你"全退回",浪费上下文。

---

## 参考:周报分拣预览模块终态

(2026-04-19)
- 文件: `src/PreviewModal.jsx` 的 `FinalPreview` 组件
- 核心:
  - `min = 高度撑满`(useLayoutEffect 设,ResizeObserver 跟)
  - `max = availW / 437(单页) / 1044(双页)` — 呼吸/字号比例 2.63%
  - 结构: placeholder div(撑 scroll 高度) > 绝对定位 scene(transform:scale + origin:top center)
  - CSS: `.pv-main { overflow-x:hidden; overflow-y:auto; scrollbar-gutter:stable both-edges }`
- 此节点以前的公式(zoom CSS、fitAll*0.65、固定 5% 呼吸)都已被这套替换,不要参考旧代码。
