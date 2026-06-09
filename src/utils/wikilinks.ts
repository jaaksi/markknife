type MarkdownSource = string
type FrontmatterSplit = [MarkdownSource, MarkdownSource]
type CharacterCount = number

function frontmatterOpeningLength(content: MarkdownSource): CharacterCount | null {
  if (content.startsWith('---\r\n')) return 5
  if (content.startsWith('---\n')) return 4
  return null
}

function precedingLineEndingLength(value: MarkdownSource): CharacterCount {
  return value.startsWith('\r\n') ? 2 : value.startsWith('\n') ? 1 : 0
}

function frontmatterCloseLength(value: MarkdownSource): CharacterCount {
  const lineEndingLength = precedingLineEndingLength(value)
  if (value.endsWith('\r\n')) return lineEndingLength + 5
  if (value.endsWith('\n')) return lineEndingLength + 4
  return lineEndingLength + 3
}

/** Strip YAML frontmatter from markdown, returning [frontmatter, body] */
export function splitFrontmatter(content: MarkdownSource): FrontmatterSplit {
  const openLength = frontmatterOpeningLength(content)
  if (openLength === null) return ['', content]

  const afterOpen = content.slice(openLength)
  const close = afterOpen.match(/(?:^|\r?\n)---(?:\r?\n|$)/)
  if (!close || close.index === undefined) return ['', content]

  const to = openLength + close.index + frontmatterCloseLength(close[0])
  return [content.slice(0, to), content.slice(to)]
}
