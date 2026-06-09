import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { ActionTooltip } from '../components/ui/action-tooltip'
import { TooltipProvider } from '../components/ui/tooltip'
import { isMac } from '../utils/platform'
import { basenameOf } from './fileIo'
import { EyeIcon, FolderIcon, GearIcon, PencilIcon, SplitIcon } from './toolbarIcons'
import { useLanguage } from './useLanguage'
import type { MessageKey } from './i18nMessages'

/** 应用的三种模式:查看(只读)、所见即所得、分栏(左编辑右预览)。 */
export type AppMode = 'view' | 'wysiwyg' | 'split'

interface ToolbarProps {
  filePath: string | null
  dirty: boolean
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  onOpen: () => void
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

export function Toolbar({ filePath, dirty, mode, onModeChange, onOpen, onOpenSettings }: ToolbarProps) {
  const { t } = useLanguage()
  return (
    <TooltipProvider delayDuration={700}>
      <div
        className={`flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background pr-[14px] ${isMac() ? 'pl-[84px]' : 'pl-[14px]'}`}
        data-testid="markdown-toolbar"
      >
        <ToolbarIconButton label={t('toolbar.open')} onClick={onOpen}>
          <FolderIcon className="size-[17px]" />
        </ToolbarIconButton>

        {filePath ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <span className="truncate" data-testid="markdown-filename">{basenameOf(filePath)}</span>
            {dirty && (
              <span
                aria-label={t('toolbar.unsaved')}
                title={t('toolbar.unsaved')}
                className="size-[7px] shrink-0 rounded-full bg-muted-foreground/50"
              />
            )}
          </div>
        ) : (
          // 无文件:起始页品牌名(对齐设计稿)
          <span className="text-[13px] font-semibold text-muted-foreground" data-testid="markdown-filename">
            {t('toolbar.startPage')}
          </span>
        )}

        {/* 中间可拖拽空白区域(自定义窗口拖动),不干扰按钮点击 */}
        <div data-tauri-drag-region className="h-full flex-1" />

        {filePath && (
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
