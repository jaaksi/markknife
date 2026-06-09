import appCommandManifest from '../shared/appCommandManifest.json' with { type: 'json' }
import type { SidebarFilter } from '../types'
import { isMac } from '../utils/platform'
import type { ViewMode } from './useViewMode'

type AppCommandKey = keyof typeof appCommandManifest.commands

type AppCommandShortcutCombo =
  | 'command-or-ctrl'
  | 'command-or-ctrl-shift'
  | 'command-shift'
type AppCommandDeterministicQaMode =
  | 'renderer-shortcut-event'
  | 'native-menu-command'

type SimpleHandlerKey =
  | 'onOpenSettings'
  | 'onCheckForUpdates'
  | 'onCreateNote'
  | 'onCreateType'
  | 'onQuickOpen'
  | 'onSave'
  | 'onFindInNote'
  | 'onUndo'
  | 'onRedo'
  | 'onReplaceInNote'
  | 'onPastePlainText'
  | 'onSearch'
  | 'onToggleRawEditor'
  | 'onToggleDiff'
  | 'onToggleInspector'
  | 'onToggleTableOfContents'
  | 'onExportNoteAsPdf'
  | 'onCommandPalette'
  | 'onZoomIn'
  | 'onZoomOut'
  | 'onZoomReset'
  | 'onGoBack'
  | 'onGoForward'
  | 'onOpenVault'
  | 'onRemoveActiveVault'
  | 'onRestoreGettingStarted'
  | 'onAddRemote'
  | 'onCommitPush'
  | 'onPull'
  | 'onResolveConflicts'
  | 'onViewChanges'
  | 'onInstallMcp'
  | 'onReloadVault'
  | 'onRepairVault'
  | 'onOpenInNewWindow'
  | 'onRestoreDeletedNote'

type ActiveTabHandlerKey =
  | 'onToggleOrganized'
  | 'onToggleFavorite'
  | 'onArchiveNote'
  | 'onDeleteNote'

type AppCommandRoute =
  | { kind: 'view-mode'; value: ViewMode }
  | { kind: 'filter'; value: SidebarFilter }
  | { kind: 'handler'; handler: SimpleHandlerKey }
  | { kind: 'active-tab-handler'; handler: ActiveTabHandlerKey }

interface AppCommandShortcutDefinition {
  combo: AppCommandShortcutCombo
  key: string
  aliases?: string[]
  code?: string
  display: string
}

interface AppCommandManifestShortcutDefinition extends AppCommandShortcutDefinition {
  accelerator: string
  requiresManualNativeAcceleratorQa?: boolean
}

interface AppCommandManifestDefinition {
  id: string
  route: AppCommandRoute
  menuOwned: boolean
  shortcut?: AppCommandManifestShortcutDefinition
  preferredShortcutQaMode?: AppCommandDeterministicQaMode
}

type PlatformLabel = string | {
  macos?: string
  windows?: string
  linux?: string
  default: string
}

type AppCommandMenuManifestItem =
  | { kind: 'separator' }
  | {
      kind: 'command'
      command: AppCommandKey
      id?: string
      label: PlatformLabel
      accelerator?: string | null
      enabled?: boolean
    }
  | {
      kind: 'menu-event'
      id: string
      label: PlatformLabel
      accelerator?: string | null
      enabled?: boolean
    }

interface AppCommandMenuManifestSection {
  label: string
  items: AppCommandMenuManifestItem[]
}

export type AppCommandMenuItem =
  | { kind: 'separator' }
  | {
      kind: 'command'
      commandId: string
      menuItemId: string
      label: string
      shortcut?: string
      enabled?: boolean
    }

const APP_COMMAND_MANIFEST_COMMANDS = appCommandManifest.commands as Record<AppCommandKey, AppCommandManifestDefinition>
const APP_COMMAND_MANIFEST_MENUS = appCommandManifest.menus as AppCommandMenuManifestSection[]

function resolvePlatformLabel(label: PlatformLabel): string {
  if (typeof label === 'string') return label
  if (isMac() && label.macos) return label.macos
  return label.default
}

function formatAcceleratorDisplay(accelerator: string): string {
  const commandPrefix = isMac() ? '⌘' : 'Ctrl+'
  const commandShiftPrefix = isMac() ? '⌘⇧' : 'Ctrl+Shift+'

  return accelerator
    .replaceAll('CmdOrCtrl+Shift+', commandShiftPrefix)
    .replaceAll('CmdOrCtrl+', commandPrefix)
    .replaceAll('Backspace', isMac() ? '⌫' : 'Backspace')
    .replaceAll('Delete', isMac() ? '⌦' : 'Delete')
    .replaceAll('Left', isMac() ? '←' : 'Left')
    .replaceAll('Right', isMac() ? '→' : 'Right')
    .replaceAll('Enter', isMac() ? '↵' : 'Enter')
}

function menuShortcutForCommand(
  item: Extract<AppCommandMenuManifestItem, { kind: 'command' }>,
  command: AppCommandManifestDefinition,
): string | undefined {
  if (typeof item.accelerator === 'string') return formatAcceleratorDisplay(item.accelerator)
  if (command.shortcut) return formatShortcutDisplay(command.shortcut)
  return undefined
}

function toMenuItem(item: AppCommandMenuManifestItem): AppCommandMenuItem {
  if (item.kind === 'separator') return { kind: 'separator' }

  if (item.kind === 'menu-event') {
    return {
      kind: 'command',
      commandId: item.id,
      menuItemId: item.id,
      label: resolvePlatformLabel(item.label),
      shortcut: typeof item.accelerator === 'string'
        ? formatAcceleratorDisplay(item.accelerator)
        : undefined,
      enabled: item.enabled,
    }
  }

  const command = Reflect.get(APP_COMMAND_MANIFEST_COMMANDS, item.command) as AppCommandManifestDefinition
  return {
    kind: 'command',
    commandId: command.id,
    menuItemId: item.id ?? command.id,
    label: resolvePlatformLabel(item.label),
    shortcut: menuShortcutForCommand(item, command),
    enabled: item.enabled,
  }
}

export const APP_COMMAND_MENU_SECTIONS = APP_COMMAND_MANIFEST_MENUS.map(section => ({
  label: section.label,
  items: section.items.map(toMenuItem),
}))

function formatShortcutDisplay(
  shortcut: Pick<AppCommandShortcutDefinition, 'display'>,
): string {
  if (isMac()) return shortcut.display

  return shortcut.display
    .replaceAll('⌘⇧', 'Ctrl+Shift+')
    .replaceAll('⌘', 'Ctrl+')
    .replaceAll('⌫', 'Backspace')
    .replaceAll('⌦', 'Delete')
    .replaceAll('←', 'Left')
    .replaceAll('→', 'Right')
    .replaceAll('↵', 'Enter')
}
