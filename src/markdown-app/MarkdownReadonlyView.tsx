import { SingleEditorView } from '../components/SingleEditorView'
import { useMarkdownBlockNoteEditor } from './useMarkdownBlockNoteEditor'
import { useReadonlyMarkdownBlocks } from './useReadonlyMarkdownBlocks'
import { RichEditorSurface } from './RichEditorSurface'

/** 只读富文本渲染：用于「查看模式」与「分栏预览」。 */
export function MarkdownReadonlyView({
  markdown,
  filePath,
  vaultPath,
}: {
  markdown: string
  filePath: string
  vaultPath?: string
}) {
  const editor = useMarkdownBlockNoteEditor(vaultPath)
  useReadonlyMarkdownBlocks({ editor, markdown, targetPath: filePath, vaultPath })

  return (
    <RichEditorSurface>
      <SingleEditorView editor={editor} vaultPath={vaultPath} editable={false} />
    </RichEditorSurface>
  )
}
