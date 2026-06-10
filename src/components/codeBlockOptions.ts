import { codeBlockOptions } from '@blocknote/code-block'
import type { CodeBlockOptions } from '@blocknote/core'
import {
  canonicalKnownCodeBlockLanguage,
  codeBlockLanguageOptions,
  EXTRA_CODE_BLOCK_LANGUAGES,
  GO_CODE_BLOCK_LANGUAGE,
} from '../utils/codeBlockLanguageCatalog'
import { supportsModernRegexFeatures } from '../utils/regexCapabilities'

const LIGHT_CODE_THEME = 'github-light'
const DARK_CODE_THEME = 'github-dark'
const GO_LANGUAGE_REGISTRATION = {
  name: 'go',
  displayName: 'Go',
  scopeName: 'source.go',
  aliases: ['golang'],
  patterns: [
    { include: '#comments' },
    { include: '#strings' },
    { include: '#keywords' },
    { include: '#numbers' },
  ],
  repository: {
    comments: {
      patterns: [
        { begin: '/\\*', end: '\\*/', name: 'comment.block.go' },
        { begin: '//', end: '$', name: 'comment.line.double-slash.go' },
      ],
    },
    keywords: {
      patterns: [
        {
          match: '\\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\\b',
          name: 'keyword.control.go',
        },
      ],
    },
    numbers: {
      patterns: [
        { match: '\\b0[xX][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(\\.\\d[\\d_]*)?\\b', name: 'constant.numeric.go' },
      ],
    },
    strings: {
      patterns: [
        { begin: '"', end: '"', name: 'string.quoted.double.go' },
        { begin: '`', end: '`', name: 'string.quoted.raw.go' },
      ],
    },
  },
}

type MarkknifeCodeHighlighter = Awaited<ReturnType<NonNullable<typeof codeBlockOptions.createHighlighter>>>
type MarkknifeLoadLanguage = MarkknifeCodeHighlighter['loadLanguage']
type MarkknifeLanguageInput = Parameters<MarkknifeLoadLanguage>[number]
type MarkknifeLanguageLoader = () => Promise<MarkknifeLanguageInput[]>
type MarkknifeNamedLanguageRegistration = Record<string, unknown> & {
  name: string
  displayName?: string
  aliases?: string[]
}

const GO_LANGUAGE = codeBlockLanguageOptions([GO_CODE_BLOCK_LANGUAGE]).go
const EXTRA_SUPPORTED_LANGUAGES = codeBlockLanguageOptions(EXTRA_CODE_BLOCK_LANGUAGES)

/**
 * 让 Shiki 以「双主题」方式输出每个 token:同时写入 --shiki-light / --shiki-dark 两个 CSS 变量、
 * 不写死 color。最终用哪套颜色交给 CSS 按编辑器表面的 data-theme 选(见 EditorTheme.css)。
 * 好处:切换深色 / 阅读样式时纯靠 CSS 重新着色、无需重新高亮——从而规避 prosemirror-highlight
 * 的装饰缓存(首次高亮的主题会被缓存,切到另一模式时颜色对不上:浅色背景出现深色配色等)。
 */
function withDualThemeTokens(
  highlighter: MarkknifeCodeHighlighter,
): MarkknifeCodeHighlighter['codeToTokens'] {
  return ((code, options) => {
    const next = { ...(options ?? {}) } as Record<string, unknown>
    delete next.theme // 单主题与双主题选项互斥,去掉调用方传入的 theme
    return highlighter.codeToTokens(code, {
      ...next,
      themes: { light: LIGHT_CODE_THEME, dark: DARK_CODE_THEME },
      defaultColor: false,
    } as Parameters<MarkknifeCodeHighlighter['codeToTokens']>[1])
  }) as MarkknifeCodeHighlighter['codeToTokens']
}

function languageInputs(languages: readonly MarkknifeLanguageInput[]): MarkknifeLanguageInput[] {
  return [...languages]
}

function namedLanguageRegistration(value: MarkknifeLanguageInput): MarkknifeNamedLanguageRegistration | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return typeof record.name === 'string'
    ? record as MarkknifeNamedLanguageRegistration
    : null
}

