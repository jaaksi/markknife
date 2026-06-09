import { EditorSelection } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { t } from './i18nMessages'

/** 用 marker 包裹每段选区(粗体 / 斜体 / 删除线 / 行内代码);空选区则把光标置于标记中间。 */
export function wrapInline(view: EditorView, marker: string): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to)
      const insert = marker + text + marker
      const anchor = range.from + marker.length
      return {
        changes: { from: range.from, to: range.to, insert },
        range: range.empty
          ? EditorSelection.cursor(anchor)
          : EditorSelection.range(anchor, anchor + text.length),
      }
    }),
  )
  view.focus()
}

/** 把选区涉及的每一行加上 / 去掉行首前缀(引用 / 列表 / 任务)。 */
export function toggleLinePrefix(view: EditorView, prefix: string): void {
  const { state } = view
  const range = state.selection.main
  const startLine = state.doc.lineAt(range.from).number
  const endLine = state.doc.lineAt(range.to).number
  const changes: { from: number; to?: number; insert?: string }[] = []
  for (let n = startLine; n <= endLine; n++) {
    const line = state.doc.line(n)
    if (line.text.startsWith(prefix)) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }
  view.dispatch({ changes })
  view.focus()
}

/** 把当前行设为指定级别标题(替换已有的 # 前缀)。 */
export function setHeading(view: EditorView, level: number): void {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const stripped = line.text.replace(/^#{1,6}\s+/, '')
  const insert = `${'#'.repeat(level)} ${stripped}`
  view.dispatch({ changes: { from: line.from, to: line.to, insert } })
  view.focus()
}

/** 用前后缀包裹选区(代码块等),光标落到选区末尾之后。 */
export function wrapBlock(view: EditorView, before: string, after: string): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to)
      const insert = before + text + after
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + before.length + text.length),
      }
    }),
  )
  view.focus()
}

/** 在选区处插入一段文本(表格 / 分割线等),并把光标移到其后。 */
export function insertText(view: EditorView, text: string): void {
  const range = view.state.selection.main
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.cursor(range.from + text.length),
  })
  view.focus()
}

/** 插入链接 / 图片:`[选区](url)`,并选中 url 占位以便直接替换。 */
export function wrapLink(view: EditorView, image = false): void {
  const prefix = image ? '![' : '['
  view.dispatch(
    view.state.changeByRange((range) => {
      const selected = view.state.sliceDoc(range.from, range.to)
      const text = selected || t(image ? 'content.imageAlt' : 'content.linkText')
      const insert = `${prefix}${text}](url)`
      const urlStart = range.from + prefix.length + text.length + 2 // 越过 "]("
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(urlStart, urlStart + 3),
      }
    }),
  )
  view.focus()
}

export function undoCmd(view: EditorView): void {
  undo(view)
  view.focus()
}

export function redoCmd(view: EditorView): void {
  redo(view)
  view.focus()
}

const CODE_BLOCK = '```\n'
const CODE_BLOCK_END = '\n```\n'

export const MARKDOWN_BLOCKS = {
  /** 表格模板:含表头 / 单元格占位文案,跟随界面语言(读取时即时翻译)。 */
  get table() {
    return t('content.tableTemplate')
  },
  hr: '\n---\n',
  codeBefore: CODE_BLOCK,
  codeAfter: CODE_BLOCK_END,
}
