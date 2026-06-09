import { Button } from '../components/ui/button'
import { ActionTooltip } from '../components/ui/action-tooltip'
import { CloseIcon, PlusIcon } from './toolbarIcons'
import { useLanguage } from './useLanguage'

/** 标签栏中的单个标签数据。 */
export interface TabItem {
  path: string
  name: string
  dirty: boolean
}

interface TabBarProps {
  tabs: TabItem[]
  activePath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onNew: () => void
}

// 两侧淡出遮罩,提示标签可横向滚动。
const FADE_MASK = 'linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 16px), transparent)'

/**
 * 工具栏中间的标签栏(方案 B:底部下划线式)。
 * - 标签可横向滚动;与右侧模式组之间由外层拖拽空白留安全间距。
 * - 每个标签右侧固定 16px 槽位容纳「未保存圆点 / 关闭 ✕」,用 opacity 切换、宽度恒定,
 *   避免 hover 出现 ✕ 时把标签撑宽产生抖动。
 */
export function TabBar({ tabs, activePath, onActivate, onClose, onNew }: TabBarProps) {
  const { t } = useLanguage()
  return (
    <div
      role="tablist"
      aria-label={t('toolbar.modeGroup')}
      data-testid="markdown-tabbar"
      className="flex min-w-0 flex-[0_1_auto] items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
    >
      {tabs.map((tab) => {
        const active = tab.path === activePath
        return (
          <div
            key={tab.path}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            data-testid={`tab-${tab.name}`}
            onClick={() => onActivate(tab.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate(tab.path)
              }
            }}
            className={`group flex h-[52px] max-w-[200px] shrink-0 cursor-pointer select-none items-center gap-1.5 border-b-2 pl-3 pr-2 text-[13px] transition-colors ${
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="truncate">{tab.name}</span>
            {/* 固定槽位:圆点与 ✕ 绝对重叠、宽度恒定 */}
            <span className="relative size-4 shrink-0">
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 m-auto size-[7px] rounded-full bg-muted-foreground/55 transition-opacity ${
                  tab.dirty && !active ? 'opacity-100 group-hover:opacity-0' : 'opacity-0'
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('tab.close')}
                data-testid={`tab-close-${tab.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.path)
                }}
                className={`absolute inset-0 size-4 min-w-0 rounded-[5px] opacity-0 transition-opacity [&_svg]:size-[11px] ${
                  active ? 'opacity-100' : 'group-hover:opacity-100'
                }`}
              >
                <CloseIcon />
              </Button>
            </span>
          </div>
        )
      })}
      <ActionTooltip copy={{ label: t('tab.new') }} side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('tab.new')}
          onClick={onNew}
          className="ml-1 shrink-0 self-center"
        >
          <PlusIcon className="size-[14px]" />
        </Button>
      </ActionTooltip>
    </div>
  )
}
