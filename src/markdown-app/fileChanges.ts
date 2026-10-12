export type ExternalFileChange =
  | { kind: 'modified'; content: string }
  | { kind: 'missing' }
  | { kind: 'unreadable'; message: string }

export interface OpenTab {
  instanceId: number
  path: string
  name: string
  content: string
  dirty: boolean
  diskContent: string
  diskGeneration: number
  reloadRevision: number
  externalChange: ExternalFileChange | null
}

let nextInstanceId = 0

export function createOpenTab(path: string, name: string, content: string): OpenTab {
  return {
    instanceId: ++nextInstanceId,
    path, name, content, dirty: false, diskContent: content,
    diskGeneration: 0, reloadRevision: 0, externalChange: null,
  }
}

export function withExternalChange(tab: OpenTab, change: ExternalFileChange): OpenTab {
  const previous = tab.externalChange
  if (previous?.kind === change.kind) {
    if (previous.kind === 'missing') return tab
    if (previous.kind === 'modified' && change.kind === 'modified' && previous.content === change.content) return tab
    if (previous.kind === 'unreadable' && change.kind === 'unreadable' && previous.message === change.message) return tab
  }
  return { ...tab, externalChange: change }
}

/** 忽略保存、重命名或关闭重开之前发出的旧检查结果。 */
export function reconcileDiskContent(tab: OpenTab, snapshot: OpenTab, disk: string | null): OpenTab {
  if (tab.instanceId !== snapshot.instanceId || tab.path !== snapshot.path
    || tab.diskGeneration !== snapshot.diskGeneration) return tab
  if (disk === null) return withExternalChange(tab, { kind: 'missing' })
  if (disk === tab.diskContent) {
    return tab.externalChange ? { ...tab, externalChange: null } : tab
  }
  if (tab.content !== tab.diskContent && tab.content !== disk) {
    return withExternalChange(tab, { kind: 'modified', content: disk })
  }
  return {
    ...tab, content: disk, diskContent: disk, dirty: false, externalChange: null,
    diskGeneration: tab.diskGeneration + 1,
    reloadRevision: tab.reloadRevision + (tab.content === disk ? 0 : 1),
  }
}

export function applySavedContent(tab: OpenTab, snapshot: OpenTab, content: string): OpenTab {
  if (tab.instanceId !== snapshot.instanceId || tab.path !== snapshot.path) return tab
  return {
    ...tab, diskContent: content, diskGeneration: tab.diskGeneration + 1,
    dirty: tab.content !== content, externalChange: null,
  }
}

export function replaceWithDiskContent(tab: OpenTab, disk: string): OpenTab {
  return {
    ...tab, content: disk, diskContent: disk, dirty: false, externalChange: null,
    diskGeneration: tab.diskGeneration + 1, reloadRevision: tab.reloadRevision + 1,
  }
}

/** 外部刷新后忽略旧编辑器实例的延迟回调，防止旧内容再次被自动保存。 */
export function applyEditorChange(
  tab: OpenTab, content: string, source: Pick<OpenTab, 'instanceId' | 'reloadRevision'>,
): OpenTab {
  if (tab.instanceId !== source.instanceId || tab.reloadRevision !== source.reloadRevision
    || tab.content === content) return tab
  return { ...tab, content, dirty: content !== tab.diskContent }
}
