import { useEffect, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import 'katex/dist/katex.min.css'
import { uploadImageFile } from '../hooks/useImageDrop'
import { RUNTIME_STYLE_NONCE } from '../lib/runtimeStyleNonce'
import { schema } from '../components/editorSchema'
import { createArrowLigaturesExtension } from '../components/arrowLigaturesExtension'
import { createFileBlockSelectionGuardExtension } from '../components/fileBlockSelectionGuardExtension'
import { createImeCompositionKeyGuardExtension } from '../components/imeCompositionKeyGuardExtension'
import { createMarkdownHighlightInputExtension } from '../components/markdownHighlightInputExtension'
import { createMathInputExtension } from '../components/mathInputExtension'
import { createRichEditorTransformErrorRecoveryExtension } from '../components/richEditorTransformErrorRecoveryExtension'
import { useFilenameAutolinkGuard } from '../components/useFilenameAutolinkGuard'
import '../components/Editor.css'
import '../components/EditorTheme.css'

const RICH_EDITOR_BIDI_DOM_ATTRIBUTES = {
  blockContent: { dir: 'auto' },
  inlineContent: { dir: 'auto' },
}

/**
 * 创建一个 BlockNote 编辑器实例，配置与原 useEditorSetup 保持一致。
 * 查看（只读）与所见即所得（可编辑）共用同一套实例工厂，靠调用方的 editable 切换。
 */
export function useMarkdownBlockNoteEditor(vaultPath?: string) {
  const vaultPathRef = useRef(vaultPath)
  useEffect(() => {
    vaultPathRef.current = vaultPath
  }, [vaultPath])

  const editor = useCreateBlockNote({
    schema,
    domAttributes: RICH_EDITOR_BIDI_DOM_ATTRIBUTES,
    uploadFile: (file: File) => uploadImageFile(file, vaultPathRef.current),
    _tiptapOptions: { injectNonce: RUNTIME_STYLE_NONCE },
    extensions: [
      createRichEditorTransformErrorRecoveryExtension(),
      createFileBlockSelectionGuardExtension(),
      createImeCompositionKeyGuardExtension(),
      createArrowLigaturesExtension(),
      createMarkdownHighlightInputExtension(),
      createMathInputExtension(),
    ],
  })
  useFilenameAutolinkGuard(editor)
  return editor
}
