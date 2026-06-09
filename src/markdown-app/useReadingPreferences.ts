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

/** 内容宽度模式：'limited' 限制到最大宽度（超宽屏居中留白）；'full' 跟随窗口铺满。 */
export type ContentWidthMode = 'limited' | 'full'

/** 阅读体验偏好：内容最大宽度（px）+ 宽度模式。字号 / 行高沿用 theme.json，不再单独可调。 */
export interface ReadingPreferences {
  maxWidth: number
  widthMode: ContentWidthMode
}

/** 数值类偏好的可调范围与步进，既驱动滑块也用于清洗持久化的脏数据。 */
export const READING_PREFERENCE_RANGES = {
  maxWidth: { min: 600, max: 1600, step: 20 },
} as const

/** 可被滑块调节的数值偏好键。 */
export type NumericPreferenceKey = keyof typeof READING_PREFERENCE_RANGES

/** 默认值：宽度 1000px 解决「太窄」，默认限制宽度（超宽屏留白)。 */
const READING_PREFERENCE_DEFAULTS: ReadingPreferences = {
  maxWidth: 1000,
  widthMode: 'limited',
}

const STORAGE_KEY = 'markknife.reading-preferences'

interface ReadingPreferencesContextValue {
  preferences: ReadingPreferences
  setPreference: (key: NumericPreferenceKey, value: number) => void
  setWidthMode: (mode: ContentWidthMode) => void
  reset: () => void
}

function clampToRange(value: number, key: NumericPreferenceKey): number {
  const { min, max } = READING_PREFERENCE_RANGES[key]
  return Math.min(max, Math.max(min, value))
}

function sanitizeValue(raw: unknown, key: NumericPreferenceKey): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return READING_PREFERENCE_DEFAULTS[key]
  return clampToRange(raw, key)
}

function sanitizePreferences(raw: unknown): ReadingPreferences {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    maxWidth: sanitizeValue(source.maxWidth, 'maxWidth'),
    widthMode: source.widthMode === 'full' ? 'full' : 'limited',
  }
}

function readStoredPreferences(): ReadingPreferences {
  if (typeof window === 'undefined') return READING_PREFERENCE_DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizePreferences(JSON.parse(raw)) : READING_PREFERENCE_DEFAULTS
  } catch {
    return READING_PREFERENCE_DEFAULTS
  }
}

// 无 Provider 时优雅降级：读到默认值、写操作为空，保证任意组件都能渲染。
const FALLBACK_CONTEXT: ReadingPreferencesContextValue = {
  preferences: READING_PREFERENCE_DEFAULTS,
  setPreference: () => {},
  setWidthMode: () => {},
  reset: () => {},
}

const ReadingPreferencesContext = createContext<ReadingPreferencesContextValue>(FALLBACK_CONTEXT)

export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ReadingPreferences>(readStoredPreferences)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // 持久化失败（如隐私模式）不影响使用，忽略。
    }
  }, [preferences])

  const setPreference = useCallback((key: NumericPreferenceKey, value: number) => {
    setPreferences((prev) => {
      const next = clampToRange(value, key)
      return prev[key] === next ? prev : { ...prev, [key]: next }
    })
  }, [])

  const setWidthMode = useCallback((mode: ContentWidthMode) => {
    setPreferences((prev) => (prev.widthMode === mode ? prev : { ...prev, widthMode: mode }))
  }, [])

  const reset = useCallback(() => setPreferences(READING_PREFERENCE_DEFAULTS), [])

  const contextValue = useMemo<ReadingPreferencesContextValue>(
    () => ({ preferences, setPreference, setWidthMode, reset }),
    [preferences, setPreference, setWidthMode, reset],
  )

  return createElement(ReadingPreferencesContext.Provider, { value: contextValue }, children)
}

export function useReadingPreferences(): ReadingPreferencesContextValue {
  return useContext(ReadingPreferencesContext)
}
