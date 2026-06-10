type Markdown = string

interface MarkdownSource {
  markdown: Markdown
}

const CODE_FENCE_PREFIXES = ['```', '~~~']
const IMG_TAG_RE = /<img\b[^>]*>/gi
// url 含这些字符会破坏 ![](url) 语法(下游 resolveImageUrls 以 ')' 定界),保守跳过转换。
const UNSAFE_URL_CHARS = /[\s()"]/
// 解包「只包着一张图片的块级容器」:一串包裹开标签 + 一个 Markdown 图片 + 一串闭标签。
// 覆盖 README 常见的居中 / 限宽写法,如 <p align="center"><img></p>、<div><a><img></a></div>、
// <picture><source><img></picture>。正文里普通的 <a>文字</a> / <div>文字</div> 不含图片,不会被匹配。
const IMAGE_CONTAINER_RE =
  /(?:<(?:p|div|picture|a)\b[^>]*>\s*|<source\b[^>]*>\s*)+(!\[[^\]]*\]\([^)]*\))(?:\s*<\/(?:p|div|picture|a)>)+/gi

function isCodeFence(line: string): boolean {
  const trimmed = line.trimStart()
  return CODE_FENCE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}

/** 从 <img> 标签里取某个属性值,支持双引号 / 单引号 / 无引号三种写法。 */
function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))
  if (!match) return null
  return match[2] ?? match[3] ?? match[4] ?? ''
}

/** 单个 <img> 标签 → ![alt](src);无 src 或 src 含不安全字符时保持原标签不动。 */
function htmlImageToMarkdown(tag: string): Markdown {
  const src = readAttribute(tag, 'src')
  if (!src || UNSAFE_URL_CHARS.test(src)) return tag
  const alt = (readAttribute(tag, 'alt') ?? '').replace(/[\r\n\]]+/g, ' ').trim()
  return `![${alt}](${src})`
}

function rewriteHtmlImages(segment: string): Markdown {
  // 1) 先把 <img> 转成 Markdown 图片语法。
  const withImages = segment.replace(IMG_TAG_RE, htmlImageToMarkdown)
  // 2) 再解包仅包着该图片的块级容器,前后补空行让图片独立成段——否则 <p>…</p> 会被当作
  //    HTML block,内部的 ![]() 不会被解析成图片。
  return withImages.replace(IMAGE_CONTAINER_RE, '\n\n$1\n\n')
}

/**
 * 把 Markdown 中内联的 HTML `<img>` 标签规范化成 Markdown 图片语法 `![alt](src)`。
 *
 * 背景:应用的图片渲染管线(BlockNote 解析 + resolveImageUrls 相对路径改写)只认
 * Markdown 图片语法 `![](...)`,不处理原始 HTML `<img>`。很多文档(如本项目 README)
 * 为了居中 / 限宽会用 `<img>`(常被 `<p align="center">` 等容器包裹)——在 GitHub / Typora
 * 等支持内联 HTML 的工具里正常,但在本应用里既不会被渲染,相对路径也不会被转成可加载的
 * `asset://` 协议。这里在解析前先把 `<img>` 规范化为 `![]()` 并解包其块级容器,后续相对
 * 路径解析、渲染即可自动复用,无需改动文档本身。
 *
 * 仅作用于「解析方向」(content → blocks),不影响保存时的序列化。代码围栏(``` / ~~~)
 * 内的内容原样保留,避免误伤示例代码;`<img>` 可跨行书写。
 */
export function preProcessHtmlImageMarkdown({ markdown }: MarkdownSource): Markdown {
  // 快速路径:整篇没有 <img> 时直接返回,避免无谓的逐行扫描。
  if (!/<img\b/i.test(markdown)) return markdown

  const lines = markdown.split('\n')
  const result: string[] = []
  let buffer: string[] = []
  let inFence = false

  // 把连续的非围栏行作为一个整体跑替换,这样跨行 <img> 与跨行容器也能被匹配到。
  const flushBuffer = () => {
    if (buffer.length === 0) return
    result.push(rewriteHtmlImages(buffer.join('\n')))
    buffer = []
  }

  for (const line of lines) {
    if (isCodeFence(line)) {
      flushBuffer()
      inFence = !inFence
      result.push(line)
      continue
    }
    if (inFence) {
      result.push(line)
      continue
    }
    buffer.push(line)
  }
  flushBuffer()

  return result.join('\n')
}
