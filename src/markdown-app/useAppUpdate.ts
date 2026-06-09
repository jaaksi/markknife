import { useCallback, useRef, useState } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { invokeCommand } from './invokeCommand'

/** 更新流程的状态机。 */
type AppUpdateStatus =
  | 'idle' // 未检查
  | 'checking' // 正在检查
  | 'available' // 发现新版本
  | 'downloading' // 下载安装中
  | 'ready' // 已下载，待重启
  | 'upToDate' // 已是最新
  | 'error' // 检查/下载失败

/** 后端 `check_for_app_update` 返回的更新元信息（serde camelCase）。 */
interface AppUpdateMeta {
  currentVersion: string
  version: string
  date?: string | null
  body?: string | null
}

/** 后端 `download_and_install_app_update` 通过 Channel 回传的下载事件（tagged）。 */
type DownloadEvent =
  | { event: 'Started'; data: { contentLength: number | null } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }

export interface AppUpdate {
  status: AppUpdateStatus
  meta: AppUpdateMeta | null
  error: string | null
  /** 已下载字节数。 */
  downloaded: number
  /** 总字节数（后端可能未提供）。 */
  total: number | null
  /** 启动时静默检查发现新版后置 true，用于弹出更新提示框。 */
  promptOpen: boolean
  check: (opts?: { silent?: boolean }) => Promise<void>
  install: () => Promise<void>
  relaunchApp: () => Promise<void>
  dismiss: () => void
}

/**
 * 应用自动更新逻辑：封装后端 updater 命令，供「启动静默检查 + 弹窗」与
 * 「设置页手动检查」两个入口共用。浏览器 / 测试环境（非 Tauri）下所有操作均为空操作。
 */
export function useAppUpdate(): AppUpdate {
  const [status, setStatus] = useState<AppUpdateStatus>('idle')
  const [meta, setMeta] = useState<AppUpdateMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  // 防止并发检查（启动静默检查与手动点击可能同时触发）。
  const busyRef = useRef(false)

  const check = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isTauri() || busyRef.current) return
    busyRef.current = true
    setError(null)
    setStatus('checking')
    try {
      const result = await invokeCommand<AppUpdateMeta | null>('check_for_app_update', {
        releaseChannel: null,
      })
      if (result) {
        setMeta(result)
        setStatus('available')
        // 仅启动静默检查发现新版时自动弹窗；手动检查的结果在设置页内联展示。
        if (opts?.silent) setPromptOpen(true)
      } else {
        setMeta(null)
        setStatus('upToDate')
      }
    } catch (e) {
      setError(String(e))
      setStatus('error')
    } finally {
      busyRef.current = false
    }
  }, [])

  const install = useCallback(async () => {
    // busyRef 同时挡住「重复点击下载」与「下载期间再发起检查」。
    if (!isTauri() || !meta || busyRef.current) return
    busyRef.current = true
    setError(null)
    setDownloaded(0)
    setTotal(null)
    setStatus('downloading')
    const channel = new Channel<DownloadEvent>()
    channel.onmessage = (message) => {
      if (message.event === 'Started') {
        setTotal(message.data.contentLength ?? null)
      } else if (message.event === 'Progress') {
        setDownloaded((prev) => prev + message.data.chunkLength)
      } else if (message.event === 'Finished') {
        setStatus('ready')
      }
    }
    try {
      await invokeCommand<void>('download_and_install_app_update', {
        releaseChannel: null,
        expectedVersion: meta.version,
        onEvent: channel,
      })
      setStatus('ready')
    } catch (e) {
      setError(String(e))
      setStatus('error')
    } finally {
      busyRef.current = false
    }
  }, [meta])

  const relaunchApp = useCallback(async () => {
    if (!isTauri()) return
    try {
      // 懒加载插件，避免非 Tauri 环境在模块加载期触碰原生 API。
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (e) {
      setError(`重启失败，请手动重启应用。（${String(e)}）`)
      setStatus('error')
    }
  }, [])

  const dismiss = useCallback(() => setPromptOpen(false), [])

  return { status, meta, error, downloaded, total, promptOpen, check, install, relaunchApp, dismiss }
}
