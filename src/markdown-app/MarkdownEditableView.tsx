import { useMemo } from 'react'
import { SingleEditorView } from '../components/SingleEditorView'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useMarkdownBlockNoteEditor } from './useMarkdownBlockNoteEditor'
import { createSyntheticEntry } from './syntheticEntry'
import { RichEditorSurface } from './RichEditorSurface'

/**
 * 可编辑富文本（所见即所得）。复用 useEditorTabSwap 驱动 Markdown ↔ blocks：
 * 打开时解析为 blocks，编辑时序列化回 Markdown 并通过 onChange 回写到唯一真相源。
 */
export function MarkdownEditableView({
  markdown,
  filePath,
  vaultPath,
  onChange,
}: {
  markdown: string
  filePath: string
  vaultPath?: string
  onChange: (content: string) => void
}) {
  const editor = useMarkdownBlockNoteEditor(vaultPath)
  const entry = useMemo(() => createSyntheticEntry(filePath), [filePath])
  const tabs = useMemo(() => [{ entry, content: markdown }], [entry, markdown])

  const { handleEditorChange } = useEditorTabSwap({
    tabs,
    activeTabPath: filePath,
    editor,
    onContentChange: (_path, content) => onChange(content),
    rawMode: false,
    vaultPath,
  })

  return (
    <RichEditorSurface>
      <SingleEditorView editor={editor} onChange={handleEditorChange} vaultPath={vaultPath} editable />
    </RichEditorSurface>
  )
}
