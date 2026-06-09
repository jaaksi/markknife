import { ArrowSquareOut, Copy, FolderOpen, PencilSimple, XCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '../components/ui/button'
import { ActionTooltip } from '../components/ui/action-tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { isMac } from '../utils/platform'
import { CloseIcon, PlusIcon } from './toolbarIcons'
import { useLanguage } from './useLanguage'
import { comboToCaps, useShortcuts } from './useShortcuts'

/** 标签栏中的单个标签数据。 */
export interface TabItem {
  path: string
  name: string
  dirty: boolean
}

/** 标签右键菜单的动作集合（由 App 实现并经 Toolbar 透传）。 */
export interface TabContextActions {
  onOpenInNewWindow: (path: string) => void
  onRevealInFinder: (path: string) => void
  onCopyPath: (path: string) => void
  onRename: (path: string) => void
  onCloseOthers: (path: string) => void
}

interface TabBarProps {
  tabs: TabItem[]
  activePath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onNew: () => void
  actions: TabContextActions
}

// 两侧淡出遮罩,提示标签可横向滚动。
const FADE_MASK = 'linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 16px), transparent)'

/**
 * 工具栏中间的标签栏(方案 B:底部下划线式)。
 * - 标签可横向滚动;与右侧模式组之间由外层拖拽空白留安全间距。
 * - 每个标签右键弹出菜单:在新窗口打开 / 在访达中显示 / 复制文件路径 / 重命名 / 关闭其他。
 *   注意:这里用「受控 DropdownMenu + 自定义 onContextMenu」而非 Radix ContextMenu——因为
 *   main.tsx 在 Tauri 下全局 capture 阶段对 contextmenu preventDefault(压制原生右键菜单),
 *   会让 Radix ContextMenu 的 defaultPrevented 检查短路、菜单打不开。
 * - 每个标签右侧固定 16px 槽位容纳「未保存圆点 / 关闭 ✕」,用 opacity 切换、宽度恒定,
 *   避免 hover 出现 ✕ 时把标签撑宽产生抖动。
 */
export function TabBar({ tabs, activePath, onActivate, onClose, onNew, actions }: TabBarProps) {
  const { t } = useLanguage()
  const { shortcuts } = useShortcuts()
  const multiple = tabs.length > 1
  // 「在新窗口打开」的快捷键按键帽(随平台与用户自定义实时变化),如 ⌘⇧O。
  const openInNewWindowCaps = comboToCaps(shortcuts.openInNewWindow, isMac()).join('')
  // 同一时刻只有一个右键菜单:记录目标标签与光标视口坐标。
  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null)

  return (
    <>
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
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({ path: tab.path, x: event.clientX, y: event.clientY })
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

      {/* 标签右键菜单:受控 DropdownMenu,锚定到光标处的隐形触发点(见上方组件注释)。 */}
      <DropdownMenu open={menu !== null} onOpenChange={(open) => { if (!open) setMenu(null) }}>
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed h-0 w-0"
            style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          {menu && (
            <>
              <DropdownMenuItem disabled={!multiple} onSelect={() => actions.onOpenInNewWindow(menu.path)}>
                <ArrowSquareOut aria-hidden="true" />
                {t('tab.menu.openInNewWindow')}
                <DropdownMenuShortcut>{openInNewWindowCaps}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onRevealInFinder(menu.path)}>
                <FolderOpen aria-hidden="true" />
                {t('tab.menu.reveal')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onCopyPath(menu.path)}>
                <Copy aria-hidden="true" />
                {t('tab.menu.copyPath')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onRename(menu.path)}>
                <PencilSimple aria-hidden="true" />
                {t('tab.menu.rename')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!multiple} onSelect={() => actions.onCloseOthers(menu.path)}>
                <XCircle aria-hidden="true" />
                {t('tab.menu.closeOthers')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
