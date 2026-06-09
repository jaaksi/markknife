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

/** 目录面板位置:内容左侧或右侧。 */
export type TocPosition = 'left' | 'right'

/** 目录面板偏好:打开文件时是否默认展示、以及显示在哪一侧。 */
export interface TocPreferences {
  defaultVisible: boolean
  position: TocPosition
}

const TOC_PREFERENCE_DEFAULTS: TocPreferences = {
  defaultVisible: true,
  position: 'left',
}

const STORAGE_KEY = 'markknife.toc-preferences'

interface TocPreferencesContextValue {
  preferences: TocPreferences
  setDefaultVisible: (visible: boolean) => void
  setPosition: (position: TocPosition) => void
}

function sanitize(raw: unknown): TocPreferences {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    defaultVisible:
      typeof source.defaultVisible === 'boolean' ? source.defaultVisible : TOC_PREFERENCE_DEFAULTS.defaultVisible,
    position: source.position === 'right' ? 'right' : 'left',
  }
}

function readStored(): TocPreferences {
  if (typeof window === 'undefined') return TOC_PREFERENCE_DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : TOC_PREFERENCE_DEFAULTS
  } catch {
    return TOC_PREFERENCE_DEFAULTS
  }
}

// 无 Provider 时优雅降级:读默认值、写操作为空。
const FALLBACK_CONTEXT: TocPreferencesContextValue = {
  preferences: TOC_PREFERENCE_DEFAULTS,
  setDefaultVisible: () => {},
  setPosition: () => {},
}

const TocPreferencesContext = createContext<TocPreferencesContextValue>(FALLBACK_CONTEXT)

export function TocPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<TocPreferences>(readStored)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // 持久化失败(如隐私模式)忽略。
    }
  }, [preferences])

  const setDefaultVisible = useCallback((visible: boolean) => {
    setPreferences((prev) => (prev.defaultVisible === visible ? prev : { ...prev, defaultVisible: visible }))
  }, [])

  const setPosition = useCallback((position: TocPosition) => {
    setPreferences((prev) => (prev.position === position ? prev : { ...prev, position }))
  }, [])

  const value = useMemo<TocPreferencesContextValue>(
    () => ({ preferences, setDefaultVisible, setPosition }),
    [preferences, setDefaultVisible, setPosition],
  )

  return createElement(TocPreferencesContext.Provider, { value }, children)
}

export function useTocPreferences(): TocPreferencesContextValue {
  return useContext(TocPreferencesContext)
}
