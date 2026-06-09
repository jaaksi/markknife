# macOS 应用图标 SVG 生成规范(Markknife)

> 用途:统一约束「打包用 macOS 图标」的 SVG。可直接作为生成提示词。
> 渲染成 1024×1024 PNG 后交给 `pnpm tauri icon` 生成全套。

## 1. 画布
- 尺寸:**1024 × 1024**,`viewBox="0 0 1024 1024"`。
- 背景:**透明**(四周留白区域不填色)。
  - macOS 规范要求图标边缘透明,Dock/Finder 才干净。

## 2. 图标本体(圆角矩形)
- 尺寸:**824 × 824**(占画布约 80%)。
- 位置:居中,`x=100 y=100`,**四周各留白 100px**(约 9.8%)。
- 圆角:**rx = 185**(≈ 边长的 22.4%,贴近 macOS 的 continuous-corner/squircle 观感)。
- 填充:品牌渐变(见 §4)。

## 3. 前景内容(Logo 图形)
- 居中放置在本体内。
- **安全区**:内容再向内留边,内容外接框约占**本体的 55%~65%**(即占整张画布约 **45%~52%**)。
- 不要贴到本体圆角边缘,避免被系统裁切或显得拥挤。
- 描边类图形线宽:以 120 基准视图的 `stroke-width≈10` 等比放大(× 7.923 ≈ 79px),圆头圆角。

## 4. 颜色
- 品牌渐变:**135°(左上→右下)**,`#5b86ff → #8b5cf6`。
- 前景:纯白 `#ffffff`。

## 5. 坐标换算(从 120 基准视图映射到本体)
应用内/favicon 用的是 120 基准视图(本体 `rect 8,8,104,104 rx28`)。映射到 macOS 本体:
- `scale = 824 / 104 ≈ 7.923`
- `translate = 100 − 8 × 7.923 ≈ 36.62`
- 即:`<g transform="translate(36.62 36.62) scale(7.923)">…120 视图内容…</g>`

## 6. 导出要求
- 渲染器:**Chrome 无头模式 / resvg / rsvg-convert**(保留透明)。
  - ⚠️ 不要用 `qlmanage`:它会给透明 SVG 强加白底。
- 输出:1024×1024 PNG、RGBA、透明背景。
- 之后:`pnpm tauri icon <png>` → 覆盖 `src-tauri/icons/`(删除多生成的 `android/`、`ios/`)。

## 7. 骨架模板
```svg
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b86ff"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>

  <!-- 本体:824 圆角方块,四周留白 100,圆角 185 -->
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>

  <!-- 前景:居中、占本体 55%~65%、纯白 -->
  <g transform="translate(36.62 36.62) scale(7.923)" fill="#ffffff">
    <!-- …此处放 120 基准视图的 logo 图形… -->
  </g>
</svg>
```

## 8. 速查表
| 项目 | 值 |
|------|-----|
| 画布 | 1024 × 1024 |
| 背景 | 透明 |
| 本体尺寸 | 824 × 824(画布 80%) |
| 四周留白 | 100px(每边) |
| 圆角 rx | 185(≈22.4%) |
| 本体填充 | 135° 渐变 #5b86ff→#8b5cf6 |
| 前景占比 | 本体 55%~65% / 画布 45%~52% |
| 前景色 | #ffffff |
| 导出 | 1024 PNG,透明,Chrome/resvg 渲染 |
