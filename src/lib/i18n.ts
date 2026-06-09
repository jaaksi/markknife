import EN_TRANSLATIONS from './locales/en.json'

const DEFAULT_APP_LOCALE = 'en'
const SYSTEM_UI_LANGUAGE = 'system'

const APP_LOCALES = [
  'en',
  'zh-CN',
] as const

export type AppLocale = typeof APP_LOCALES[number]
type UiLanguagePreference = typeof SYSTEM_UI_LANGUAGE | AppLocale
type TranslationCatalog = typeof EN_TRANSLATIONS
export type TranslationKey = keyof TranslationCatalog
export type TranslationValues = Record<string, string | number>

type LocaleDefinition = {
  code: AppLocale
  dateLocale: string
  labelKey: TranslationKey
  aliases: readonly string[]
  searchKeywords: readonly string[]
}

const LOCALE_DEFINITIONS: Record<AppLocale, LocaleDefinition> = {
  en: {
    code: 'en',
    dateLocale: 'en-US',
    labelKey: 'locale.en',
    aliases: ['en', 'en-us', 'en-gb', 'en-ca', 'en-au'],
    searchKeywords: ['english', 'en'],
  },
  'zh-CN': {
    code: 'zh-CN',
    dateLocale: 'zh-CN',
    labelKey: 'locale.zhCN',
    aliases: ['zh', 'zh-cn', 'zh-hans', 'zh-sg'],
    searchKeywords: ['chinese', 'simplified', 'zh', 'zh-cn', '中文', '简体中文'],
  },
}

const LOCALE_DEFINITION_LOOKUP = new Map<AppLocale, LocaleDefinition>(
  Object.values(LOCALE_DEFINITIONS).map((definition) => [definition.code, definition]),
)
const NORMALIZED_LOCALE_LOOKUP = new Map<string, AppLocale>()
for (const locale of APP_LOCALES) {
  const definition = getLocaleDefinition(locale)
  NORMALIZED_LOCALE_LOOKUP.set(locale.toLowerCase(), locale)
  for (const alias of definition.aliases) {
    NORMALIZED_LOCALE_LOOKUP.set(alias, locale)
  }
}

const LOCALE_MODULES = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, TranslationCatalog>
const TRANSLATIONS: Partial<Record<AppLocale, Partial<Record<TranslationKey, string>>>> = buildTranslations()

function buildTranslations() {
  const translations: Partial<Record<AppLocale, Partial<Record<TranslationKey, string>>>> = {
    en: EN_TRANSLATIONS,
  }

  for (const [path, catalog] of Object.entries(LOCALE_MODULES)) {
    const match = path.match(/\/([^/]+)\.json$/)
    if (!match) continue

    const locale = normalizeLocaleCode(match[1])
    if (!locale || locale === 'en') continue

    Reflect.set(translations, locale, catalog)
  }

  return translations
}

function getLocaleDefinition(locale: AppLocale): LocaleDefinition {
  const definition = LOCALE_DEFINITION_LOOKUP.get(locale)
  if (definition) return definition
  throw new Error(`Unknown locale: ${locale}`)
}

function interpolate(template: string, values: TranslationValues = {}): string {
  const interpolationValues = new Map(Object.entries(values))
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = interpolationValues.get(key)
    return value === undefined ? match : String(value)
  })
}

function localizedInterpolationValues(locale: AppLocale, values?: TranslationValues): TranslationValues | undefined {
  if (!values || locale === 'en' || values.plural === undefined) return values
  return { ...values, plural: '' }
}

export function translate(locale: AppLocale, key: TranslationKey, values?: TranslationValues): string {
  const catalog = Reflect.get(TRANSLATIONS, locale) as Partial<Record<TranslationKey, string>> | undefined
  const template = Reflect.get(catalog ?? {}, key) as string | undefined
  const fallbackTemplate = Reflect.get(EN_TRANSLATIONS, key) as string
  return interpolate(template ?? fallbackTemplate, localizedInterpolationValues(locale, values))
}

export function createTranslator(locale: AppLocale = DEFAULT_APP_LOCALE) {
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values)
}

function normalizeLocaleCode(value: string): AppLocale | null {
  const normalized = value.trim().replaceAll('_', '-').toLowerCase()
  if (!normalized) return null

  const exactMatch = NORMALIZED_LOCALE_LOOKUP.get(normalized)
  if (exactMatch) return exactMatch

  const languageMatches = APP_LOCALES.filter((locale) => locale.toLowerCase().startsWith(`${normalized}-`))
  return languageMatches.length === 1 ? languageMatches[0] : null
}

function normalizeUiLanguagePreference(value: unknown): UiLanguagePreference | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === SYSTEM_UI_LANGUAGE || lower === 'auto') return SYSTEM_UI_LANGUAGE
  return normalizeLocaleCode(trimmed)
}

function getBrowserLanguagePreferences(): string[] {
  if (typeof navigator === 'undefined') return []
  const languages = Array.isArray(navigator.languages) ? navigator.languages : []
  if (languages.length > 0) return [...languages]
  return navigator.language ? [navigator.language] : []
}

export function resolveEffectiveLocale(
  preference: unknown,
  languagePreferences: readonly string[] = getBrowserLanguagePreferences(),
): AppLocale {
  const normalizedPreference = normalizeUiLanguagePreference(preference)
  if (normalizedPreference && normalizedPreference !== SYSTEM_UI_LANGUAGE) {
    return normalizedPreference
  }

  for (const language of languagePreferences) {
    const locale = normalizeLocaleCode(language)
    if (locale) return locale
  }

  return DEFAULT_APP_LOCALE
}
