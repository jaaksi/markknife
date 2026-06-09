import { ArrowsInLineVertical, ArrowsOutLineVertical, CaretDown, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import type { TocHeading } from './useTocHeadings'
import type { TocPosition } from './useTocPreferences'
import { useLanguage } from './useLanguage'

/** 树形行的左缩进(按层级);折叠三角占据缩进处,叶子用等宽占位对齐。 */
function indentClass(level: number): string {
  if (level <= 1) return 'pl-0.5'
  if (level === 2) return 'pl-[18px]'
  if (level === 3) return 'pl-[34px]'
  return 'pl-[50px]'
}

/** 三级及以下标题字号略小,形成层级阶梯(对齐设计原型)。 */
function fontSizeClass(level: number): string {
  return level >= 3 ? 'text-[12.5px]' : 'text-[13px]'
}

interface TocPanelProps {
  headings: TocHeading[]
  activeIndex: number
  position: TocPosition
  onSelect: (index: number) => void
  onCollapse: () => void
}

/** 目录里的一行:左侧折叠三角(或对齐占位)+ 可点击跳转的标题。 */
function TocRow({
  heading,
  index,
  active,
  isParent,
  isCollapsed,
  onSelect,
  onToggle,
}: {
  heading: TocHeading
  index: number
  active: boolean
  isParent: boolean
  isCollapsed: boolean
  onSelect: (index: number) => void
  onToggle: (index: number) => void
}) {
  const { t } = useLanguage()
  return (
    <div className={`relative my-px flex items-center ${indentClass(heading.level)}`}>
      {active && (
        <span aria-hidden="true" className="absolute top-[7px] bottom-[7px] left-0 w-[3px] rounded-full bg-primary" />
      )}
      {isParent ? (
        <button
          type="button"
          data-testid="toc-disclosure"
          aria-label={isCollapsed ? t('toc.expandChildren') : t('toc.collapseChildren')}
          aria-expanded={!isCollapsed}
          onClick={() => onToggle(index)}
          className="flex size-[18px] shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {isCollapsed ? (
            <CaretRight className="size-3" aria-hidden="true" />
          ) : (
            <CaretDown className="size-3" aria-hidden="true" />
          )}
        </button>
      ) : (
        <span className="size-[18px] shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        data-testid="toc-item"
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(index)}
        className={[
          'block min-w-0 flex-1 truncate rounded-md py-1.5 pr-2 pl-1 text-left leading-snug transition-colors',
          fontSizeClass(heading.level),
          heading.level <= 1 ? 'font-semibold' : 'font-normal',
          active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ].join(' ')}
      >
        {heading.text || t('toc.untitled')}
      </button>
    </div>
  )
}

