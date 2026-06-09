import { useCallback, useRef } from 'react'
import { useCodeMirror } from '../hooks/useCodeMirror'
import { MarkdownFormatToolbar } from './MarkdownFormatToolbar'

/**
 * 精简版源码编辑器：直接复用 useCodeMirror（Markdown + YAML 高亮、Mod-S 保存），
 * 不含 wikilink 自动补全 / 笔记搜索。用于分栏模式的源码侧,顶部带 Markdown 编辑功能栏。
 */
export function MarkdownSourceEditor({
  markdown,
  onChange,
  onSave,
}: {
  markdown: string
  onChange: (content: string) => void
  onSave: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleDocChange = useCallback((doc: string) => onChange(doc), [onChange])

  const viewRef = useCodeMirror(containerRef, markdown, {
    onDocChange: handleDocChange,
    onCursorActivity: () => {},
    onSave,
    onEscape: () => false,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MarkdownFormatToolbar viewRef={viewRef} />
      <div
        ref={containerRef}
        className="raw-editor-codemirror flex min-h-0 flex-1"
        data-testid="markdown-source-editor"
        role="presentation"
      />
    </div>
  )
}
