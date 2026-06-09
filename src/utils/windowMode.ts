/**
 * Detects whether the current window is a secondary "note window" (opened via
 * "Open in New Window") by inspecting URL query parameters.
 */

export interface NoteWindowParams {
  notePath: string
  vaultPath: string
  noteTitle: string
}

interface TauriWindowInternals {
  metadata?: { currentWindow?: { label?: string } }
}

const NOTE_WINDOW_STORAGE_PREFIX = 'markknife:note-window:'

function getCurrentWindowLabel(): string | null {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriWindowInternals }).__TAURI_INTERNALS__
  const label = internals?.metadata?.currentWindow?.label
  return typeof label === 'string' && label.length > 0 ? label : null
}

function noteWindowStorageKey(label: string): string {
  return `${NOTE_WINDOW_STORAGE_PREFIX}${label}`
}

function isStoredNoteWindowParams(value: Partial<NoteWindowParams>): value is NoteWindowParams {
  if (typeof value.notePath !== 'string') return false
  if (typeof value.vaultPath !== 'string') return false
  return typeof value.noteTitle === 'string'
}

function parseStoredNoteWindowParams(raw: string | null): NoteWindowParams | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<NoteWindowParams>
    if (isStoredNoteWindowParams(parsed)) {
      return {
        notePath: parsed.notePath,
        vaultPath: parsed.vaultPath,
        noteTitle: parsed.noteTitle,
      }
    }
  } catch {
    return null
  }

  return null
}

function getStoredNoteWindowParams(label: string | null): NoteWindowParams | null {
  if (!label) return null

  try {
    return parseStoredNoteWindowParams(localStorage.getItem(noteWindowStorageKey(label)))
  } catch {
    return null
  }
}

function getNoteWindowLabel(params: URLSearchParams): string | null {
  return params.get('windowLabel') ?? getCurrentWindowLabel()
}

export function isNoteWindow(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') === 'note') return true
  return getStoredNoteWindowParams(getCurrentWindowLabel()) !== null
}

export function getNoteWindowParams(): NoteWindowParams | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') !== 'note') return getStoredNoteWindowParams(getCurrentWindowLabel())
  const notePath = params.get('path')
  const vaultPath = params.get('vault')
  const noteTitle = params.get('title') ?? 'Untitled'
  if (!notePath || !vaultPath) return getStoredNoteWindowParams(getNoteWindowLabel(params))
  return { notePath, vaultPath, noteTitle }
}
