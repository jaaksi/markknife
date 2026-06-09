import { useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { MarkdownSourceEditor } from './MarkdownSourceEditor'
import { MarkdownReadonlyView } from './MarkdownReadonlyView'
import { useSplitScrollSync } from './useSplitScrollSync'

export type SplitOrientation = 'source-left' | 'preview-left'

/**
 * 分栏模式：左源码 / 右预览，可通过 orientation 左右互换。
 * 源码与预览都读取同一个 markdown（唯一真相源），源码编辑实时刷新预览。
 * 两侧滚动按「源码块↔预览块」行级映射双向联动(见 useSplitScrollSync)。
 */
export function SplitView({
  markdown,
  filePath,
  vaultPath,
  orientation,
  onChange,
  onSave,
}: {
  markdown: string
  filePath: string
  vaultPath?: string
  orientation: SplitOrientation
  onChange: (content: string) => void
  onSave: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)

  useSplitScrollSync({ rootRef, cmViewRef, markdown })

  const source = (
    <div key="source" className="flex flex-1 min-w-0 min-h-0 flex-col">
      <MarkdownSourceEditor markdown={markdown} onChange={onChange} onSave={onSave} editorViewRef={cmViewRef} />
    </div>
  )
  const preview = (
    <div key="preview" className="flex flex-1 min-w-0 min-h-0 flex-col">
      <MarkdownReadonlyView markdown={markdown} filePath={filePath} vaultPath={vaultPath} />
    </div>
  )
  const [left, right] = orientation === 'source-left' ? [source, preview] : [preview, source]

  return (
    <div ref={rootRef} className="flex flex-1 min-h-0 min-w-0">
      {left}
      <div className="w-px shrink-0 bg-border" aria-hidden="true" />
      {right}
    </div>
  )
}
