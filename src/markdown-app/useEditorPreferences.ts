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
import type { SplitOrientation } from './SplitView'

/**
 * 编辑相关偏好:
 * - 「分栏方向」——分栏模式下编辑区在左(source-left)还是预览在左(preview-left)。
 * - 「在新窗口打开」——打开文件时默认在新窗口打开(而非当前窗口新建标签);默认关闭。
 */
export interface EditorPreferences {
  splitOrientation: SplitOrientation
  openInNewWindow: boolean
}

/** 默认左编辑、右预览;默认不在新窗口打开。 */
const EDITOR_PREFERENCE_DEFAULTS: EditorPreferences = {
  splitOrientation: 'source-left',
  openInNewWindow: false,
}

const STORAGE_KEY = 'markknife.editor-preferences'

interface EditorPreferencesContextValue {
  preferences: EditorPreferences
  setSplitOrientation: (orientation: SplitOrientation) => void
  setOpenInNewWindow: (value: boolean) => void
}

function sanitize(raw: unknown): EditorPreferences {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    splitOrientation: source.splitOrientation === 'preview-left' ? 'preview-left' : 'source-left',
    openInNewWindow: source.openInNewWindow === true,
  }
}

function readStored(): EditorPreferences {
  if (typeof window === 'undefined') return EDITOR_PREFERENCE_DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : EDITOR_PREFERENCE_DEFAULTS
  } catch {
    return EDITOR_PREFERENCE_DEFAULTS
  }
}

// 无 Provider 时优雅降级:读默认值、写操作为空。
const FALLBACK_CONTEXT: EditorPreferencesContextValue = {
  preferences: EDITOR_PREFERENCE_DEFAULTS,
  setSplitOrientation: () => {},
  setOpenInNewWindow: () => {},
}

const EditorPreferencesContext = createContext<EditorPreferencesContextValue>(FALLBACK_CONTEXT)

export function EditorPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<EditorPreferences>(readStored)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // 持久化失败(如隐私模式)忽略。
    }
  }, [preferences])

  const setSplitOrientation = useCallback((orientation: SplitOrientation) => {
    setPreferences((prev) =>
      prev.splitOrientation === orientation ? prev : { ...prev, splitOrientation: orientation },
    )
  }, [])

  const setOpenInNewWindow = useCallback((value: boolean) => {
    setPreferences((prev) => (prev.openInNewWindow === value ? prev : { ...prev, openInNewWindow: value }))
  }, [])

  const value = useMemo<EditorPreferencesContextValue>(
    () => ({ preferences, setSplitOrientation, setOpenInNewWindow }),
    [preferences, setSplitOrientation, setOpenInNewWindow],
  )

  return createElement(EditorPreferencesContext.Provider, { value }, children)
}

export function useEditorPreferences(): EditorPreferencesContextValue {
  return useContext(EditorPreferencesContext)
}
