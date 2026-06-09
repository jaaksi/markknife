import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { ActionTooltip } from '../components/ui/action-tooltip'
import { TooltipProvider } from '../components/ui/tooltip'
import { isMac } from '../utils/platform'
import { TabBar, type TabItem, type TabContextActions } from './TabBar'
import { EyeIcon, FolderIcon, GearIcon, PencilIcon, SplitIcon } from './toolbarIcons'
import { useLanguage } from './useLanguage'
import type { MessageKey } from './i18nMessages'

/** 应用的三种模式:查看(只读)、所见即所得、分栏(左编辑右预览)。 */
export type AppMode = 'view' | 'wysiwyg' | 'split'

interface ToolbarProps {
  tabs: TabItem[]
  activePath: string | null
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  onOpen: () => void
  onActivateTab: (path: string) => void
  onCloseTab: (path: string) => void
  onNewTab: () => void
  tabActions: TabContextActions
  onOpenSettings: () => void
}

type IconComponent = typeof EyeIcon

/** 模式按钮配置:图标 + 悬停提示文案翻译键(与设计稿一致)。 */
const MODES: ReadonlyArray<{ value: AppMode; labelKey: MessageKey; Icon: IconComponent }> = [
  { value: 'view', labelKey: 'mode.view', Icon: EyeIcon },
  { value: 'wysiwyg', labelKey: 'mode.wysiwyg', Icon: PencilIcon },
  { value: 'split', labelKey: 'mode.split', Icon: SplitIcon },
]

// 模式按钮激活态:白底 + 品牌色 + 轻阴影(对齐设计稿的分段高亮)。
const ACTIVE_MODE_CLASS = 'bg-background text-primary shadow-sm hover:bg-background hover:text-primary'

/** 工具栏纯图标按钮:幽灵态 + 悬停延迟弹出文字提示;提示朝下,因工具栏贴顶。 */
function ToolbarIconButton({
  label,
  onClick,
  className,
  ariaPressed,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  ariaPressed?: boolean
  children: ReactNode
}) {
  return (
    <ActionTooltip copy={{ label }} side="bottom">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        aria-pressed={ariaPressed}
        className={className}
        onClick={onClick}
      >
        {children}
      </Button>
    </ActionTooltip>
  )
}

export function Toolbar({
  tabs,
  activePath,
  mode,
  onModeChange,
  onOpen,
  onActivateTab,
  onCloseTab,
  onNewTab,
  tabActions,
  onOpenSettings,
}: ToolbarProps) {
  const { t } = useLanguage()
  const hasTabs = tabs.length > 0
  return (
    <TooltipProvider delayDuration={700}>
      <div
        className={`flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background pr-[14px] ${isMac() ? 'pl-[84px]' : 'pl-[14px]'}`}
        data-testid="markdown-toolbar"
      >
        <ToolbarIconButton label={t('toolbar.open')} onClick={onOpen}>
          <FolderIcon className="size-[17px]" />
        </ToolbarIconButton>

        {hasTabs && (
          <TabBar
            tabs={tabs}
            activePath={activePath}
            onActivate={onActivateTab}
            onClose={onCloseTab}
            onNew={onNewTab}
            actions={tabActions}
          />
        )}

        {/* 中间可拖拽空白(自定义窗口拖动)+ 标签栏与模式组的安全间距 */}
        <div data-tauri-drag-region className="h-full flex-1" />

        {hasTabs && (
          <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5" role="group" aria-label={t('toolbar.modeGroup')}>
            {MODES.map(({ value, labelKey, Icon }) => (
              <ToolbarIconButton
                key={value}
                label={t(labelKey)}
                ariaPressed={mode === value}
                className={mode === value ? ACTIVE_MODE_CLASS : 'text-muted-foreground'}
                onClick={() => onModeChange(value)}
              >
                <Icon />
              </ToolbarIconButton>
            ))}
          </div>
        )}

        <ToolbarIconButton label={t('toolbar.settings')} onClick={onOpenSettings}>
          <GearIcon className="size-[17px]" />
        </ToolbarIconButton>
      </div>
    </TooltipProvider>
  )
}
