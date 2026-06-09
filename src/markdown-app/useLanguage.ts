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
import {
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  setCurrentLanguage,
  translate,
  type Language,
  type MessageKey,
  type TranslationValues,
} from './i18nMessages'

/** 翻译函数:取当前界面语言的文案,支持 {name} 插值。 */
export type Translate = (key: MessageKey, values?: TranslationValues) => string

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Translate
}

// 无 Provider 时优雅降级:用持久化 / 系统推断的语言只读翻译,写操作为空。
const FALLBACK_LANGUAGE = readStoredLanguage()
const FALLBACK_CONTEXT: LanguageContextValue = {
  language: FALLBACK_LANGUAGE,
  setLanguage: () => {},
  t: (key, values) => translate(FALLBACK_LANGUAGE, key, values),
}

const LanguageContext = createContext<LanguageContextValue>(FALLBACK_CONTEXT)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  // 同步模块级当前语言(供纯函数 t 用)、持久化、并设置 <html lang> 以利无障碍。
  useEffect(() => {
    setCurrentLanguage(language)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // 持久化失败忽略。
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = useCallback((next: Language) => setLanguageState(next), [])

  // 响应式翻译:语言变化时身份变化,驱动消费组件重渲染。
  const t = useCallback<Translate>((key, values) => translate(language, key, values), [language])

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  )

  return createElement(LanguageContext.Provider, { value }, children)
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
