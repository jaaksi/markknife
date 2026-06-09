import { useEffect, useRef } from 'react'
import { CaretDown, CaretUp, X } from '@phosphor-icons/react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useLanguage } from './useLanguage'

interface SearchBarProps {
  query: string
  onQueryChange: (value: string) => void
  total: number
  activeIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

/** 文档内查找浮层:右上角,输入框 + 计数 + 上一个/下一个 + 关闭。回车=下一个、Shift+回车=上一个、Esc=关闭。 */
export function SearchBar({ query, onQueryChange, total, activeIndex, onNext, onPrev, onClose }: SearchBarProps) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开即聚焦并全选,便于直接输入或替换上次的关键字。
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  const hasQuery = query.trim().length > 0
  const counter = hasQuery
    ? total > 0
      ? t('search.count', { current: activeIndex + 1, total })
      : t('search.noResults')
    : ''

  return (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-1 rounded-lg border border-border bg-popover px-1.5 py-1 shadow-md">
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) onPrev()
            else onNext()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="h-7 w-48 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
      />
      <span className="min-w-[48px] shrink-0 px-1 text-center text-xs tabular-nums text-muted-foreground">
        {counter}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t('search.prev')}
        title={t('search.prev')}
        disabled={total === 0}
        onClick={onPrev}
      >
        <CaretUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t('search.next')}
        title={t('search.next')}
        disabled={total === 0}
        onClick={onNext}
      >
        <CaretDown />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t('search.close')}
        title={t('search.close')}
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}
