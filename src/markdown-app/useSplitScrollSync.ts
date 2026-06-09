import { useEffect, useRef, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { parseTopLevelSourceSpans } from './markdownSourceMap'

/** 程序化滚动后实际 scrollTop 与期望值的取整误差容差。 */
const EPS = 2
/** 内容/尺寸变化后重建锚点的防抖。 */
const REBUILD_DEBOUNCE_MS = 120
/** 首屏 BlockNote 异步渲染完成后再兜底重建一次。 */
const SETTLE_MS = 300

/** 一对锚点:源码侧 scrollTop ↔ 预览侧 scrollTop(两序列均严格递增,可双向插值)。 */
interface AnchorPair {
  srcY: number
  prevY: number
}

/** 取预览里的顶层 BlockNote 块(排除嵌套在列表项/引用等里的子块),保持文档顺序。 */
function getTopLevelBlocks(previewEl: HTMLElement): HTMLElement[] {
  const all = Array.from(previewEl.querySelectorAll<HTMLElement>('[data-node-type="blockContainer"]'))
  return all.filter((el) => !el.parentElement?.closest<HTMLElement>('[data-node-type="blockContainer"]'))
}

function clampLine(lineCount: number, line: number): number {
  return Math.min(Math.max(line, 1), lineCount)
}

/**
 * 用「源码块行范围 ↔ 预览块位置」构建单调锚点。
 * 每个块给出顶/底两对锚点(块内可按行/像素比例插值),首尾加文档边界哨兵。
 * 顶层块数量与源码块数量不一致(GFM 边角语法、durable 块解析差异等)时返回 null,交由调用方降级。
 */
function buildAnchors(view: EditorView, previewEl: HTMLElement, markdown: string): AnchorPair[] | null {
  const spans = parseTopLevelSourceSpans(markdown)
  const blocks = getTopLevelBlocks(previewEl)
  if (spans.length === 0 || spans.length !== blocks.length) return null

  const doc = view.state.doc
  const previewRect = previewEl.getBoundingClientRect()
  const raw: AnchorPair[] = [{ srcY: 0, prevY: 0 }]
  for (let i = 0; i < spans.length; i++) {
    const startLine = clampLine(doc.lines, spans[i].startLine)
    const endLine = clampLine(doc.lines, spans[i].endLine)
    // CodeMirror 文档坐标:lineBlockAt(pos).top 可直接作为把该行滚到顶部的 scrollTop。
    const srcTop = view.lineBlockAt(doc.line(startLine).from).top
    const srcBottom = view.lineBlockAt(doc.line(endLine).from).bottom
    // 预览块在滚动容器内的偏移。
    const rect = blocks[i].getBoundingClientRect()
    const prevTop = rect.top - previewRect.top + previewEl.scrollTop
    const prevBottom = prevTop + blocks[i].offsetHeight
    raw.push({ srcY: srcTop, prevY: prevTop }, { srcY: srcBottom, prevY: prevBottom })
  }
  raw.push({ srcY: view.scrollDOM.scrollHeight, prevY: previewEl.scrollHeight })

  // 清洗成两序列都严格递增,保证按任一维度二分插值都单调。
  const anchors: AnchorPair[] = []
  for (const p of raw) {
    const last = anchors[anchors.length - 1]
    if (!last || (p.srcY > last.srcY && p.prevY > last.prevY)) anchors.push(p)
  }
  return anchors.length >= 2 ? anchors : null
}

/** 在单调锚点上按 from 维度二分,线性插值出 to 维度对应值。 */
function interpolate(anchors: AnchorPair[], value: number, from: 'srcY' | 'prevY', to: 'srcY' | 'prevY'): number {
  if (value <= anchors[0][from]) return anchors[0][to]
  const tail = anchors[anchors.length - 1]
  if (value >= tail[from]) return tail[to]
  let lo = 0
  let hi = anchors.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (anchors[mid][from] <= value) lo = mid
    else hi = mid
  }
  const a = anchors[lo]
  const b = anchors[hi]
  const span = b[from] - a[from]
  const f = span > 0 ? (value - a[from]) / span : 0
  return a[to] + f * (b[to] - a[to])
}