/** 目录面板:文档标题生成的树形导航——滚动高亮、点击跳转、子级折叠、整体收起。 */
export function TocPanel({ headings, activeIndex, position, onSelect, onCollapse }: TocPanelProps) {
  const { t } = useLanguage()
  // 收起箭头指向面板所在的那一侧(左侧面板→左,右侧面板→右)。
  const CollapseIcon = position === 'left' ? CaretLeft : CaretRight
  const borderSide = position === 'left' ? 'border-r' : 'border-l'

  // 每个标题是否有子标题(紧随其后的标题层级更深)。
  const hasChildren = useMemo(
    () =>
      headings.map((heading, i) => {
        const next = headings[i + 1]
        return next ? next.level > heading.level : false
      }),
    [headings],
  )

  // 折叠的父节点索引集合。选择「不记忆」:标题结构(数量)变化时重置为全展开。
  // 用「记录上一次数量 + 变化时在渲染期重置」取代 effect 内 setState,避免级联渲染。
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [prevHeadingCount, setPrevHeadingCount] = useState(headings.length)
  if (prevHeadingCount !== headings.length) {
    setPrevHeadingCount(headings.length)
    setCollapsed(new Set())
  }

  const toggleNode = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // 落在「已折叠节点」后代范围内的标题被隐藏(支持多级嵌套)。
  const hidden = useMemo(() => {
    const out: boolean[] = new Array(headings.length).fill(false)
    let hideUntil = 0
    for (let i = 0; i < headings.length; i++) {
      const level = headings[i].level
      if (hideUntil && level > hideUntil) {
        out[i] = true
        continue
      }
      hideUntil = collapsed.has(i) && hasChildren[i] ? level : 0
    }
    return out
  }, [headings, collapsed, hasChildren])

  const hasParents = useMemo(() => hasChildren.some(Boolean), [hasChildren])
  const anyExpanded = useMemo(
    () => hasChildren.some((parent, i) => parent && !collapsed.has(i)),
    [hasChildren, collapsed],
  )
  const toggleAll = useCallback(() => {
    setCollapsed(anyExpanded ? new Set(hasChildren.flatMap((parent, i) => (parent ? [i] : []))) : new Set())
  }, [anyExpanded, hasChildren])

  // activeIndex 变化时,把高亮项滚入目录可视区(仅当它不可见,且只滚最小量),让目录随文档滚动而跟随;
  // 长目录里高亮项才不会滚出视野。只依赖 activeIndex,不干扰用户手动浏览目录。
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    // 回到第一个标题:直接把目录拉到最顶,确保第一项不被容器上边缘裁切
    // (原先靠 getBoundingClientRect 对齐计算,受 padding/行间距影响偶有残留导致文字显示不全)。
    if (activeIndex <= 0) {
      nav.scrollTop = 0
      return
    }
    const activeEl = nav.querySelector<HTMLElement>('[data-testid="toc-item"][aria-current="true"]')
    if (!activeEl) return
    const navRect = nav.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    // 对齐时留一点余量,避免高亮项紧贴边缘或被 padding 裁切。
    const MARGIN = 8
    if (elRect.top < navRect.top + MARGIN) {
      nav.scrollBy({ top: elRect.top - navRect.top - MARGIN })
    } else if (elRect.bottom > navRect.bottom - MARGIN) {
      nav.scrollBy({ top: elRect.bottom - navRect.bottom + MARGIN })
    }
  }, [activeIndex])

  return (
    <aside
      data-testid="toc-panel"
      className={`flex w-[264px] shrink-0 flex-col bg-background ${borderSide} border-border`}
    >
      <div className="flex h-10 shrink-0 items-center gap-0.5 pr-2 pl-4">
        <span className="flex-1 text-[11.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t('toc.title')}
        </span>
        {hasParents && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={anyExpanded ? t('toc.collapseAll') : t('toc.expandAll')}
            title={anyExpanded ? t('toc.collapseAll') : t('toc.expandAll')}
            data-testid="toc-toggle-all"
            onClick={toggleAll}
          >
            {anyExpanded ? (
              <ArrowsInLineVertical aria-hidden="true" />
            ) : (
              <ArrowsOutLineVertical aria-hidden="true" />
            )}
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={t('toc.collapse')}
          title={t('toc.collapse')}
          onClick={onCollapse}
        >
          <CollapseIcon aria-hidden="true" />
        </Button>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto px-2 pt-1 pb-4">
        {headings.map((heading, index) =>
          hidden[index] ? null : (
            <TocRow
              key={`${index}-${heading.text}`}
              heading={heading}
              index={index}
              active={index === activeIndex}
              isParent={hasChildren[index]}
              isCollapsed={collapsed.has(index)}
              onSelect={onSelect}
              onToggle={toggleNode}
            />
          ),
        )}
      </nav>
    </aside>
  )
}

/** 目录收起后,贴在内容边缘的细条;点击重新展开。 */
export function TocReopenRail({ position, onExpand }: { position: TocPosition; onExpand: () => void }) {
  const { t } = useLanguage()
  // 折叠态:内容边缘顶部的悬浮小标签(圆角 + 阴影);只放竖排「目录」二字并水平居中,不带箭头。
  const sideClasses =
    position === 'left'
      ? 'left-0 rounded-r-[10px] border-l-0 shadow-[2px_2px_8px_rgba(0,0,0,0.06)]'
      : 'right-0 rounded-l-[10px] border-r-0 shadow-[-2px_2px_8px_rgba(0,0,0,0.06)]'

  return (
    <button
      type="button"
      data-testid="toc-reopen"
      aria-label={t('toc.expand')}
      title={t('toc.expand')}
      onClick={onExpand}
      className={`absolute top-3 z-10 flex h-[84px] w-[30px] items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:text-primary ${sideClasses}`}
    >
      <span className="text-[11px] tracking-[0.15em]" style={{ writingMode: 'vertical-rl' }}>
        {t('toc.title')}
      </span>
    </button>
  )
}
