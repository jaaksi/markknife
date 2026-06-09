import { useCallback, useEffect, useRef, useState } from 'react'

/** 目录中的一条标题。 */
export interface TocHeading {
  level: number
  text: string
}

/** 富文本表面的滚动容器(查看 / 所见即所得 / 分栏预览共用)。 */
const SCROLL_AREA_SELECTOR = '.editor-scroll-area'
/** BlockNote 把标题块渲染为带该属性的元素,据此定位标题。 */
const HEADING_SELECTOR = '[data-content-type="heading"]'
/** 判定「当前章节」时,标题距容器顶部的容差。 */
const ACTIVE_OFFSET = 80

interface UseTocHeadingsResult {
  headings: TocHeading[]
  activeIndex: number
  scrollTo: (index: number) => void
}

/**
 * DOM 驱动地从已渲染的富文本里提取标题目录,并提供滚动跳转与滚动高亮。
 *
 * 不解析 Markdown 字符串,而是直接读取 BlockNote 渲染出的标题元素,
 * 因此天然与三种模式的渲染结果一致,且 WYSIWYG 编辑时随 DOM 变化实时更新。
 *
 * @param signature 模式 / 文件等变化时改变,用于在表面重挂载后重新定位滚动容器。
 */
export function useTocHeadings(signature: string): UseTocHeadingsResult {
  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const elementsRef = useRef<HTMLElement[]>([])
  const scrollAreaRef = useRef<HTMLElement | null>(null)
  // 点击目录项触发的程序化平滑滚动期间锁定高亮,避免滚动事件把高亮抢回中途标题。
  const lockedRef = useRef(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 切换(模式 / 文件)后的过渡保护期标志:期间提取到空标题不清空目录,避免新表面异步渲染时面板闪烁。
  const settledRef = useRef(false)

  // 切文件 / 切模式:表面重挂载且回到顶部,高亮重置为首项。
  // 用「记录上一次签名 + 变化时在渲染期重置」取代 effect 内的 setState,避免级联渲染;
  // 滚动锁(ref)的清理留在下方 effect 里(渲染期不写 ref)。
  const [trackedSignature, setTrackedSignature] = useState(signature)
  if (trackedSignature !== signature) {
    setTrackedSignature(signature)
    setActiveIndex(0)
  }

  useEffect(() => {
    // 表面重挂载,清掉残留的滚动锁;并进入「切换过渡保护期」(见下方 rebuild)。
    lockedRef.current = false
    settledRef.current = false
    const scrollArea = document.querySelector(SCROLL_AREA_SELECTOR) as HTMLElement | null
    scrollAreaRef.current = scrollArea

    // 从当前滚动容器重建标题列表(集中走此函数,不在 effect 体内直接 setState)。
    // 关键:切模式 / 切文件时,新表面的 .editor-scroll-area 已挂载、但 BlockNote 异步渲染
    // 出标题元素还要一会儿,此刻提取必为空。若直接清空,目录会瞬时消失再出现造成闪烁。
    // 因此在过渡保护期内(settledRef=false)遇到空结果就「保留现有目录」不动,待表面渲染出
    // 标题后再替换;只有保护期结束(settle)或编辑态真的删光标题时,才允许把目录清空。
    const rebuild = () => {
      const area = scrollAreaRef.current
      const els = area ? (Array.from(area.querySelectorAll(HEADING_SELECTOR)) as HTMLElement[]) : []
      if (els.length === 0 && !settledRef.current) return
      elementsRef.current = els
      setHeadings(
        els.map((el) => ({
          level: Number(el.getAttribute('data-level')) || 1,
          text: (el.textContent ?? '').trim(),
        })),
      )
      // 标题变少时把高亮夹回合法区间,避免越界导致整列无高亮。
      setActiveIndex((prev) => (els.length === 0 ? 0 : Math.min(prev, els.length - 1)))
    }

    if (!scrollArea) {
      // 无滚动容器(回到起始页 / 无文档表面):直接清空,避免下次打开文件时残留上一文档的目录。
      // 置 settledRef 让 rebuild 走清空分支(setState 集中在 rebuild 内,不在 effect 体内同步调用)。
      settledRef.current = true
      rebuild()
      return
    }

    // 立即构建 + 兜底两次(BlockNote 异步渲染);后续靠 MutationObserver 实时同步。
    rebuild()
    const raf = requestAnimationFrame(rebuild)
    const settleTimer = setTimeout(() => {
      // 过渡保护期结束:此后「提取为空」才真正清空(切到无标题文档 / 编辑删光所有标题)。
      settledRef.current = true
      rebuild()
    }, 250)

    let rebuildTimer: ReturnType<typeof setTimeout> | undefined
    const observer = new MutationObserver(() => {
      clearTimeout(rebuildTimer)
      rebuildTimer = setTimeout(rebuild, 120)
    })
    observer.observe(scrollArea, { childList: true, subtree: true, characterData: true })

    // 滚动高亮:用 rAF 节流,避免高频 scroll 反复测量。
    let scrollRaf = 0
    const measureActive = () => {
      scrollRaf = 0
      if (lockedRef.current) return
      const els = elementsRef.current
      if (!els.length) return
      const baseTop = scrollArea.getBoundingClientRect().top
      const threshold = ACTIVE_OFFSET
      let idx = 0
      for (let i = 0; i < els.length; i++) {
        const relTop = els[i].getBoundingClientRect().top - baseTop
        if (relTop <= threshold) idx = i
        else break
      }
      setActiveIndex(idx)
    }
    const onScroll = () => {
      if (scrollRaf) return
      scrollRaf = requestAnimationFrame(measureActive)
    }
    scrollArea.addEventListener('scroll', onScroll, { passive: true })
    // 平滑滚动结束即解锁高亮(不支持 scrollend 的环境由 scrollTo 里的定时器兜底)。
    const onScrollEnd = () => {
      lockedRef.current = false
    }
    scrollArea.addEventListener('scrollend', onScrollEnd)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settleTimer)
      clearTimeout(rebuildTimer)
      if (scrollRaf) cancelAnimationFrame(scrollRaf)
      observer.disconnect()
      scrollArea.removeEventListener('scroll', onScroll)
      scrollArea.removeEventListener('scrollend', onScrollEnd)
    }
  }, [signature])

  const scrollTo = useCallback((index: number) => {
    const el = elementsRef.current[index]
    const scrollArea = scrollAreaRef.current
    if (!el || !scrollArea) return
    const top =
      el.getBoundingClientRect().top - scrollArea.getBoundingClientRect().top + scrollArea.scrollTop - 12
    // 锁定高亮到目标项,直到平滑滚动结束(scrollend / 定时器兜底),避免高亮沿途闪动。
    lockedRef.current = true
    setActiveIndex(index)
    scrollArea.scrollTo({ top, behavior: 'smooth' })
    clearTimeout(lockTimerRef.current)
    lockTimerRef.current = setTimeout(() => {
      lockedRef.current = false
    }, 700)
  }, [])

  // 卸载时清理兜底定时器。
  useEffect(() => () => clearTimeout(lockTimerRef.current), [])

  return { headings, activeIndex, scrollTo }
}
