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

    // 注意:take_* 是「取走即删除」的一次性消费,拿到 path 必须处理——不能用 cancelled 守卫,
    // 否则 StrictMode 开发模式 effect 双跑时,第一次 invoke 取走并因 cancelled 丢弃、第二次又取不到,
    // 文件就永远打不开了。openInTab 按 path 去重,重复调用安全。
    void invokeCommand<string | null>('take_pending_open_file')
      .then((path) => {
        if (path) onOpenPath(path)
      })
      .catch((error) => console.error('[markdown-app] 领取待打开文件失败:', error))

    // 由标签拆出而新建的窗口:按自身 label 领取要打开的文件(见 detach_tab_to_window)。
    void invokeCommand<string | null>('take_detached_open_path')
      .then((path) => {
        if (path) onOpenPath(path)
      })
      .catch((error) => console.error('[markdown-app] 领取拆出窗口文件失败:', error))

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
