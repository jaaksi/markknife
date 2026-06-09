import { MarkdownSourceEditor } from './MarkdownSourceEditor'
import { MarkdownReadonlyView } from './MarkdownReadonlyView'

export type SplitOrientation = 'source-left' | 'preview-left'

/**
 * 分栏模式：左源码 / 右预览，可通过 orientation 左右互换。
 * 源码与预览都读取同一个 markdown（唯一真相源），源码编辑实时刷新预览。
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
  const source = (
    <div key="source" className="flex flex-1 min-w-0 min-h-0 flex-col">
      <MarkdownSourceEditor markdown={markdown} onChange={onChange} onSave={onSave} />
    </div>
  )
  const preview = (
    <div key="preview" className="flex flex-1 min-w-0 min-h-0 flex-col">
      <MarkdownReadonlyView markdown={markdown} filePath={filePath} vaultPath={vaultPath} />
    </div>
  )
  const [left, right] = orientation === 'source-left' ? [source, preview] : [preview, source]

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {left}
      <div className="w-px shrink-0 bg-border" aria-hidden="true" />
      {right}
    </div>
  )
}
