import { useCallback, useEffect, useRef, useState } from 'react'

/** 富文本表面的滚动容器(查看 / 所见即所得 / 分栏预览共用),与 useTocHeadings 一致。 */
const SCROLL_AREA_SELECTOR = '.editor-scroll-area'
/** 实际内容容器:把搜索范围限定在正文,排除滚动容器上的内边距等。 */
const CONTENT_SELECTOR = '.editor-content-wrapper'
/** CSS Custom Highlight 名称:全部匹配 / 当前匹配。 */
const HIGHLIGHT = 'mk-search'
const HIGHLIGHT_ACTIVE = 'mk-search-active'
const RECOMPUTE_DEBOUNCE_MS = 150
/** 匹配数上限:极短词 + 超大文档时避免卡死。 */
const MAX_MATCHES = 5000

// CSS Custom Highlight API 在 TS lib 里不一定有声明,做最小的结构化类型,避免使用 any。
type HighlightCtor = new (...ranges: Range[]) => unknown
interface HighlightRegistryLike {
  set: (name: string, highlight: unknown) => void
  delete: (name: string) => void
}

/** 取 CSS Custom Highlight API(不支持的旧 WebView 返回 null,调用方降级为无高亮)。 */
function highlightApi(): { Ctor: HighlightCtor; registry: HighlightRegistryLike } | null {
  const Ctor = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight
  const registry = (globalThis as unknown as { CSS?: { highlights?: HighlightRegistryLike } }).CSS?.highlights
  if (!Ctor || !registry) return null
  return { Ctor, registry }
}

function findRoot(): HTMLElement | null {
  const area = document.querySelector(SCROLL_AREA_SELECTOR)
  if (!area) return null
  return (area.querySelector(CONTENT_SELECTOR) as HTMLElement | null) ?? (area as HTMLElement)
}

/** 在正文文本节点里收集所有(大小写不敏感)匹配区间;匹配不跨节点(v1 可接受)。 */
function collectRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.toLowerCase()
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node.nodeValue ?? ''
    if (text) {
      const hay = text.toLowerCase()
      let from = hay.indexOf(needle)
      while (from !== -1) {
        const range = document.createRange()
        range.setStart(node, from)
        range.setEnd(node, from + needle.length)
        ranges.push(range)
        if (ranges.length >= MAX_MATCHES) return ranges
        from = hay.indexOf(needle, from + needle.length)
      }
    }
    node = walker.nextNode()
  }
  return ranges
}

export interface UseDocumentSearchResult {
  query: string
  setQuery: (q: string) => void
  total: number
  /** 当前匹配的 0-based 序号(无匹配时为 0)。 */
  activeIndex: number
  next: () => void
  prev: () => void
}

/**
 * 当前文档内查找:在富文本渲染区(.editor-scroll-area)内按关键字高亮所有匹配并支持上一个/下一个跳转。
 * 用 CSS Custom Highlight API 基于 Range 高亮——不修改 DOM,在可编辑的 BlockNote 里也安全。
 *
 * @param active 搜索是否启用(搜索栏打开且有文件)。
 * @param signature 模式/文件签名,变化时重新定位容器并重算。
 */
export function useDocumentSearch({ active, signature }: { active: boolean; signature: string }): UseDocumentSearchResult {
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const rangesRef = useRef<Range[]>([])
  // 当前匹配序号的镜像:所有 setActiveIndex 处都同步更新它,供回调/定时器读取最新值(不在渲染期写)。
  const activeIndexRef = useRef(0)

  const applyHighlights = useCallback(() => {
    const api = highlightApi()
    if (!api) return
    const ranges = rangesRef.current
    if (ranges.length === 0) {
      api.registry.delete(HIGHLIGHT)
      api.registry.delete(HIGHLIGHT_ACTIVE)
      return
    }
    api.registry.set(HIGHLIGHT, new api.Ctor(...ranges))
    const current = ranges[activeIndexRef.current]
    if (current) api.registry.set(HIGHLIGHT_ACTIVE, new api.Ctor(current))
    else api.registry.delete(HIGHLIGHT_ACTIVE)
  }, [])

  const clearHighlights = useCallback(() => {
    const api = highlightApi()
    api?.registry.delete(HIGHLIGHT)
    api?.registry.delete(HIGHLIGHT_ACTIVE)
    rangesRef.current = []
  }, [])

  const scrollActiveIntoView = useCallback(() => {
    const area = document.querySelector(SCROLL_AREA_SELECTOR) as HTMLElement | null
    const range = rangesRef.current[activeIndexRef.current]
    if (!area || !range) return
    const r = range.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return
    const a = area.getBoundingClientRect()
    // 当前匹配不在可视区(留 48px 余量)时,滚动到靠近视口上三分之一处。
    if (r.top < a.top + 48 || r.bottom > a.bottom - 48) {
      area.scrollBy({ top: r.top - a.top - a.height / 3, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    // setState 集中在下面的函数里调用(不在 effect 体内直接同步 setState),规避 react-hooks/set-state-in-effect。
    const resetEmpty = () => {
      clearHighlights()
      setTotal(0)
      setActiveIndex(0)
      activeIndexRef.current = 0
    }
    if (!active || !query.trim()) {
      resetEmpty()
      return
    }

    // resetActive=true:查询/容器变,重置到首个匹配并滚动;false:内容变(编辑),保留当前位置只更新计数。
    const recompute = (resetActive: boolean) => {
      const root = findRoot()
      if (!root) {
        resetEmpty()
        return
      }
      const ranges = collectRanges(root, query.trim())
      rangesRef.current = ranges
      setTotal(ranges.length)
      let nextActive = resetActive ? 0 : activeIndexRef.current
      if (nextActive >= ranges.length) nextActive = ranges.length > 0 ? ranges.length - 1 : 0
      activeIndexRef.current = nextActive
      setActiveIndex(nextActive)
      applyHighlights()
      if (resetActive) scrollActiveIntoView()
    }

    const queryTimer = setTimeout(() => recompute(true), RECOMPUTE_DEBOUNCE_MS)

    // 内容变化(所见即所得编辑)→ 防抖重算,保留当前位置。
    const root = findRoot()
    let moTimer: ReturnType<typeof setTimeout> | undefined
    const observer = new MutationObserver(() => {
      clearTimeout(moTimer)
      moTimer = setTimeout(() => recompute(false), RECOMPUTE_DEBOUNCE_MS)
    })
    if (root) observer.observe(root, { childList: true, subtree: true, characterData: true })

    return () => {
      clearTimeout(queryTimer)
      clearTimeout(moTimer)
      observer.disconnect()
    }
  }, [active, query, signature, applyHighlights, clearHighlights, scrollActiveIntoView])

  // 关闭搜索时清掉高亮。
  useEffect(() => {
    if (active) return
    clearHighlights()
  }, [active, clearHighlights])

  const next = useCallback(() => {
    const len = rangesRef.current.length
    if (len === 0) return
    const ni = (activeIndexRef.current + 1) % len
    activeIndexRef.current = ni
    setActiveIndex(ni)
    applyHighlights()
    scrollActiveIntoView()
  }, [applyHighlights, scrollActiveIntoView])

  const prev = useCallback(() => {
    const len = rangesRef.current.length
    if (len === 0) return
    const ni = (activeIndexRef.current - 1 + len) % len
    activeIndexRef.current = ni
    setActiveIndex(ni)
    applyHighlights()
    scrollActiveIntoView()
  }, [applyHighlights, scrollActiveIntoView])

  return { query, setQuery, total, activeIndex, next, prev }
}
