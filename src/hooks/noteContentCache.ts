import type { VaultEntry } from '../types'

type NotePath = VaultEntry['path']

export interface NoteContentResolvedEvent {
  entry: VaultEntry | null
  path: NotePath
  content: string
  parsedBlockPreload: boolean
}

type NoteContentResolvedListener = (event: NoteContentResolvedEvent) => void

const resolvedListeners = new Set<NoteContentResolvedListener>()

export function subscribeNoteContentResolved(listener: NoteContentResolvedListener): () => void {
  resolvedListeners.add(listener)
  return () => resolvedListeners.delete(listener)
}
