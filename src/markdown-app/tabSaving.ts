export interface SaveableTab {
  path: string
  content: string
  dirty: boolean
}

type WriteMarkdown = (path: string, content: string) => Promise<void>

/** 同一文件的自动保存与关闭前保存按顺序写入，失败不阻断后续重试。 */
export function createMarkdownWriteQueue<TArgs extends unknown[]>(
  write: (path: string, content: string, ...args: TArgs) => Promise<void>,
): (path: string, content: string, ...args: TArgs) => Promise<void> {
  const pending = new Map<string, Promise<void>>()
  return (path, content, ...args) => {
    const previous = pending.get(path) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(() => write(path, content, ...args))
    pending.set(path, next)
    const cleanup = () => {
      if (pending.get(path) === next) pending.delete(path)
    }
    void next.then(cleanup, cleanup)
    return next
  }
}

/** 只把内容仍与落盘快照一致的标签标为已保存。 */
export function markSavedTabs<T extends SaveableTab>(
  tabs: T[],
  saved: ReadonlyArray<Pick<SaveableTab, 'path' | 'content'>>,
): T[] {
  const contents = new Map(saved.map((tab) => [tab.path, tab.content]))
  return tabs.map((tab) =>
    contents.has(tab.path)
      ? { ...tab, dirty: contents.get(tab.path) !== tab.content }
      : tab,
  )
}

export interface CloseSaveResult {
  failures: Array<{ path: string; message: string }>
  pendingPaths: string[]
  canClose: boolean
}

/** 关闭前同步编辑器、保存所有目标标签，再检查保存期间是否有新修改。 */
export async function saveTabsBeforeClose<T extends SaveableTab>({
  readTabs,
  updateTabs,
  shouldClose,
  flushEditor,
  write,
}: {
  readTabs: () => T[]
  updateTabs: (update: (tabs: T[]) => T[]) => void
  shouldClose: (tab: T) => boolean
  flushEditor: () => void
  write: WriteMarkdown
}): Promise<CloseSaveResult> {
  flushEditor()
  const snapshots = readTabs().filter((tab) => shouldClose(tab) && tab.dirty)
  const saved: T[] = []
  const failures: CloseSaveResult['failures'] = []
  for (const tab of snapshots) {
    try {
      await write(tab.path, tab.content)
      saved.push(tab)
    } catch (error) {
      failures.push({
        path: tab.path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  flushEditor()
  updateTabs((tabs) => markSavedTabs(tabs, saved))
  const pendingPaths = readTabs()
    .filter((tab) => shouldClose(tab) && tab.dirty)
    .map((tab) => tab.path)
  return { failures, pendingPaths, canClose: failures.length === 0 && pendingPaths.length === 0 }
}
