import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { MessageKey } from './i18nMessages'

/** 一套阅读样式:覆盖编辑器内容区的主题变量(只影响正文,不动工具栏 / 目录)。 */
export interface ReadingStyle {
  id: string
  /** 名称翻译键(设置页渲染时 t())。 */
  labelKey: MessageKey
  /** 注入到内容区的 CSS 变量覆盖。 */
  vars: CSSProperties
  /** 设置页缩略图配色:背景 / 正文 / 标题(强调)。 */
  swatch: { bg: string; fg: string; heading: string; serif?: boolean }
}

/**
 * 每套样式都成体系地覆盖「背景 / 正文 / 标题 / 次要文字 / 链接 / 引用 / 代码块 /
 * 行内代码 / 表格 / 分割线 / 列表标记 / 边框」一整组变量,确保:
 * 1. 切换时整体观感差异明显(不只是背景色);
 * 2. 深色样式自洽——所有文字 / 块背景 / 边框都转深色,杜绝「深底深字」与「残留白块」。
 * 深色取值对齐应用自带的 `.dark` 主题(见 src/index.css)。
 */
export const READING_STYLES: readonly ReadingStyle[] = [
  {
    id: 'default',
    labelKey: 'style.default',
    vars: {},
    swatch: { bg: '#ffffff', fg: '#6b6760', heading: '#34302a' },
  },
  {
    id: 'sepia',
    labelKey: 'style.sepia',
    vars: {
      '--bg-primary': '#f4ecd8',
      '--surface-editor': '#f4ecd8',
      '--card': '#efe5cd',
      '--table-header-background': '#f00',
      '--colors-text': '#5b4636',
      '--colors-cursor': '#5b4636',
      '--headings-h1-color': '#43331f',
      '--headings-h2-color': '#43331f',
      '--headings-h3-color': '#43331f',
      '--headings-h4-color': '#43331f',
      '--text-secondary': '#8a7355',
      '--text-muted': '#a08a6a',
      '--inline-styles-bold-color': '#43331f',
      '--inline-styles-link-color': '#9a5b2f',
      '--blockquote-color': '#6f5a45',
      '--blockquote-border-left-color': '#cbb184',
      '--editor-code-block-background': '#ece0c5',
      '--editor-code-block-text': '#4a3a28',
      '--editor-code-block-language': '#8a7355',
      '--editor-code-block-border': '#ddc9a3',
      '--inline-styles-code-background-color': '#ece0c5',
      '--inline-styles-code-color': '#9a4a2f',
      '--border': '#ddc9a3',
      '--border-primary': '#ddc9a3',
      '--table-border-color': '#d8c8a8',
      '--horizontal-rule-color': '#d8c8a8',
      '--lists-bullet-color': '#b09668',
    } as CSSProperties,
    swatch: { bg: '#f4ecd8', fg: '#8a7355', heading: '#5b4636' },
  },
  {
    id: 'serif',
    labelKey: 'style.serif',
    vars: {
      '--editor-font-family': 'Georgia, "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif',
      '--bg-primary': '#fffdf8',
      '--surface-editor': '#fffdf8',
      '--colors-text': '#2c2a28',
      '--headings-h1-color': '#1f1d1b',
      '--headings-h2-color': '#1f1d1b',
      '--headings-h3-color': '#262320',
      '--headings-h4-color': '#262320',
      '--blockquote-color': '#5c5650',
      '--blockquote-border-left-color': '#d8cfc0',
      '--inline-styles-link-color': '#1a6f63',
      '--horizontal-rule-color': '#e2dbcc',
    } as CSSProperties,
    swatch: { bg: '#fffdf8', fg: '#6b6760', heading: '#2c2a28', serif: true },
  },
  {
    id: 'nord',
    labelKey: 'style.nord',
    vars: {
      '--bg-primary': '#eceff4',
      '--surface-editor': '#eceff4',
      '--card': '#e3e8f0',
      '--table-header-background': '#dde3ec',
      '--colors-text': '#3b4252',
      '--colors-cursor': '#3b4252',
      '--headings-h1-color': '#2e3440',
      '--headings-h2-color': '#2e3440',
      '--headings-h3-color': '#2e3440',
      '--headings-h4-color': '#2e3440',
      '--text-secondary': '#5b6678',
      '--text-muted': '#7b8394',
      '--inline-styles-bold-color': '#2e3440',
      '--inline-styles-link-color': '#5e81ac',
      '--blockquote-color': '#4c566a',
      '--blockquote-border-left-color': '#88c0d0',
      '--editor-code-block-background': '#e0e4ec',
      '--editor-code-block-text': '#2e3440',
      '--editor-code-block-language': '#6c7689',
      '--editor-code-block-border': '#cdd3df',
      '--inline-styles-code-background-color': '#e0e4ec',
      '--inline-styles-code-color': '#bf616a',
      '--border': '#d4dae4',
      '--border-primary': '#d4dae4',
      '--table-border-color': '#c2cad6',
      '--horizontal-rule-color': '#c2cad6',
      '--lists-bullet-color': '#5e81ac',
    } as CSSProperties,
    swatch: { bg: '#eceff4', fg: '#7b8394', heading: '#5e81ac' },
  },
  {
    id: 'rose',
    labelKey: 'style.rose',
    vars: {
      '--bg-primary': '#fff5f6',
      '--surface-editor': '#fff5f6',
      '--card': '#fbe9ec',
      '--table-header-background': '#f6e1e6',
      '--colors-text': '#6b4651',
      '--colors-cursor': '#6b4651',
      '--headings-h1-color': '#8a2f47',
      '--headings-h2-color': '#8a2f47',
      '--headings-h3-color': '#8a2f47',
      '--headings-h4-color': '#8a2f47',
      '--text-secondary': '#9c6b76',
      '--text-muted': '#b08591',
      '--inline-styles-bold-color': '#8a2f47',
      '--inline-styles-link-color': '#c2566f',
      '--blockquote-color': '#8a5f69',
      '--blockquote-border-left-color': '#e59bb0',
      '--editor-code-block-background': '#f6e1e6',
      '--editor-code-block-text': '#6b4651',
      '--editor-code-block-language': '#b08591',
      '--editor-code-block-border': '#f1cdd4',
      '--inline-styles-code-background-color': '#f6e1e6',
      '--inline-styles-code-color': '#b03a5b',
      '--border': '#f3d4db',
      '--border-primary': '#f3d4db',
      '--table-border-color': '#f1cdd4',
      '--horizontal-rule-color': '#f1cdd4',
      '--lists-bullet-color': '#c2566f',
    } as CSSProperties,
    swatch: { bg: '#fff5f6', fg: '#b08591', heading: '#c2566f' },
  },
  {
    id: 'dark',
    labelKey: 'style.dark',
    // 不再手抄深色色值:容器由 RichEditorSurface 挂 data-theme="dark",
    // theme.json 的 var(--text-*) / var(--accent-*) 等引用自动解析为 src/index.css 的
    // .dark 配色,从而与 theme 深色完全一致、永不漂移。
    vars: {},
    swatch: { bg: '#23221f', fg: '#9b988f', heading: '#f3f1ec' },
  },
]

