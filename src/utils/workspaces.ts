import type { VaultEntry } from '../types'

export function workspacePathForEntry(entry: Pick<VaultEntry, 'workspace'>): string | undefined {
  return entry.workspace?.path
}
