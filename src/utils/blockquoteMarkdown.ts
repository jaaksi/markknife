/**
 * Markdown 硬换行会生成 <br> 加一个排版用换行，BlockNote 的引用解析器会把两者都保留。
 * 仅移除引用内紧跟 <br> 的那一个排版换行，保留真正的连续 <br>、空段落和代码内容。
 */
export function normalizeBlockquoteHtmlBreaks(html: string): string {
  if (!html.includes('<blockquote') || !html.includes('<br')) return html
  const container = document.createElement('div')
  container.innerHTML = html
  let changed = false
  for (const lineBreak of container.querySelectorAll('blockquote br')) {
    if (lineBreak.closest('pre, code')) continue
    const next = lineBreak.nextSibling
    if (next?.nodeType !== Node.TEXT_NODE || !next.nodeValue?.startsWith('\n')) continue
    next.nodeValue = next.nodeValue.slice(1)
    changed = true
  }
  return changed ? container.innerHTML : html
}