/** 降级方案:按整体滚动百分比把 src 同步到 dst。 */
function ratioTarget(src: HTMLElement, dst: HTMLElement): number {
  const srcMax = src.scrollHeight - src.clientHeight
  const dstMax = dst.scrollHeight - dst.clientHeight
  const ratio = srcMax > 0 ? src.scrollTop / srcMax : 0
  return dstMax * ratio
}

/**
 * 分栏模式「行级」滚动联动:源码(CodeMirror)与预览(BlockNote)按源码块↔预览块的位置映射双向同步,
 * 块内按比例插值实现逐行体感;块数不匹配 / 无法映射时自动降级到整体百分比联动。
 *
 * 锚点会在内容或尺寸变化(编辑、窗口缩放、预览异步渲染完成)时重建。SplitView 按 activePath 重挂载,
 * 故换文件时本 hook 随之重置。
 */
export function useSplitScrollSync({
  rootRef,
  cmViewRef,
  markdown,
}: {
  rootRef: RefObject<HTMLDivElement | null>
  cmViewRef: RefObject<EditorView | null>
  markdown: string
}): void {
  // 用 ref 读最新 markdown,避免把它放进 effect 依赖导致每次输入都重绑监听。
  const markdownRef = useRef(markdown)
  markdownRef.current = markdown

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let raf = 0
    let tries = 0
    let teardown: (() => void) | undefined

    // 两侧滚动容器由子组件异步挂载,拿不到就逐帧重试(约 1.5s 上限)。
    const setup = () => {
      const view = cmViewRef.current
      const previewEl = root.querySelector<HTMLElement>('.editor-scroll-area')
      if (!view || !previewEl) {
        if (tries++ < 90) raf = requestAnimationFrame(setup)
        return
      }
      const cmEl = view.scrollDOM

      let anchors: AnchorPair[] | null = null
      let expectedCm: number | null = null
      let expectedPreview: number | null = null

      const rebuild = () => {
        anchors = buildAnchors(view, previewEl, markdownRef.current)
      }

      const onCmScroll = () => {
        // 由联动写入 cm 触发的事件:实际位置≈期望值,跳过不反向传播。
        if (expectedCm !== null && Math.abs(cmEl.scrollTop - expectedCm) <= EPS) {
          expectedCm = null
          return
        }
        expectedCm = null
        const target = anchors ? interpolate(anchors, cmEl.scrollTop, 'srcY', 'prevY') : ratioTarget(cmEl, previewEl)
        expectedPreview = target
        previewEl.scrollTop = target
      }
      const onPreviewScroll = () => {
        if (expectedPreview !== null && Math.abs(previewEl.scrollTop - expectedPreview) <= EPS) {
          expectedPreview = null
          return
        }
        expectedPreview = null
        const target = anchors ? interpolate(anchors, previewEl.scrollTop, 'prevY', 'srcY') : ratioTarget(previewEl, cmEl)
        expectedCm = target
        cmEl.scrollTop = target
      }

      let rebuildTimer: ReturnType<typeof setTimeout> | undefined
      const scheduleRebuild = () => {
        clearTimeout(rebuildTimer)
        rebuildTimer = setTimeout(rebuild, REBUILD_DEBOUNCE_MS)
      }

      rebuild()
      const settleTimer = setTimeout(rebuild, SETTLE_MS)

      // 内容高度变化(编辑、换行重排、预览渲染完成)→ 重建锚点。观察「内容」元素而非固定高的滚动容器。
      const ro = new ResizeObserver(scheduleRebuild)
      ro.observe(view.contentDOM)
      const wrapper = previewEl.querySelector('.editor-content-wrapper')
      if (wrapper) ro.observe(wrapper)

      cmEl.addEventListener('scroll', onCmScroll, { passive: true })
      previewEl.addEventListener('scroll', onPreviewScroll, { passive: true })

      teardown = () => {
        clearTimeout(rebuildTimer)
        clearTimeout(settleTimer)
        ro.disconnect()
        cmEl.removeEventListener('scroll', onCmScroll)
        previewEl.removeEventListener('scroll', onPreviewScroll)
      }
    }

    setup()
    return () => {
      cancelAnimationFrame(raf)
      teardown?.()
    }
  }, [rootRef, cmViewRef])
}
