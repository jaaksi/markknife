import type { ReactNode, RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import {
  insertText,
  MARKDOWN_BLOCKS,
  redoCmd,
  setHeading,
  toggleLinePrefix,
  undoCmd,
  wrapBlock,
  wrapInline,
  wrapLink,
} from './markdownCommands'
import { useLanguage } from './useLanguage'
import type { MessageKey } from './i18nMessages'

/** 一个功能项:图标 + 提示文案翻译键 + 作用到 EditorView 的命令;或一个分隔符。 */
type FmtItem =
  | { type: 'sep' }
  | { type: 'btn'; tipKey: MessageKey; icon: ReactNode; run: (view: EditorView) => void }

const I = (children: ReactNode, opts?: { strokeWidth?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={opts?.strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const ITEMS: FmtItem[] = [
  { type: 'btn', tipKey: 'format.undo', icon: I(<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>), run: undoCmd },
  { type: 'btn', tipKey: 'format.redo', icon: I(<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></>), run: redoCmd },
  { type: 'sep' },
  { type: 'btn', tipKey: 'format.h1', icon: <span className="text-[13px] font-bold">H1</span>, run: (v) => setHeading(v, 1) },
  { type: 'btn', tipKey: 'format.h2', icon: <span className="text-[13px] font-bold">H2</span>, run: (v) => setHeading(v, 2) },
  { type: 'btn', tipKey: 'format.h3', icon: <span className="text-[13px] font-bold">H3</span>, run: (v) => setHeading(v, 3) },
  { type: 'sep' },
  { type: 'btn', tipKey: 'format.bold', icon: I(<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />, { strokeWidth: 2.2 }), run: (v) => wrapInline(v, '**') },
  { type: 'btn', tipKey: 'format.italic', icon: I(<><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>), run: (v) => wrapInline(v, '*') },
  { type: 'btn', tipKey: 'format.strikethrough', icon: I(<><path d="M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6" /><line x1="4" y1="12" x2="20" y2="12" /></>), run: (v) => wrapInline(v, '~~') },
  { type: 'btn', tipKey: 'format.inlineCode', icon: I(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>), run: (v) => wrapInline(v, '`') },
  { type: 'sep' },
  { type: 'btn', tipKey: 'format.quote', icon: I(<path d="M3 21c3 0 7-1 7-8V5H3v7h4M14 21c3 0 7-1 7-8V5h-7v7h4" />), run: (v) => toggleLinePrefix(v, '> ') },
  { type: 'btn', tipKey: 'format.codeBlock', icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><polyline points="8 10 6 12 8 14" /><polyline points="16 10 18 12 16 14" /></>), run: (v) => wrapBlock(v, MARKDOWN_BLOCKS.codeBefore, MARKDOWN_BLOCKS.codeAfter) },
  { type: 'sep' },
  { type: 'btn', tipKey: 'format.bulletList', icon: I(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" /></>), run: (v) => toggleLinePrefix(v, '- ') },
  { type: 'btn', tipKey: 'format.orderedList', icon: I(<><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4M4 10h2M4 16h2v1H4v1h2v1H4" /></>), run: (v) => toggleLinePrefix(v, '1. ') },
  { type: 'btn', tipKey: 'format.taskList', icon: I(<><rect x="3" y="5" width="6" height="6" rx="1.5" /><path d="M4.5 8l1 1 2-2.2" /><rect x="3" y="14" width="6" height="6" rx="1.5" /><line x1="12" y1="8" x2="21" y2="8" /><line x1="12" y1="17" x2="21" y2="17" /></>), run: (v) => toggleLinePrefix(v, '- [ ] ') },
  { type: 'sep' },
  { type: 'btn', tipKey: 'format.link', icon: I(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>), run: (v) => wrapLink(v, false) },
  { type: 'btn', tipKey: 'format.image', icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>), run: (v) => wrapLink(v, true) },
  { type: 'btn', tipKey: 'format.table', icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="4" x2="9" y2="20" /></>), run: (v) => insertText(v, MARKDOWN_BLOCKS.table) },
  { type: 'btn', tipKey: 'format.divider', icon: I(<line x1="3" y1="12" x2="21" y2="12" />), run: (v) => insertText(v, MARKDOWN_BLOCKS.hr) },
]

/** 分栏源码侧的 Markdown 编辑功能栏:常用语法一键插入(1:1 还原设计稿)。 */
export function MarkdownFormatToolbar({ viewRef }: { viewRef: RefObject<EditorView | null> }) {
  const { t } = useLanguage()
  return (
    <div
      className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-background px-2 [scrollbar-width:none]"
      role="toolbar"
      aria-label={t('format.toolbarAria')}
      data-testid="markdown-format-toolbar"
    >
      {ITEMS.map((item, i) =>
        item.type === 'sep' ? (
          <span key={i} aria-hidden="true" className="mx-[5px] h-[18px] w-px shrink-0 bg-border" />
        ) : (
          <button
            key={i}
            type="button"
            title={t(item.tipKey)}
            aria-label={t(item.tipKey)}
            // 阻止默认以保住 CodeMirror 选区(不抢焦点)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const view = viewRef.current
              if (view) item.run(view)
            }}
            className="flex h-7 w-[30px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-primary/10 active:text-primary"
          >
            {item.icon}
          </button>
        ),
      )}
    </div>
  )
}
