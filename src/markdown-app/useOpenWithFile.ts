import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '../mock-tauri'
import { invokeCommand } from './invokeCommand'

/**
 * 处理「由系统打开方式 / 双击 / 命令行」传入的文件：
 * - 冷启动：前端挂载后领取后端暂存的待打开路径（take_pending_open_file）。
 * - 热打开：app 已运行时再次双击，后端通过 `open-file` 事件实时通知。
 */
export function useOpenWithFile(onOpenPath: (path: string) => void) {
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    void invokeCommand<string | null>('take_pending_open_file')
      .then((path) => {
        if (!cancelled && path) onOpenPath(path)
      })
      .catch((error) => console.error('[markdown-app] 领取待打开文件失败:', error))

    void listen<string>('open-file', (event) => {
      if (event.payload) onOpenPath(event.payload)
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((error) => console.error('[markdown-app] 监听 open-file 失败:', error))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [onOpenPath])
}
