import { useEffect, type MutableRefObject } from 'react'
import { isTauri } from '../mock-tauri'
import { readMarkdownFileState } from './fileIo'
import { reconcileDiskContent, withExternalChange, type OpenTab } from './fileChanges'

const CHECK_INTERVAL_MS = 2000

/** 定期检查所有打开的文件，浏览器与原生窗口获得焦点时立即检查。 */
export function useExternalFileChanges({ tabsRef, updateTabs, flushEditor, isSaving }: {
  tabsRef: MutableRefObject<OpenTab[]>
  updateTabs: (update: (tabs: OpenTab[]) => OpenTab[]) => void
  flushEditor: MutableRefObject<(() => void) | null>
  isSaving: (path: string) => boolean
}) {
  useEffect(() => {
    let disposed = false
    let checking = false
    let checkAgain = false
    let unlisten: (() => void) | undefined
    const check = async () => {
      if (disposed) return
      if (checking) { checkAgain = true; return }
      checking = true
      try {
        flushEditor.current?.()
        for (const snapshot of tabsRef.current) {
          if (disposed) return
          if (isSaving(snapshot.path)) continue
          try {
            const disk = await readMarkdownFileState(snapshot.path)
            if (disposed || isSaving(snapshot.path)) continue
            flushEditor.current?.()
            updateTabs((tabs) => {
              let changed = false
              const next = tabs.map((tab) => {
                if (tab.path !== snapshot.path) return tab
                const reconciled = reconcileDiskContent(tab, snapshot, disk)
                if (reconciled !== tab) changed = true
                return reconciled
              })
              return changed ? next : tabs
            })
          } catch (error) {
            if (disposed || isSaving(snapshot.path)) continue
            updateTabs((tabs) => {
              let changed = false
              const next = tabs.map((tab) => {
                if (tab.instanceId !== snapshot.instanceId || tab.path !== snapshot.path
                  || tab.diskGeneration !== snapshot.diskGeneration) return tab
                const failed = withExternalChange(tab, { kind: 'unreadable', message: String(error) })
                if (failed !== tab) changed = true
                return failed
              })
              return changed ? next : tabs
            })
          }
        }
      } finally {
        checking = false
        if (checkAgain && !disposed) {
          checkAgain = false
          void check()
        }
      }
    }
    const onFocus = () => { void check() }
    const onVisibility = () => { if (!document.hidden) void check() }
    const timer = setInterval(onFocus, CHECK_INTERVAL_MS)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    if (isTauri()) {
      void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
        getCurrentWindow().onFocusChanged(({ payload }) => { if (payload) onFocus() }),
      ).then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      }).catch((error) => console.error('[markdown-app] Focus listener failed:', error))
    }
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      unlisten?.()
    }
  }, [tabsRef, updateTabs, flushEditor, isSaving])
}
