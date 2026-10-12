import { Button } from '../components/ui/button'
import type { OpenTab } from './fileChanges'
import { useLanguage } from './useLanguage'

export function ExternalFileBanner({ tab, busy, onActivate, onReload, onSaveCopy, onOverwrite }: {
  tab: OpenTab
  busy: boolean
  onActivate: () => void
  onReload: () => void
  onSaveCopy: () => void
  onOverwrite: () => void
}) {
  const { t } = useLanguage()
  const change = tab.externalChange
  if (!change) return null
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm">
      <div className="min-w-0 basis-full flex-1 break-words sm:basis-auto">
        <p className="font-medium">{t(`fileChange.${change.kind}`, { name: tab.name })}</p>
        <p className="text-xs text-muted-foreground">
          {change.kind === 'unreadable' ? change.message : t('fileChange.paused')}
        </p>
      </div>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onActivate}>{t('fileChange.show')}</Button>
      <Button size="sm" variant="outline" disabled={busy || change.kind !== 'modified'} onClick={onReload}>
        {t('fileChange.reload')}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={onSaveCopy}>{t('fileChange.saveCopy')}</Button>
      <Button size="sm" variant="outline" disabled={busy || change.kind === 'unreadable'} onClick={onOverwrite}>
        {t('fileChange.overwrite')}
      </Button>
    </div>
  )
}