function renameLanguageRegistration(
  languages: readonly MarkknifeLanguageInput[],
  sourceName: string,
  nextLanguage: { name: string; displayName: string; aliases: string[] },
): MarkknifeLanguageInput[] {
  return languages.map((language) => {
    const registration = namedLanguageRegistration(language)
    if (!registration || registration.name !== sourceName) return language
    return { ...registration, ...nextLanguage } as MarkknifeLanguageInput
  })
}

async function loadVbScriptLanguage(): Promise<MarkknifeLanguageInput[]> {
  const language = await import('@shikijs/langs/vb')
  return renameLanguageRegistration(language.default, 'vb', {
    name: 'vbscript',
    displayName: 'VBScript',
    aliases: ['vb', 'vbs', 'vba', 'visual-basic', 'visualbasic'],
  })
}

const EXTRA_LANGUAGE_LOADERS = new Map<string, MarkknifeLanguageLoader>([
  ['powershell', async () => languageInputs((await import('@shikijs/langs/powershell')).default)],
  ['vbscript', loadVbScriptLanguage],
  ['dart', async () => languageInputs((await import('@shikijs/langs/dart')).default)],
  ['groovy', async () => languageInputs((await import('@shikijs/langs/groovy')).default)],
  ['matlab', async () => languageInputs((await import('@shikijs/langs/matlab')).default)],
  ['perl', async () => languageInputs((await import('@shikijs/langs/perl')).default)],
  ['elixir', async () => languageInputs((await import('@shikijs/langs/elixir')).default)],
  ['erlang', async () => languageInputs((await import('@shikijs/langs/erlang')).default)],
  ['fsharp', async () => languageInputs((await import('@shikijs/langs/fsharp')).default)],
  ['clojure', async () => languageInputs((await import('@shikijs/langs/clojure')).default)],
  ['asm', async () => languageInputs((await import('@shikijs/langs/asm')).default)],
  ['zig', async () => languageInputs((await import('@shikijs/langs/zig')).default)],
  ['hcl', async () => languageInputs((await import('@shikijs/langs/hcl')).default)],
  ['terraform', async () => languageInputs((await import('@shikijs/langs/terraform')).default)],
  ['dockerfile', async () => languageInputs((await import('@shikijs/langs/dockerfile')).default)],
  ['batch', async () => languageInputs((await import('@shikijs/langs/bat')).default)],
  ['diff', async () => languageInputs((await import('@shikijs/langs/diff')).default)],
  ['ini', async () => languageInputs((await import('@shikijs/langs/ini')).default)],
  ['toml', async () => languageInputs((await import('@shikijs/langs/toml')).default)],
])

function expandGoLanguage(language: string): MarkknifeLanguageInput[] | null {
  return canonicalKnownCodeBlockLanguage(language) === 'go'
    ? [GO_LANGUAGE_REGISTRATION as MarkknifeLanguageInput]
    : null
}

async function expandExternalLanguage(language: string): Promise<MarkknifeLanguageInput[] | null> {
  const canonicalLanguage = canonicalKnownCodeBlockLanguage(language) ?? language.trim().toLowerCase()
  const loadLanguage = EXTRA_LANGUAGE_LOADERS.get(canonicalLanguage)
  return loadLanguage ? loadLanguage() : null
}

async function expandLanguage(language: MarkknifeLanguageInput): Promise<MarkknifeLanguageInput[]> {
  if (typeof language !== 'string') return [language]
  return expandGoLanguage(language) ?? await expandExternalLanguage(language) ?? [language]
}

async function createMarkknifeCodeHighlighter(): Promise<MarkknifeCodeHighlighter> {
  const highlighter = await codeBlockOptions.createHighlighter()
  return {
    ...highlighter,
    codeToTokens: withDualThemeTokens(highlighter),
    loadLanguage: async (...languages) => {
      const expandedLanguages = await Promise.all(languages.map(expandLanguage))
      return highlighter.loadLanguage(...expandedLanguages.flat())
    },
  }
}

export function createMarkknifeCodeBlockOptions(): Partial<CodeBlockOptions> {
  const options: Partial<CodeBlockOptions> = {
    ...codeBlockOptions,
    createHighlighter: createMarkknifeCodeHighlighter,
    defaultLanguage: 'text',
    supportedLanguages: {
      ...codeBlockOptions.supportedLanguages,
      go: GO_LANGUAGE,
      ...EXTRA_SUPPORTED_LANGUAGES,
    },
  }

  if (supportsModernRegexFeatures()) return options

  delete options.createHighlighter
  return options
}
