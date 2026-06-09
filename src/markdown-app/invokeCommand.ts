import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

/**
 * 统一的命令调用入口：原生环境走真实 Tauri invoke，浏览器/测试环境走 mock。
 * 沿用项目既有的 `isTauri() ? invoke : mockInvoke` 模式。
 */
export function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}
