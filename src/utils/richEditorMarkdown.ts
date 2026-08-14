import type { useCreateBlockNote } from '@blocknote/react'
import { compactMarkdown } from './compact-markdown'
import { serializeDurableEditorBlocks } from './editorDurableMarkdown'
import { portableFileAttachmentUrls } from './fileAttachmentMarkdown'
import { advanceMarkdownFence, type MarkdownFence } from './markdownFences'
import { portableImageUrls } from './vaultImages'
import { splitFrontmatter } from './wikilinks'

type MarkdownBody = string

const EMPTY_CHECKLIST_ITEM_FILLER = '\u200B'
const EMPTY_CHECKLIST_ITEM_LINE_RE = /^([ \t]*[-*+][ \t]+\[[ xX]\])[ \t]*$/u
const BLANK_PARAGRAPH_PLACEHOLDER = '\u200B'

interface ParsedBlockquoteSourceLine {
  content: string
  marker: string
}

interface MarkdownSourceLine {
  content: string
  newline: string
}

interface BlankParagraphPreprocessState {
  fence: MarkdownFence | null
  output: string[]
  pendingBlanks: MarkdownSourceLine[]
  precedingContent: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function serializeRichEditorBodyToMarkdown(
  editor: ReturnType<typeof useCreateBlockNote>,
  vaultPath?: string,
): string {
  const serialized = serializeDurableEditorBlocks(editor, editor.document, vaultPath)
  return compactMarkdown(
    restoreBlankBlockquoteParagraphs(serialized),
    { preserveConsecutiveBlankLines: true },
  )
}

export function serializeRichEditorDocumentToMarkdown(
  editor: ReturnType<typeof useCreateBlockNote>,
  tabContent: string,
  vaultPath?: string,
  notePath?: string,
): string {
  const rawBodyMarkdown = serializeRichEditorBodyToMarkdown(editor, vaultPath)
  const bodyMarkdown = vaultPath
    ? portableFileAttachmentUrls(
      portableImageUrls(rawBodyMarkdown, vaultPath, notePath),
      vaultPath,
    )
    : rawBodyMarkdown
  const [frontmatter] = splitFrontmatter(tabContent)
  return `${frontmatter}${bodyMarkdown}`
}

/**
 * 空的复选框项(`- [ ]` 后面没有任何文字)会被 BlockNote 解析器丢弃,
 * 先塞一个零宽字符占位,注入阶段再清空内容,保证空待办项不会消失。
 */
export function preProcessEmptyChecklistItems(markdown: MarkdownBody): MarkdownBody {
  return markdown.split(/(\r?\n)/u).map(part => {
    if (part === '\n' || part === '\r\n') return part
    return preProcessEmptyChecklistLine(part)
  }).join('')
}

function preProcessEmptyChecklistLine(line: MarkdownBody): MarkdownBody {
  const match = EMPTY_CHECKLIST_ITEM_LINE_RE.exec(line)
  return match ? `${match[1]} ${EMPTY_CHECKLIST_ITEM_FILLER}` : line
}

/** 引用块内部的空行(`>` 独占一行)会被解析器吞掉,先转成占位段落保住分段。 */
export function preProcessBlankBlockquoteParagraphs(markdown: MarkdownBody): MarkdownBody {
  const lines = splitMarkdownSourceLines(markdown)
  return lines.map((line, index) => {
    const parsed = parseBlockquoteSourceLine(line.content)
    if (parsed?.content.trim() !== '') return markdownSourceLineText(line)
    if (!hasQuotedContentNeighbor(lines, index - 1) || !hasQuotedContentNeighbor(lines, index + 1)) {
      return markdownSourceLineText(line)
    }

    const newline = line.newline || '\n'
    const marker = parsed.marker.trimEnd()
    return `${newline}${marker} ${BLANK_PARAGRAPH_PLACEHOLDER}${newline}${newline}`
  }).join('')
}

function hasQuotedContentNeighbor(lines: MarkdownSourceLine[], index: number): boolean {
  const content = lines.at(index)?.content
  if (content === undefined) return false
  const parsed = parseBlockquoteSourceLine(content)
  return parsed !== null && parsed.content.trim() !== ''
}

/** 序列化回写时把被拆开的引用块重新并回一段,避免每次保存都多出空行。 */
export function restoreBlankBlockquoteParagraphs(markdown: MarkdownBody): MarkdownBody {
  const lines = markdown.split('\n').values()
  const restored: string[] = []
  let current = lines.next()

  while (!current.done) {
    const line = current.value
    const next = lines.next()
    const parsed = parseBlockquoteSourceLine(line)
    if (!isBlankSerializedBlockquoteGap(parsed, restored.at(-1), next.value)) {
      restored.push(line)
      current = next
      continue
    }

    restored.pop()
    restored.push(parsed.marker.trimEnd())
    current = lines.next()
  }

  return restored.join('\n')
}

function isBlankSerializedBlockquoteGap(
  parsed: ParsedBlockquoteSourceLine | null,
  previous: string | undefined,
  next: string | undefined,
): parsed is ParsedBlockquoteSourceLine {
  if (!parsed) return false
  if (parsed.content.trim() !== '') return false
  if (previous !== '') return false
  return next === ''
}

function parseBlockquoteSourceLine(line: string): ParsedBlockquoteSourceLine | null {
  let cursor = 0
  while (cursor < 3 && isHorizontalWhitespace(line.charAt(cursor))) cursor += 1
  if (line.charAt(cursor) !== '>') return null

  do {
    cursor += 1
    if (isHorizontalWhitespace(line.charAt(cursor))) cursor += 1
  } while (line.charAt(cursor) === '>')

  return { content: line.slice(cursor), marker: line.slice(0, cursor) }
}

function isHorizontalWhitespace(character: string): boolean {
  return character === ' ' || character === '\t'
}

/** 连续空行在 markdown 里没有语义,但用户是当作「空段落」写的,用占位段落保住。 */
export function preProcessBlankParagraphs(markdown: MarkdownBody): MarkdownBody {
  const lines = splitMarkdownSourceLines(markdown)
  if (lines.length === 0) return markdown

  const state: BlankParagraphPreprocessState = {
    fence: null,
    output: [],
    pendingBlanks: [],
    precedingContent: false,
  }

  for (const line of lines) {
    processBlankParagraphSourceLine(state, line)
  }

  flushPendingBlankParagraphsAtEnd(state)
  return state.output.join('')
}

function processBlankParagraphSourceLine(
  state: BlankParagraphPreprocessState,
  line: MarkdownSourceLine,
): void {
  if (state.fence) {
    processFencedBlankParagraphLine(state, line)
    return
  }

  if (isBlankMarkdownSourceLine(line)) {
    state.pendingBlanks.push(line)
    return
  }

  flushPendingBlankParagraphsBeforeContent(state)
  state.output.push(markdownSourceLineText(line))
  state.precedingContent = true
  state.fence = advanceMarkdownFence(line.content, null)
}

function processFencedBlankParagraphLine(
  state: BlankParagraphPreprocessState,
  line: MarkdownSourceLine,
): void {
  state.output.push(markdownSourceLineText(line))
  state.fence = advanceMarkdownFence(line.content, state.fence)
  if (!state.fence) state.precedingContent = true
}

function flushPendingBlankParagraphsBeforeContent(state: BlankParagraphPreprocessState): void {
  if (state.pendingBlanks.length === 0) return
  if (!state.precedingContent || state.pendingBlanks.length === 1) {
    flushPendingBlankParagraphsAtEnd(state)
    return
  }

  const [separator, ...blankParagraphs] = state.pendingBlanks
  state.output.push(markdownSourceLineText(separator))
  for (const blank of blankParagraphs) {
    appendBlankParagraphPlaceholder(state, blank)
  }
  state.pendingBlanks = []
}

function flushPendingBlankParagraphsAtEnd(state: BlankParagraphPreprocessState): void {
  state.output.push(...state.pendingBlanks.map(markdownSourceLineText))
  state.pendingBlanks = []
}

function appendBlankParagraphPlaceholder(
  state: BlankParagraphPreprocessState,
  blank: MarkdownSourceLine,
): void {
  const newline = blank.newline || '\n'
  state.output.push(`${BLANK_PARAGRAPH_PLACEHOLDER}${newline}`)
  state.output.push(newline)
}

function isBlankMarkdownSourceLine(line: MarkdownSourceLine): boolean {
  return line.content.trim() === ''
}

function splitMarkdownSourceLines(markdown: MarkdownBody): MarkdownSourceLine[] {
  const lines: MarkdownSourceLine[] = []
  const lineRe = /([^\r\n]*)(\r\n|\n|$)/gu

  for (;;) {
    const match = lineRe.exec(markdown)
    if (!match) break

    const [rawLine, content = '', newline = ''] = match
    if (rawLine === '' && match.index === markdown.length) break

    lines.push({ content, newline })
    if (newline === '') break
  }

  return lines
}

function markdownSourceLineText(line: MarkdownSourceLine): string {
  return `${line.content}${line.newline}`
}

/** 把预处理阶段塞进去的占位字符清空,让空段落 / 空待办项真正呈现为空。 */
export function injectBlankParagraphBlocks(blocks: unknown[]): unknown[] {
  let changed = false
  const nextBlocks = blocks.map(block => {
    const nextBlock = injectBlankParagraphBlock(block)
    if (nextBlock !== block) changed = true
    return nextBlock
  })
  return changed ? nextBlocks : blocks
}

function injectBlankParagraphBlock(block: unknown): unknown {
  if (!isRecord(block)) return block

  const children = Array.isArray(block.children)
    ? injectBlankParagraphBlocks(block.children)
    : undefined
  const childrenChanged = children !== undefined && children !== block.children

  if (isBlankParagraphPlaceholderBlock(block)) {
    return childrenChanged
      ? { ...block, content: [], children }
      : { ...block, content: [] }
  }

  return childrenChanged ? { ...block, children } : block
}

function isBlankParagraphPlaceholderBlock(block: Record<string, unknown>): boolean {
  return (block.type === 'paragraph' || block.type === 'quote' || block.type === 'checkListItem')
    && isBlankParagraphPlaceholderContent(block.content)
}

function isBlankParagraphPlaceholderContent(content: unknown): boolean {
  if (!Array.isArray(content) || content.length !== 1) return false

  const [item] = content
  return isRecord(item)
    && item.type === 'text'
    && item.text === BLANK_PARAGRAPH_PLACEHOLDER
}
