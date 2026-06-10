import { createExtension } from '@blocknote/core'

/** 受保护的文件类块(选中这些块的 NodeSelection 会弹出图片/文件工具栏)。 */
const FILE_BLOCK_NODE_TYPES = new Set(['audio', 'file', 'image', 'video'])
/**
 * 真实输入(指针/键盘/拖放)之后这段时间内的选区折叠视为用户意图,予以放行。
 * 指针引发的选区同步另有 pointer meta 标记、键盘命令为同步派发,二者实际都在
 * 输入后几毫秒内完成;窗口刻意取小,避免放过紧跟在一次点击之后的幽灵折叠。
 */
const REAL_INPUT_GRACE_MS = 120
/** 程序化选区重置(标签切换前等)与其后续事务之间的放行窗口。 */
const INTENTIONAL_RESET_GRACE_MS = 400
/** 为打真实输入时间戳监听的事件。 */
const REAL_INPUT_EVENTS = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'drop'] as const

let lastIntentionalResetAt = -Infinity

/**
 * 程序内主动重置选区(如 resetTextSelectionBeforeContentSwap)前调用,
 * 告知本守卫接下来的选区折叠是有意为之,不要拦截。
 */
export function markIntentionalSelectionReset(): void {
  lastIntentionalResetAt = performance.now()
}

interface SelectionLike {
  empty?: boolean
  node?: { type?: { name?: string } }
}

interface TransactionLike {
  selectionSet?: boolean
  docChanged?: boolean
  selection?: SelectionLike
  getMeta?: (key: string) => unknown
}

function isFileBlockNodeSelection(selection: SelectionLike | undefined): boolean {
  const name = selection?.node?.type?.name
  return typeof name === 'string' && FILE_BLOCK_NODE_TYPES.has(name)
}

function isCollapsedTextSelection(selection: SelectionLike | undefined): boolean {
  if (!selection || selection.empty !== true) return false
  return !('node' in selection)
}

/**
 * 是否为「幽灵选区折叠」:文档未变、把文件块的 NodeSelection 换成空文本光标、
 * 不带 ProseMirror 的 pointer 标记(用户指针引发的选区同步会被 prosemirror-view 打上
 * `setMeta("pointer", true)`;键盘引发的发生在按键后 50ms 内,由调用方的「近期真实
 * 输入」宽限放行)、也不是程序主动重置——这只可能来自 DOM 选区误同步。
 */
function isSpuriousFileBlockCollapse(
  currentSelection: SelectionLike | undefined,
  tr: TransactionLike,
): boolean {
  if (tr.selectionSet !== true || tr.docChanged === true) return false
  if (!isFileBlockNodeSelection(currentSelection)) return false
  if (!isCollapsedTextSelection(tr.selection)) return false
  if (tr.getMeta?.('pointer') === true) return false
  return performance.now() - lastIntentionalResetAt >= INTENTIONAL_RESET_GRACE_MS
}

/**
 * WebKit(macOS WKWebView / Safari)下,点选图片等不可编辑的文件块后,原生 DOM 选区会
 * 异步漂移;下一次鼠标移动触发 ProseMirror DOMObserver.flush 时,文件块的 NodeSelection
 * 会被误同步成一个空文本光标。后果是图片悬浮工具栏(依赖 NodeSelection 显示)在鼠标
 * 移动时立刻消失。Chromium 无此问题。
 *
 * 本守卫在 dispatch 入口丢弃这类「幽灵折叠」事务:文档无变化、旧选区是文件块
 * NodeSelection、新选区是空文本光标、且近期(REAL_INPUT_GRACE_MS 内)没有指针 / 键盘 /
 * 拖放等真实输入。用户点击别处、按方向键 / Esc 等正常取消选中都带真实输入,不受影响;
 * 程序化重置走 markIntentionalSelectionReset 放行。
 */
export const createFileBlockSelectionGuardExtension = createExtension(({ editor }) => {
  const readView = () => editor._tiptapEditor?.view ?? editor.prosemirrorView

  let lastRealInputAt = -Infinity
  const stampRealInput = () => {
    lastRealInputAt = performance.now()
  }

  return {
    key: 'fileBlockSelectionGuard',
    mount: ({ dom, signal }) => {
      const doc = dom.ownerDocument
      for (const eventName of REAL_INPUT_EVENTS) {
        doc.addEventListener(eventName, stampRealInput, { capture: true, signal })
      }

      const view = readView()
      if (!view) return

      const originalDispatch = view.dispatch.bind(view)
      view.dispatch = (tr) => {
        if (
          performance.now() - lastRealInputAt >= REAL_INPUT_GRACE_MS
          && isSpuriousFileBlockCollapse(view.state.selection as SelectionLike, tr as TransactionLike)
        ) {
          return
        }
        originalDispatch(tr)
      }
      signal.addEventListener('abort', () => {
        view.dispatch = originalDispatch
      })
    },
  } as const
})
