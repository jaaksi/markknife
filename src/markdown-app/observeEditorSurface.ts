/** 三种模式共用的富文本滚动容器。 */
export const EDITOR_SCROLL_AREA_SELECTOR = '.editor-scroll-area'

/** 编辑区重建或异步挂载时重新绑定，解绑旧容器上的监听器与定时器。 */
export function observeEditorSurface(
  bind: (area: HTMLElement | null) => void | (() => void),
): () => void {
  let current: HTMLElement | null | undefined
  let cleanup: void | (() => void)
  const rebind = () => {
    const area = document.querySelector<HTMLElement>(EDITOR_SCROLL_AREA_SELECTOR)
    if (area === current) return
    cleanup?.()
    current = area
    cleanup = bind(area)
  }
  const observer = new MutationObserver(rebind)
  observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
  rebind()
  return () => {
    observer.disconnect()
    cleanup?.()
  }
}
