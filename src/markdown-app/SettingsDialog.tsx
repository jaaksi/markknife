import { useEffect, useState, type ReactNode } from 'react'
import { X as XIcon } from '@phosphor-icons/react'
import { Button } from '../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Slider } from '../components/ui/slider'
import { isMac } from '../utils/platform'
import {
  READING_PREFERENCE_RANGES,
  useReadingPreferences,
  type ContentWidthMode,
} from './useReadingPreferences'
import type { AppUpdate } from './useAppUpdate'
import { useTocPreferences, type TocPosition } from './useTocPreferences'
import { useEditorPreferences } from './useEditorPreferences'
import { READING_STYLES, useReadingStyle } from './useReadingStyle'
import {
  comboToCaps,
  eventToCombo,
  isValidShortcut,
  SHORTCUT_ACTIONS,
  useShortcuts,
  type ShortcutAction,
} from './useShortcuts'
import type { SplitOrientation } from './SplitView'
import { useLanguage, type Translate } from './useLanguage'
import type { Language, MessageKey } from './i18nMessages'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appUpdate: AppUpdate
}

/** 设置页左导航的分区标识。 */
type SettingsPane = 'appearance' | 'styles' | 'language' | 'keys' | 'toc' | 'editor' | 'about'

/** 统一的描边图标外壳:viewBox/描边风格与设计稿内联 SVG 一致(lucide 风格)。 */
function StrokeIcon({ className = 'size-4', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** 左导航各项的图标(与设计稿 SVG 路径一一对应)。 */
const PANE_ICONS: Record<SettingsPane, ReactNode> = {
  appearance: (
    <StrokeIcon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </StrokeIcon>
  ),
  styles: (
    <StrokeIcon>
      <circle cx="13.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="12" r="2.5" />
      <circle cx="8.5" cy="7.5" r="2.5" />
      <circle cx="6.5" cy="13" r="2.5" />
      <path d="M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22z" />
    </StrokeIcon>
  ),
  language: (
    <StrokeIcon>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </StrokeIcon>
  ),
  keys: (
    <StrokeIcon>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
    </StrokeIcon>
  ),
  toc: (
    <StrokeIcon>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </StrokeIcon>
  ),
  editor: (
    <StrokeIcon>
      <rect x="3" y="4" width="9" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" opacity="0.4" />
    </StrokeIcon>
  ),
  about: (
    <StrokeIcon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </StrokeIcon>
  ),
}

const NAV_ITEMS: ReadonlyArray<{ key: SettingsPane; labelKey: MessageKey }> = [
  { key: 'appearance', labelKey: 'settings.nav.appearance' },
  { key: 'styles', labelKey: 'settings.nav.styles' },
  { key: 'language', labelKey: 'settings.nav.language' },
  { key: 'keys', labelKey: 'settings.nav.keys' },
  { key: 'toc', labelKey: 'settings.nav.toc' },
  { key: 'editor', labelKey: 'settings.nav.editor' },
  { key: 'about', labelKey: 'settings.nav.about' },
]

/** 分区标题(小号大写标签)。 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mt-1 mb-1.5 text-[11px] font-bold tracking-[0.07em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/** 分段控件(shadcn 风格 segmented):轨道用 muted,选中态白底浮起。 */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; labelKey: MessageKey }>
  ariaLabel: string
}) {
  const { t } = useLanguage()
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-[9px] border border-border bg-muted p-0.5"
    >
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt.value)}
            className={`rounded-[7px] px-3 py-[5px] text-[12.5px] transition-colors ${
              on ? 'bg-white font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        )
      })}
    </div>
  )
}

/** 极简开关(role=switch):无 shadcn Switch 组件时的本地实现,沿用设计稿尺寸。 */
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[23px] w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-[19px] rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[17px]' : ''}`}
      />
    </button>
  )
}

/** 一行设置项:左标题 + 说明,右控件。 */
function SettingRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-[13px]">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

