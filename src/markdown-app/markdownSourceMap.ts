import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import type { Root } from 'mdast'

/** 一个顶层块在源码里的起止行(1-based,含 frontmatter 的编辑器真实行号)。 */
export interface SourceBlockSpan {
  startLine: number
  endLine: number
}

// 只 parse 取 mdast(带 position),不跑 transformer。remark-gfm 提供表格/删除线等 GFM 语法,
// remark-frontmatter 让开头的 YAML frontmatter 被识别为独立节点(否则会被误解析为分隔线/标题而打乱行号)。
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml'])

/**
 * 解析原始 markdown,返回与 BlockNote「顶层块」一一对应的源码行范围序列。
 *
 * 对齐要点:BlockNote 把每个列表项渲染成一个独立的顶层块,所以这里把 mdast 的 list 节点
 * 展开到 listItem 级别;frontmatter(yaml)在预览里没有对应块,跳过。
 * 直接读 node.position.start/end.line —— 因为解析的是原始全文(含 frontmatter),行号即编辑器行号,
 * 无需再处理预处理(数学折叠/frontmatter 剥离)带来的行偏移。
 */
export function parseTopLevelSourceSpans(markdown: string): SourceBlockSpan[] {
  let tree: Root
  try {
    tree = processor.parse(markdown)
  } catch {
    return []
  }

  const spans: SourceBlockSpan[] = []
  for (const node of tree.children) {
    if (node.type === 'yaml') continue
    if (node.type === 'list') {
      for (const item of node.children) {
        if (item.position) {
          spans.push({ startLine: item.position.start.line, endLine: item.position.end.line })
        }
      }
      continue
    }
    if (node.position) {
      spans.push({ startLine: node.position.start.line, endLine: node.position.end.line })
    }
  }
  return spans
}
