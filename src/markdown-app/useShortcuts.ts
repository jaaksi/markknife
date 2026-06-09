import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { MessageKey } from './i18nMessages'

/** 可自定义快捷键的动作。 */
export type ShortcutAction = 'toggleToc' | 'modeView' | 'modeWysiwyg' | 'modeSplit' | 'save' | 'open'

/** 动作展示顺序与文案翻译键(用于设置页,渲染时再 t())。 */
export const SHORTCUT_ACTIONS: ReadonlyArray<{ action: ShortcutAction; labelKey: MessageKey; detailKey?: MessageKey }> = [
  { action: 'toggleToc', labelKey: 'shortcut.toggleToc.label', detailKey: 'shortcut.toggleToc.detail' },
  { action: 'modeView', labelKey: 'shortcut.modeView.label' },
  { action: 'modeWysiwyg', labelKey: 'shortcut.modeWysiwyg.label' },
  { action: 'modeSplit', labelKey: 'shortcut.modeSplit.label' },
  { action: 'save', labelKey: 'shortcut.save.label', detailKey: 'shortcut.save.detail' },
  { action: 'open', labelKey: 'shortcut.open.label' },
]

/** 默认绑定。combo 用 `mod`(⌘/Ctrl)+ KeyboardEvent.code,规避 macOS Option 变字符问题。 */
const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  toggleToc: 'mod+Backslash',
  modeView: 'mod+Digit1',
  modeWysiwyg: 'mod+Digit2',
  modeSplit: 'mod+Digit3',
  save: 'mod+KeyS',
  open: 'mod+KeyO',
}

const MODIFIER_CODES = new Set([
  'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
])

/** 把键盘事件转成规范 combo 字符串;只按下修饰键时返回 null。 */
export function eventToCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) return null
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.code)
  return parts.join('+')
}

/** combo 是否包含修饰键(避免把裸键绑成快捷键)。 */
export function isValidShortcut(combo: string): boolean {
  return combo.includes('mod+') || combo.includes('alt+')
}

const SPECIAL_KEY_LABELS: Record<string, string> = {
  Backslash: '\\', Slash: '/', Comma: ',', Period: '.', Space: '空格',
  Enter: '⏎', Backspace: '⌫', Escape: 'Esc', Tab: '⇥',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
}

function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return SPECIAL_KEY_LABELS[code] ?? code
}

/** 把 combo 拆成展示用的按键帽数组(随平台显示 ⌘ / Ctrl)。 */
export function comboToCaps(combo: string, isMacPlatform: boolean): string[] {
  return combo.split('+').map((token) => {
    if (token === 'mod') return isMacPlatform ? '⌘' : 'Ctrl'
    if (token === 'alt') return isMacPlatform ? '⌥' : 'Alt'
    if (token === 'shift') return '⇧'
    return keyLabel(token)
  })
}

const STORAGE_KEY = 'markknife.shortcuts'

function sanitize(raw: unknown): Record<ShortcutAction, string> {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_SHORTCUTS }
  for (const { action } of SHORTCUT_ACTIONS) {
    const v = source[action]
    if (typeof v === 'string' && isValidShortcut(v)) out[action] = v
  }
  return out
}

function readStored(): Record<ShortcutAction, string> {
  if (typeof window === 'undefined') return { ...DEFAULT_SHORTCUTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SHORTCUTS }
  } catch {
    return { ...DEFAULT_SHORTCUTS }
  }
}

interface ShortcutsContextValue {
  shortcuts: Record<ShortcutAction, string>
  /** combo → action 的反查表(供按键分发)。 */
  comboLookup: Record<string, ShortcutAction>
  setBinding: (action: ShortcutAction, combo: string) => void
  reset: () => void
}

const FALLBACK_LOOKUP = Object.fromEntries(
  Object.entries(DEFAULT_SHORTCUTS).map(([a, c]) => [c, a as ShortcutAction]),
) as Record<string, ShortcutAction>

const FALLBACK_CONTEXT: ShortcutsContextValue = {
  shortcuts: DEFAULT_SHORTCUTS,
  comboLookup: FALLBACK_LOOKUP,
  setBinding: () => {},
  reset: () => {},
}

const ShortcutsContext = createContext<ShortcutsContextValue>(FALLBACK_CONTEXT)

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, string>>(readStored)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
    } catch {
      // 持久化失败忽略。
    }
  }, [shortcuts])

  // 设新绑定:若该 combo 已被其它动作占用,先解绑(置回各自默认),避免冲突。
  const setBinding = useCallback((action: ShortcutAction, combo: string) => {
    setShortcuts((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next) as ShortcutAction[]) {
        if (key !== action && next[key] === combo) next[key] = DEFAULT_SHORTCUTS[key]
      }
      next[action] = combo
      return next
    })
  }, [])

  const reset = useCallback(() => setShortcuts({ ...DEFAULT_SHORTCUTS }), [])

  const comboLookup = useMemo(
    () => Object.fromEntries(Object.entries(shortcuts).map(([a, c]) => [c, a as ShortcutAction])) as Record<string, ShortcutAction>,
    [shortcuts],
  )

  const value = useMemo<ShortcutsContextValue>(
    () => ({ shortcuts, comboLookup, setBinding, reset }),
    [shortcuts, comboLookup, setBinding, reset],
  )

  return createElement(ShortcutsContext.Provider, { value }, children)
}

export function useShortcuts(): ShortcutsContextValue {
  return useContext(ShortcutsContext)
}
