import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { formatRelativeTime } from './relativeTime'
import type { RecentFile } from './useRecentFiles'
import { useLanguage } from './useLanguage'

interface StartPageProps {
  recents: RecentFile[]
  onOpen: () => void
  onNew: () => void
  onOpenRecent: (path: string) => void
  onRemoveRecent: (path: string) => void
  onClearRecents: () => void
}

/** 把命中搜索关键词的片段用高亮包裹。 */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-[#fff2ac] px-px text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

const FolderIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
  </svg>
)

const FileIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
)

/** 品牌标志:M + 刀(与应用图标一致的白色前景),放在起始页的渐变方块里。 */
const BrandMark = (
  <svg viewBox="24 24 72 72" fill="none">
    <polyline points="34 84 34 42 60 66 86 42" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="81" y="38" width="10" height="20" rx="4" fill="currentColor" />
    <rect x="78" y="58" width="16" height="4.5" rx="2" fill="currentColor" />
    <path d="M81 63 L91 63 L91 80 Q91 86.5 86 89 Q81 86.5 81 80 Z" fill="currentColor" />
  </svg>
)

const NewFileIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
)

const SearchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const TrashIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

/** 起始页:无文件时的欢迎页 —— 品牌头、打开/新建、搜索、最近打开历史。1:1 还原设计稿。 */
export function StartPage({ recents, onOpen, onNew, onOpenRecent, onRemoveRecent, onClearRecents }: StartPageProps) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recents
    return recents.filter((it) => it.name.toLowerCase().includes(q) || it.path.toLowerCase().includes(q))
  }, [recents, query])

  const isEmpty = visible.length === 0
  const isSearchEmpty = isEmpty && query.trim().length > 0

  return (
    // 顶部品牌/操作/搜索/区块标题固定,仅「最近打开」列表区域滚动。
    <div className="flex min-h-0 flex-1 justify-center">
      <div className="flex min-h-0 w-full max-w-[600px] flex-col px-8 pt-11">
        {/* 品牌头 */}
        <div className="mb-[26px] flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#5b86ff,#8b5cf6)] text-white shadow-[0_8px_22px_rgba(91,134,255,0.35)]">
            <span className="block size-[30px]">{BrandMark}</span>
          </div>
          <div>
            <h1 className="m-0 text-[23px] font-bold tracking-[-0.01em]">{t('startPage.welcomeTitle')}</h1>
            <p className="m-0 text-[13.5px] text-muted-foreground">{t('startPage.welcomeSubtitle')}</p>
          </div>
        </div>

        {/* 主操作 */}
        <div className="mb-[22px] flex gap-2.5">
          <Button
            type="button"
            onClick={onOpen}
            className="h-[42px] flex-1 gap-2 rounded-[10px] text-[13.5px] font-semibold shadow-[0_2px_8px_rgba(21,93,255,0.32)]"
          >
            <span className="size-[17px]">{FolderIcon}</span>
            {t('startPage.open')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onNew}
            className="h-[42px] flex-1 gap-2 rounded-[10px] text-[13.5px] font-semibold"
          >
            <span className="size-[17px]">{NewFileIcon}</span>
            {t('startPage.new')}
          </Button>
        </div>

        {/* 搜索 */}
        <div className="mb-[18px] flex h-11 items-center gap-2 rounded-[10px] border border-border bg-background pr-2.5 pl-3 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <span className="size-4 shrink-0 text-muted-foreground/70">{SearchIcon}</span>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault()
                setQuery('')
              }
            }}
            placeholder={t('startPage.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[13.5px] shadow-none focus-visible:ring-0"
          />
          {query && (
            <button
              type="button"
              aria-label={t('startPage.clearSearch')}
              title={t('startPage.clear')}
              onClick={() => setQuery('')}
              className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="size-3">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        {/* 区块标题 */}
        <div className="flex items-center gap-2 px-1 pb-2">
          <span className="text-[11px] font-bold tracking-[0.07em] text-muted-foreground uppercase">{t('startPage.recent')}</span>
          <span className="rounded-full bg-muted px-2 py-px text-[11px] font-bold text-muted-foreground tabular-nums">
            {recents.length}
          </span>
          <span className="flex-1" />
          {recents.length > 0 && (
            <button
              type="button"
              onClick={onClearRecents}
              className="rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              {t('startPage.clearAll')}
            </button>
          )}
        </div>

        {/* 列表 / 空状态 —— 仅此区域滚动,底部留白随内容一起滚 */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-15">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2.5 px-5 py-12 text-center text-muted-foreground">
            <div className="flex size-[52px] items-center justify-center rounded-[14px] bg-muted text-muted-foreground/70">
              <span className="size-[26px]">{SearchIcon}</span>
            </div>
            {isSearchEmpty ? (
              <>
                <div className="text-sm font-semibold text-foreground">{t('startPage.searchEmptyTitle')}</div>
                <div className="text-[12.5px]">
                  {t('startPage.searchEmptyBefore')}
                  <b className="font-semibold text-foreground">“{query.trim()}”</b>
                  {t('startPage.searchEmptyAfter')}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-foreground">{t('startPage.emptyTitle')}</div>
                <div className="text-[12.5px]">{t('startPage.emptyDesc')}</div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visible.map((it) => (
              <div
                key={it.path}
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecent(it.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenRecent(it.path)
                  }
                }}
                className="group relative flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2.5 hover:bg-muted"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary">
                  <span className="size-[18px]">{FileIcon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{highlight(it.name, query)}</div>
                  <div className="mt-px truncate text-xs text-muted-foreground">{highlight(it.path, query)}</div>
                </div>
                {/* 默认显示时间;悬停时同位切换为删除按钮(无抖动) */}
                <div className="relative h-[30px] w-[88px] shrink-0">
                  <span className="absolute inset-0 flex items-center justify-end pr-1 text-xs text-muted-foreground/70 tabular-nums transition-opacity group-hover:opacity-0">
                    {formatRelativeTime(it.openedAt, language)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('startPage.removeRecent')}
                    title={t('startPage.removeRecent')}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveRecent(it.path)
                    }}
                    className="absolute top-1/2 right-0 flex size-[30px] -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <span className="size-4">{TrashIcon}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
