import { useMemo } from 'react'
import { SingleEditorView } from '../components/SingleEditorView'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useMarkdownBlockNoteEditor } from './useMarkdownBlockNoteEditor'
import { createSyntheticEntry } from './syntheticEntry'
import { RichEditorSurface } from './RichEditorSurface'

/**
 * 可编辑富文本（所见即所得）。把当前所有打开的标签喂给 useEditorTabSwap：
 * 引擎按 path 缓存每个标签的 blocks/光标/滚动，切标签时秒切并保留状态；
 * 编辑时序列化回 Markdown，通过 onChange(path, content) 回写到对应标签。
 *
 * 注意：本组件实例需跨标签存活（不要按 activePath 重挂载），否则引擎缓存会被清空，
 * 切标签退化成重新解析。挂载控制见 App.tsx 的 MarkdownWorkspace（wysiwyg 分支用固定 key）。
 */
export function MarkdownEditableView({
  tabs,
  activePath,
  vaultPath,
  onChange,
}: {
  tabs: ReadonlyArray<{ path: string; content: string }>
  activePath: string
  vaultPath?: string
  onChange: (path: string, content: string) => void
}) {
  const editor = useMarkdownBlockNoteEditor(vaultPath)
  const swapTabs = useMemo(
    () => tabs.map((tab) => ({ entry: createSyntheticEntry(tab.path), content: tab.content })),
    [tabs],
  )

  const { handleEditorChange } = useEditorTabSwap({
    tabs: swapTabs,
    activeTabPath: activePath,
    editor,
    onContentChange: onChange,
    rawMode: false,
    vaultPath,
  })

  return (
    <RichEditorSurface>
      <SingleEditorView editor={editor} onChange={handleEditorChange} vaultPath={vaultPath} editable />
    </RichEditorSurface>
  )
}
