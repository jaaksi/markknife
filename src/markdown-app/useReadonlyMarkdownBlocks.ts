import { useEffect, useRef } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import { resolveBlocksForTarget, type CachedTabState } from '../hooks/editorBlockResolution'
import { applyBlocksToEditor } from '../hooks/editorContentSwapApply'

/** 预览防抖：源码编辑时让右侧只读预览跟手但不过度重渲染。 */
const PREVIEW_DEBOUNCE_MS = 150

/**
 * 把 Markdown 文本解析为 BlockNote blocks 并应用到只读编辑器实例。
 * 复用 resolveBlocksForTarget（含 Math/Mermaid/durable 块解码）与 applyBlocksToEditor。
 * 用于「查看模式」和「分栏预览」。
 */
export function useReadonlyMarkdownBlocks({
  editor,
  markdown,
  targetPath,
  vaultPath,
}: {
  editor: ReturnType<typeof useCreateBlockNote>
  markdown: string
  targetPath: string
  vaultPath?: string
}) {
  const cacheRef = useRef<Map<string, CachedTabState>>(new Map())
  const suppressChangeRef = useRef(false)
  const editorContentPathRef = useRef<string | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const path = targetPath || 'preview'

    const applyPreview = async () => {
      try {
        const { blocks, scrollTop } = await resolveBlocksForTarget({
          editor,
          cache: cacheRef.current,
          targetPath: path,
          content: markdown,
          vaultPath,
        })
        if (cancelled || !mountedRef.current) return
        applyBlocksToEditor({
          editor,
          blocks,
          scrollTop,
          suppressChangeRef,
          editorContentPathRef,
          targetPath: path,
        })
      } catch (error) {
        console.error('[markdown-app] Markdown 预览渲染失败:', error)
      }
    }

    const handle = setTimeout(applyPreview, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [editor, markdown, targetPath, vaultPath])
}
