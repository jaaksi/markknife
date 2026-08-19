import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isTauri } from '../mock-tauri'
import { invokeCommand } from './invokeCommand'
import { useLanguage } from './useLanguage'
import type { RecentFile } from './useRecentFiles'

/** 后端「历史记录」菜单项点击后发来的「打开该文件」事件(只发给聚焦窗口)。 */
const OPEN_RECENT_EVENT = 'menu:open-recent-file'
/** 后端「清除历史记录」菜单项点击后发来的事件(广播给所有窗口)。 */
const CLEAR_RECENT_EVENT = 'menu:clear-recent-files'

/**
 * 驱动原生菜单栏(仅 macOS,其他平台后端为空操作)。
 *
 * 菜单栏的文案与「历史记录」列表都由前端提供:后端启动时先用英文占位搭好结构,这里在挂载后
 * 以及语言 / 列表变化时整份推过去改写。所有文案都取自 i18nMessages,后端不含用户可见文案。
 */
export function useAppMenu({
  recents,
  onOpenPath,
  onClear,
}: {
  recents: RecentFile[]
  onOpenPath: (path: string) => void
  onClear: () => void
}) {
  const { t } = useLanguage()

  // 语言 / 列表变化后重推整份菜单数据。
  useEffect(() => {
    if (!isTauri()) return
    void invokeCommand('sync_app_menu', {
      payload: {
        standard: {
          file: t('menu.file'),
          edit: t('menu.edit'),
          view: t('menu.view'),
          window: t('menu.window'),
          help: t('menu.help'),
          about: t('menu.about'),
          services: t('menu.services'),
          hide: t('menu.hide'),
          hideOthers: t('menu.hideOthers'),
          showAll: t('menu.showAll'),
          quit: t('menu.quit'),
          closeWindow: t('menu.closeWindow'),
          undo: t('menu.undo'),
          redo: t('menu.redo'),
          cut: t('menu.cut'),
          copy: t('menu.copy'),
          paste: t('menu.paste'),
          selectAll: t('menu.selectAll'),
          fullscreen: t('menu.fullscreen'),
          minimize: t('menu.minimize'),
          zoom: t('menu.zoom'),
        },
        recent: {
          title: t('menu.recent.title'),
          clearLabel: t('menu.recent.clear'),
          emptyLabel: t('menu.recent.empty'),
          items: recents.map(({ path, name }) => ({ path, name })),
        },
      },
    }).catch((error) => console.error('[markdown-app] 同步菜单栏失败:', error))
  }, [recents, t])

  // 点击历史项 → 在本窗口打开。
  // 必须用**窗口级**监听:macOS 菜单栏是应用级的,后端只把事件投给聚焦窗口,而裸 listen 注册的是
  // EventTarget::Any,会短路掉 Tauri 的目标过滤(定向退化成广播),多窗口下每个窗口都会打开一遍。
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    void getCurrentWebviewWindow()
      .listen<string>(OPEN_RECENT_EVENT, (event) => {
        if (event.payload) onOpenPath(event.payload)
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((error) => console.error('[markdown-app] 监听打开历史文件失败:', error))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [onOpenPath])

  // 「清除历史记录」是广播:多窗口共用同一份 localStorage,所有窗口一起清空才不会被旧状态写回。
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    void listen(CLEAR_RECENT_EVENT, () => onClear())
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((error) => console.error('[markdown-app] 监听清除历史记录失败:', error))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [onClear])
}