const WIDTH_MODES: ReadonlyArray<{ value: ContentWidthMode; labelKey: MessageKey }> = [
  { value: 'limited', labelKey: 'settings.appearance.widthLimited' },
  { value: 'full', labelKey: 'settings.appearance.widthFull' },
]

const COLOR_MODES: ReadonlyArray<{ value: 'system' | 'light' | 'dark'; labelKey: MessageKey }> = [
  { value: 'system', labelKey: 'colorMode.system' },
  { value: 'light', labelKey: 'colorMode.light' },
  { value: 'dark', labelKey: 'colorMode.dark' },
]

// 深色模式入口暂不展示:实现已保留,接入全局主题切换后把此开关改为 true 即可放出。
const SHOW_COLOR_MODE_SETTING = false

/** 「外观」面板:内容宽度 / 字号 / 行高滑块(深色模式入口暂隐藏)。 */
function AppearancePane() {
  const { t } = useLanguage()
  const { preferences, setPreference, setWidthMode } = useReadingPreferences()
  const [colorMode, setColorMode] = useState<'system' | 'light' | 'dark'>('light')

  const widthRange = READING_PREFERENCE_RANGES.maxWidth
  // 仅「限制宽度」模式下「最大宽度」才有意义;「铺满窗口」时滑块灰显禁用。
  const limited = preferences.widthMode === 'limited'

  return (
    <section>
      <SectionLabel>{t('settings.appearance.section')}</SectionLabel>
      <div className="divide-y divide-border">
        <SettingRow title={t('settings.appearance.widthMode')} description={t('settings.appearance.widthModeDesc')}>
          <Segmented
            ariaLabel={t('settings.appearance.widthMode')}
            value={preferences.widthMode}
            onChange={setWidthMode}
            options={WIDTH_MODES}
          />
        </SettingRow>
        <SettingRow title={t('settings.appearance.maxWidth')} description={t('settings.appearance.maxWidthDesc')}>
          <span
            className={`w-14 shrink-0 text-right text-[13px] font-semibold tabular-nums ${limited ? 'text-primary' : 'text-muted-foreground/50'}`}
          >
            {`${preferences.maxWidth}px`}
          </span>
          <div className="w-[180px] shrink-0">
            <Slider
              value={[preferences.maxWidth]}
              min={widthRange.min}
              max={widthRange.max}
              step={widthRange.step}
              disabled={!limited}
              onValueChange={(next) => setPreference('maxWidth', next[0] ?? preferences.maxWidth)}
              aria-label={t('settings.appearance.maxWidth')}
            />
          </div>
        </SettingRow>
        {SHOW_COLOR_MODE_SETTING && (
          <SettingRow title={t('settings.appearance.colorMode')} description={t('settings.appearance.colorModeDesc')}>
            <Segmented ariaLabel={t('settings.appearance.colorMode')} value={colorMode} onChange={setColorMode} options={COLOR_MODES} />
          </SettingRow>
        )}
      </div>
    </section>
  )
}

