import { useCallback, useEffect, useState } from 'react'

/** 一条「最近打开」记录。 */
export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

const STORAGE_KEY = 'markknife.recent-files'
const MAX_RECENTS = 30

function sanitize(raw: unknown): RecentFile[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (it): it is RecentFile =>
        !!it &&
        typeof it === 'object' &&
        typeof (it as RecentFile).path === 'string' &&
        typeof (it as RecentFile).name === 'string' &&
        typeof (it as RecentFile).openedAt === 'number',
    )
    .slice(0, MAX_RECENTS)
}

function readStored(): RecentFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

/**
 * 「最近打开」历史:localStorage 持久化,新打开的文件置顶去重,上限 30 条。
 * 供起始页历史列表使用。
 */
export function useRecentFiles() {
  const [recents, setRecents] = useState<RecentFile[]>(readStored)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recents))
    } catch {
      // 持久化失败(如隐私模式)忽略。
    }
  }, [recents])

  // 记录一次打开:置顶 + 去重 + 截断。
  const record = useCallback((path: string, name: string) => {
    setRecents((prev) => [
      { path, name, openedAt: Date.now() },
      ...prev.filter((it) => it.path !== path),
    ].slice(0, MAX_RECENTS))
  }, [])

  const remove = useCallback((path: string) => {
    setRecents((prev) => prev.filter((it) => it.path !== path))
  }, [])

  const clear = useCallback(() => setRecents([]), [])

  return { recents, record, remove, clear }
}
