import type React from 'react'
import { type ReactNode, useMemo } from 'react'
import { useEditorTheme } from '../hooks/useTheme'
import { useReadingPreferences } from './useReadingPreferences'
import { useReadingStyle } from './useReadingStyle'

/**
 * 富文本表面的公共外层：复用原编辑器的 .editor-scroll-area / .editor-content-wrapper
 * 布局与主题 CSS 变量，保证查看 / 所见即所得 / 分栏预览三者视觉一致。
 * 用户的阅读偏好（内容最大宽度）在此覆盖 theme.json 的同名变量。
 */
export function RichEditorSurface({ children }: { children: ReactNode }) {
  const { cssVars } = useEditorTheme()
  const { preferences } = useReadingPreferences()
  const { style } = useReadingStyle()

  const styleVars = useMemo(
    () =>
      ({
        ...cssVars,
        '--editor-max-width': `${preferences.maxWidth}px`,
        // 阅读样式覆盖放最后,优先级最高(只影响内容区变量)。
        ...style.vars,
      }) as React.CSSProperties,
    [cssVars, preferences, style],
  )

  // 宽度模式:limited = 限制到最大宽度(超宽屏居中留白);full = 跟随窗口铺满(max-width: none)。
  const widthClass = preferences.widthMode === 'full' ? 'editor-content-width--wide' : 'editor-content-width--normal'

  return (
    <div className={`flex flex-1 flex-col min-w-0 min-h-0 ${widthClass}`}>
      <div
        className="editor-scroll-area"
        style={styleVars}
        // 「深色」阅读样式直接复用全局 .dark 主题:容器挂 data-theme="dark" 后,
        // theme.json 里的 var(--text-*) 等引用自动解析为 .dark 配色,与 theme 深色完全一致。
        data-theme={style.id === 'dark' ? 'dark' : undefined}
      >
        <div className="editor-content-wrapper" data-note-pdf-export-root="true">
          {children}
        </div>
      </div>
    </div>
  )
}