const DEFAULT_STYLE = READING_STYLES[0]
const STORAGE_KEY = 'markknife.reading-style'

function getReadingStyle(id: string): ReadingStyle {
  return READING_STYLES.find((s) => s.id === id) ?? DEFAULT_STYLE
}

interface ReadingStyleContextValue {
  style: ReadingStyle
  setStyleId: (id: string) => void
}

function readStoredId(): string {
  if (typeof window === 'undefined') return DEFAULT_STYLE.id
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_STYLE.id
  } catch {
    return DEFAULT_STYLE.id
  }
}

const FALLBACK_CONTEXT: ReadingStyleContextValue = {
  style: DEFAULT_STYLE,
  setStyleId: () => {},
}

const ReadingStyleContext = createContext<ReadingStyleContextValue>(FALLBACK_CONTEXT)

export function ReadingStyleProvider({ children }: { children: ReactNode }) {
  const [styleId, setStyleIdState] = useState<string>(readStoredId)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, styleId)
    } catch {
      // 持久化失败忽略。
    }
  }, [styleId])

  const setStyleId = useCallback((id: string) => setStyleIdState(id), [])

  const value = useMemo<ReadingStyleContextValue>(
    () => ({ style: getReadingStyle(styleId), setStyleId }),
    [styleId, setStyleId],
  )

  return createElement(ReadingStyleContext.Provider, { value }, children)
}

export function useReadingStyle(): ReadingStyleContextValue {
  return useContext(ReadingStyleContext)
}
