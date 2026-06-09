import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { useCodeMirror } from '../hooks/useCodeMirror'
import { MarkdownFormatToolbar } from './MarkdownFormatToolbar'

/**
 * 精简版源码编辑器：直接复用 useCodeMirror（Markdown + YAML 高亮、Mod-S 保存），
 * 不含 wikilink 自动补全 / 笔记搜索。用于分栏模式的源码侧,顶部带 Markdown 编辑功能栏。
 * editorViewRef:把内部 EditorView 暴露给外部(分栏滚动联动按行定位用)。
 */
export function MarkdownSourceEditor({
  markdown,
  onChange,
  onSave,
  editorViewRef,
}: {
  markdown: string
  onChange: (content: string) => void
  onSave: () => void
  editorViewRef?: MutableRefObject<EditorView | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleDocChange = useCallback((doc: string) => onChange(doc), [onChange])

  const viewRef = useCodeMirror(containerRef, markdown, {
    onDocChange: handleDocChange,
    onCursorActivity: () => {},
    onSave,
    onEscape: () => false,
  })

  // useCodeMirror 在其 effect 里异步创建 EditorView(先于本 effect 执行),挂载后同步给外部 ref。
  useEffect(() => {
    if (!editorViewRef) return
    editorViewRef.current = viewRef.current
    return () => {
      editorViewRef.current = null
    }
  }, [editorViewRef, viewRef])

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
