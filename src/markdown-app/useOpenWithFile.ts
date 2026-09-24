import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '../mock-tauri'
import { invokeCommand } from './invokeCommand'

/** 冷启动领取待打开文件的兜底时长:超时仍未领完(异常)也放行起始页,不让界面卡在空白。 */
const COLD_START_SETTLE_TIMEOUT_MS = 2000

/**
 * 处理「由系统打开方式 / 双击 / 命令行」传入的文件：
 * - 冷启动：前端挂载后领取后端暂存的待打开路径（take_pending_open_file）。
 * - 热打开：app 已运行时再次双击，后端通过 `open-file` 事件实时通知。
 *
 * 返回「冷启动领取是否已结束」:领到文件时要等文件载入完才算结束。调用方在结束前不渲染起始页,
 * 否则双击 .md 冷启动会先闪一下起始页再切到文档。
 */
export function useOpenWithFile(onOpenPath: (path: string) => void | Promise<void>): boolean {
  const [coldStartSettled, setColdStartSettled] = useState(() => !isTauri())
  // 进行中的领取数:StrictMode 开发模式 effect 双跑时,后一次领到 null 可能先返回,
  // 不能据此提前放行——要等领到文件的那一次载入完。
  const inFlightTakesRef = useRef(0)

  useEffect(() => {
    if (!isTauri()) return
    const handle = setTimeout(() => setColdStartSettled(true), COLD_START_SETTLE_TIMEOUT_MS)
    return () => clearTimeout(handle)
  }, [])

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    // 注意:take_* 是「取走即删除」的一次性消费,拿到 path 必须处理——不能用 cancelled 守卫,
    // 否则 StrictMode 开发模式 effect 双跑时,第一次 invoke 取走并因 cancelled 丢弃、第二次又取不到,
    // 文件就永远打不开了。openInTab 按 path 去重,重复调用安全。
    inFlightTakesRef.current += 1
    void invokeCommand<string | null>('take_pending_open_file')
      .then(async (path) => {
        if (path) await onOpenPath(path)
      })
      .catch((error) => console.error('[markdown-app] 领取待打开文件失败:', error))
      .finally(() => {
        inFlightTakesRef.current -= 1
        if (inFlightTakesRef.current === 0) setColdStartSettled(true)
      })

    // 由标签拆出而新建的窗口:按自身 label 领取要打开的文件(见 detach_tab_to_window)。
    void invokeCommand<string | null>('take_detached_open_path')
      .then((path) => {
        if (path) void onOpenPath(path)
      })
      .catch((error) => console.error('[markdown-app] 领取拆出窗口文件失败:', error))

    void listen<string>('open-file', (event) => {
      if (event.payload) void onOpenPath(event.payload)
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

  return coldStartSettled
}
