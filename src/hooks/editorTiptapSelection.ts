import { markIntentionalSelectionReset } from '../components/fileBlockSelectionGuardExtension'

type TiptapEditorBridge = {
  state?: {
    doc?: { content?: { size?: unknown } }
  }
  commands?: {
    setTextSelection?: (position: number) => unknown
  }
}

function getTiptapEditorBridge(editor: unknown): TiptapEditorBridge | null {
  const editorWithBridge = editor as { _tiptapEditor?: TiptapEditorBridge }
  return editorWithBridge._tiptapEditor ?? null
}

function getSafeTextSelectionPosition(tiptapEditor: TiptapEditorBridge): number {
  const size = tiptapEditor.state?.doc?.content?.size
  if (typeof size !== 'number' || !Number.isFinite(size)) return 0
  return size > 0 ? Math.min(1, size) : 0
}

export function resetTextSelectionBeforeContentSwap(editor: unknown): void {
  const tiptapEditor = getTiptapEditorBridge(editor)
  const setTextSelection = tiptapEditor?.commands?.setTextSelection
  if (!tiptapEditor || typeof setTextSelection !== 'function') return

  try {
    // 主动重置选区(内容切换前),提前告知文件块选区守卫放行,避免被当作幽灵折叠拦截。
    markIntentionalSelectionReset()
    setTextSelection(getSafeTextSelectionPosition(tiptapEditor))
  } catch (err) {
    console.warn('Failed to reset editor selection before content swap:', err)
  }
}
