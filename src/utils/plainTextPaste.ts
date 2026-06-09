type PlainTextPasteSurface =
  | 'focused_contenteditable'
  | 'focused_input'
  | 'raw_editor'
  | 'rich_editor'

export interface PlainTextPasteTarget {
  surface: PlainTextPasteSurface
  contains: (element: Element | null) => boolean
  insert: (text: string) => boolean
  isConnected: () => boolean
}

let activePasteTarget: PlainTextPasteTarget | null = null

export function registerPlainTextPasteTarget(target: PlainTextPasteTarget): () => void {
  activePasteTarget = target

  return () => {
    if (activePasteTarget === target) {
      activePasteTarget = null
    }
  }
}

export function activatePlainTextPasteTarget(target: PlainTextPasteTarget): void {
  activePasteTarget = target
}