/** 「样式」面板:阅读样式卡片画廊(默认 / 护眼 / 衬线 / Nord / 玫瑰 / 深色)。 */
function StylesPane() {
  const { t } = useLanguage()
  const { style, setStyleId } = useReadingStyle()
  return (
    <section>
      <SectionLabel>{t('settings.styles.section')}</SectionLabel>
      <p className="m-0 mb-1 text-[12.5px] text-muted-foreground">{t('settings.styles.desc')}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-3">
        {READING_STYLES.map((item) => {
          const active = style.id === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setStyleId(item.id)}
              className={`rounded-xl border-[1.5px] p-2.5 text-left transition-colors ${
                active ? 'border-primary ring-[3px] ring-primary/15' : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              <div
                className="flex h-[76px] flex-col gap-[5px] rounded-lg border border-border/60 p-[9px]"
                style={{ background: item.swatch.bg, fontFamily: item.swatch.serif ? 'Georgia, serif' : undefined }}
              >
                <span className="h-1.5 w-3/5 rounded-full" style={{ background: item.swatch.heading }} />
                <span className="h-1.5 w-[90%] rounded-full" style={{ background: item.swatch.fg, opacity: 0.5 }} />
                <span className="h-1.5 w-[80%] rounded-full" style={{ background: item.swatch.fg, opacity: 0.5 }} />
                <span className="h-1.5 w-[88%] rounded-full" style={{ background: item.swatch.fg, opacity: 0.5 }} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-foreground">{t(item.labelKey)}</span>
                {active && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const LANGUAGES: ReadonlyArray<{ code: Language; flag: string; name: string; subKey: MessageKey }> = [
  { code: 'zh-CN', flag: '🇨🇳', name: '简体中文', subKey: 'lang.zh-CN.sub' },
  { code: 'en', flag: '🇺🇸', name: 'English', subKey: 'lang.en.sub' },
]

/** 「语言」面板:界面语言单选列表(真实切换,目前支持简体中文 / 英文)。 */
function LanguagePane() {
  const { t, language, setLanguage } = useLanguage()
  return (
    <section>
      <SectionLabel>{t('settings.language.section')}</SectionLabel>
      <div className="mt-1 flex flex-col gap-0.5">
        {LANGUAGES.map((item) => {
          const on = item.code === language
          return (
            <button
              key={item.code}
              type="button"
              aria-pressed={on}
              onClick={() => setLanguage(item.code)}
              className={`flex h-11 items-center gap-3 rounded-[9px] px-3 text-left ${on ? 'bg-primary/10' : 'hover:bg-muted'}`}
            >
              <span className="w-[26px] text-center text-[17px]" aria-hidden="true">
                {item.flag}
              </span>
              <span className="flex-1 text-[13.5px] font-semibold text-foreground">
                {item.name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t(item.subKey)}</span>
              </span>
              <span
                className={`relative size-[18px] shrink-0 rounded-full border-2 ${on ? 'border-primary' : 'border-border'}`}
              >
                {on && <span className="absolute inset-[3px] rounded-full bg-primary" />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** 「快捷键」面板:每个动作一行,点 ✎ 进入录制态,按下新组合键写回(Esc 取消)。 */
function KeysPane() {
  const { t } = useLanguage()
  const { shortcuts, setBinding } = useShortcuts()
  const [recording, setRecording] = useState<ShortcutAction | null>(null)
  const mac = isMac()

  // 录制中:捕获下一个有效组合键写回,Esc 取消。
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      const combo = eventToCombo(e)
      if (combo && isValidShortcut(combo)) {
        setBinding(recording, combo)
        setRecording(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, setBinding])

  return (
    <section>
      <SectionLabel>{t('settings.keys.section')}</SectionLabel>
      <p className="m-0 mb-1 text-[12.5px] text-muted-foreground">{t('settings.keys.hint')}</p>
      <div className="divide-y divide-border">
        {SHORTCUT_ACTIONS.map(({ action, labelKey, detailKey }) => {
          const isRec = recording === action
          const label = t(labelKey)
          return (
            <div key={action} className="flex items-center gap-3 py-[11px]">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13.5px] font-semibold text-foreground">{label}</p>
                {detailKey && <p className="m-0 mt-px text-xs text-muted-foreground">{t(detailKey)}</p>}
              </div>
              {isRec ? (
                <span className="rounded-[7px] border border-dashed border-primary bg-primary/10 px-2.5 py-[5px] text-[12.5px] font-semibold text-primary">
                  {t('settings.keys.recording')}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-[3px]">
                  {comboToCaps(shortcuts[action], mac).map((cap, i) => (
                    <kbd
                      key={i}
                      className="inline-flex h-[26px] min-w-6 items-center justify-center rounded-md border border-border border-b-2 bg-muted px-[7px] font-mono text-xs font-semibold text-foreground"
                    >
                      {cap}
                    </kbd>
                  ))}
                </span>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
                aria-label={isRec ? t('settings.keys.cancelAria') : t('settings.keys.recordAria', { label })}
                onClick={() => setRecording(isRec ? null : action)}
              >
                {isRec ? (
                  <XIcon aria-hidden="true" />
                ) : (
                  <StrokeIcon className="size-[15px]">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </StrokeIcon>
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const TOC_POSITIONS: ReadonlyArray<{ value: TocPosition; labelKey: MessageKey }> = [
  { value: 'left', labelKey: 'toc.position.left' },
  { value: 'right', labelKey: 'toc.position.right' },
]

/** 「目录」面板:默认显示开关 + 目录位置(左 / 右)。 */
function TocPane() {
  const { t } = useLanguage()
  const { preferences, setDefaultVisible, setPosition } = useTocPreferences()
  return (
    <section>
      <SectionLabel>{t('settings.toc.section')}</SectionLabel>
      <div className="divide-y divide-border">
        <SettingRow title={t('settings.toc.defaultVisible')} description={t('settings.toc.defaultVisibleDesc')}>
          <ToggleSwitch
            checked={preferences.defaultVisible}
            onChange={setDefaultVisible}
            label={t('settings.toc.defaultVisible')}
          />
        </SettingRow>
        <SettingRow title={t('settings.toc.position')} description={t('settings.toc.positionDesc')}>
          <Segmented
            ariaLabel={t('settings.toc.position')}
            value={preferences.position}
            onChange={setPosition}
            options={TOC_POSITIONS}
          />
        </SettingRow>
      </div>
    </section>
  )
}

const SPLIT_ORIENTATIONS: ReadonlyArray<{ value: SplitOrientation; labelKey: MessageKey }> = [
  { value: 'source-left', labelKey: 'split.sourceLeft' },
  { value: 'preview-left', labelKey: 'split.previewLeft' },
]

/** 「编辑」面板:分栏方向(编辑区与预览区的左右排列)。 */
function EditorPane() {
  const { t } = useLanguage()
  const { preferences, setSplitOrientation } = useEditorPreferences()
  return (
    <section>
      <SectionLabel>{t('settings.editor.section')}</SectionLabel>
      <div className="divide-y divide-border">
        <SettingRow title={t('settings.editor.splitOrientation')} description={t('settings.editor.splitOrientationDesc')}>
          <Segmented
            ariaLabel={t('settings.editor.splitOrientation')}
            value={preferences.splitOrientation}
            onChange={setSplitOrientation}
            options={SPLIT_ORIENTATIONS}
          />
        </SettingRow>
      </div>
    </section>
  )
}

/** 更新区块主标签:随更新状态机变化。 */
function updateRowLabel(appUpdate: AppUpdate, t: Translate): string {
  switch (appUpdate.status) {
    case 'available':
      return appUpdate.meta
        ? t('update.label.availableVersion', { version: appUpdate.meta.version })
        : t('update.label.available')
    case 'downloading':
      return t('update.label.downloading')
    case 'ready':
      return t('update.label.ready')
    case 'upToDate':
      return t('update.label.upToDate')
    case 'error':
      return t('update.label.error')
    default:
      return t('update.label.checkApp')
  }
}

/** 更新区块副说明。 */
function updateRowDetail(appUpdate: AppUpdate, t: Translate): string | undefined {
  if (appUpdate.status === 'ready') return t('update.detail.ready')
  if (appUpdate.status === 'error') return appUpdate.error ?? undefined
  if (appUpdate.status === 'available' && appUpdate.meta) {
    return t('update.detail.current', { version: appUpdate.meta.currentVersion })
  }
  return undefined
}

/** 更新区块右侧操作按钮:按状态显示「检查更新 / 立即更新 / 立即重启」。 */
function UpdateRowAction({ appUpdate }: { appUpdate: AppUpdate }) {
  const { t } = useLanguage()
  const { status, check, install, relaunchApp } = appUpdate
  if (status === 'available') {
    return (
      <Button type="button" size="sm" onClick={() => void install()}>
        {t('update.action.update')}
      </Button>
    )
  }
  if (status === 'ready') {
    return (
      <Button type="button" size="sm" onClick={() => void relaunchApp()}>
        {t('update.action.relaunch')}
      </Button>
    )
  }
  const busy = status === 'checking' || status === 'downloading'
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void check()}>
      {status === 'checking'
        ? t('update.action.checking')
        : status === 'downloading'
          ? t('update.action.downloading')
          : t('update.action.check')}
    </Button>
  )
}

/** 「关于 / 更新」面板:应用更新链路(检查 / 下载 / 重启)。 */
function AboutPane({ appUpdate }: { appUpdate: AppUpdate }) {
  const { t } = useLanguage()
  const detail = updateRowDetail(appUpdate, t)
  return (
    <section>
      <SectionLabel>{t('settings.about.section')}</SectionLabel>
      <div className="flex items-center gap-4 py-[13px]">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-foreground">{updateRowLabel(appUpdate, t)}</p>
          {detail && <p className="m-0 mt-0.5 text-xs break-words text-muted-foreground">{detail}</p>}
        </div>
        <div className="shrink-0">
          <UpdateRowAction appUpdate={appUpdate} />
        </div>
      </div>
    </section>
  )
}

/** 设置弹窗:左导航 + 右面板两栏布局,按设计稿 1:1 还原。 */
export function SettingsDialog({ open, onOpenChange, appUpdate }: SettingsDialogProps) {
  const { t } = useLanguage()
  const { reset } = useReadingPreferences()
  const [pane, setPane] = useState<SettingsPane>('appearance')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[560px] w-[720px] max-h-[calc(100vh-56px)] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-[calc(100%-2rem)]"
      >
        {/* 渐变标题栏:品牌蓝 → 紫,与设计稿一致。 */}
        <div
          className="flex shrink-0 items-center gap-[14px] px-[22px] py-[18px] text-white"
          style={{ background: 'linear-gradient(135deg, #5b86ff, #8b5cf6)' }}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-white/15">
            <StrokeIcon className="size-[22px]">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </StrokeIcon>
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[18px] font-bold text-white">{t('settings.title')}</DialogTitle>
            <DialogDescription className="mt-0.5 text-[12.5px] text-white/80">
              {t('settings.subtitle')}
            </DialogDescription>
          </div>
          <DialogClose
            aria-label={t('settings.close')}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors hover:bg-white/25 focus-visible:outline-none"
          >
            <XIcon className="size-[15px]" aria-hidden="true" />
          </DialogClose>
        </div>

        {/* 主体:左导航 + 右面板 */}
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[168px] shrink-0 flex-col gap-px border-r border-border bg-[#f7f6f3] px-2 py-2.5">
            {NAV_ITEMS.map((item) => {
              const on = pane === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPane(item.key)}
                  className={`flex h-[34px] items-center gap-[9px] rounded-lg px-2.5 text-[13px] transition-colors ${
                    on
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {PANE_ICONS[item.key]}
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[22px]">
            {pane === 'appearance' && <AppearancePane />}
            {pane === 'styles' && <StylesPane />}
            {pane === 'language' && <LanguagePane />}
            {pane === 'keys' && <KeysPane />}
            {pane === 'toc' && <TocPane />}
            {pane === 'editor' && <EditorPane />}
            {pane === 'about' && <AboutPane appUpdate={appUpdate} />}
          </div>
        </div>

        {/* 底部:恢复默认(重置外观偏好) */}
        <div className="flex shrink-0 justify-end border-t border-border px-[22px] py-[11px]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[13px] text-muted-foreground"
            onClick={reset}
          >
            {t('settings.reset')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
