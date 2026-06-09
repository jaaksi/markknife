import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import type { AppUpdate } from './useAppUpdate'
import { useLanguage } from './useLanguage'

/** 把字节数格式化为 MB，便于展示下载进度。 */
function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 下载进度条：有总大小时显示百分比，否则显示忙碌态文案。 */
function DownloadProgress({ downloaded, total }: { downloaded: number; total: number | null }) {
  const { t } = useLanguage()
  const percent = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: percent === null ? '40%' : `${percent}%` }}
        />
      </div>
      <p className="m-0 mt-2 text-[13px] text-muted-foreground">
        {percent === null
          ? t('updateDialog.downloadingBusy', { size: formatMb(downloaded) })
          : t('updateDialog.downloadedPercent', {
              percent,
              size: `${formatMb(downloaded)}${total ? ` / ${formatMb(total)}` : ''}`,
            })}
      </p>
    </div>
  )
}

/**
 * 启动时静默检查发现新版本后弹出的更新提示框。
 * 复用 useAppUpdate 的状态机：发现新版 → 下载中 → 待重启 / 失败。
 */
export function UpdateDialog({ appUpdate }: { appUpdate: AppUpdate }) {
  const { t } = useLanguage()
  const { status, meta, error, downloaded, total, promptOpen, install, relaunchApp, dismiss } = appUpdate

  return (
    <Dialog open={promptOpen} onOpenChange={(next) => { if (!next && status !== 'downloading') dismiss() }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={status !== 'downloading'}
        onEscapeKeyDown={(event) => { if (status === 'downloading') event.preventDefault() }}
        onInteractOutside={(event) => { if (status === 'downloading') event.preventDefault() }}
      >
        {status === 'ready' ? (
          <>
            <DialogTitle>{t('updateDialog.readyTitle')}</DialogTitle>
            <DialogDescription>
              {t('updateDialog.readyDesc')}
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={dismiss}>
                {t('updateDialog.later')}
              </Button>
              <Button type="button" onClick={() => void relaunchApp()}>
                {t('updateDialog.relaunch')}
              </Button>
            </div>
          </>
        ) : status === 'error' ? (
          <>
            <DialogTitle>{t('updateDialog.errorTitle')}</DialogTitle>
            <DialogDescription className="break-words">{error ?? t('updateDialog.unknownError')}</DialogDescription>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" onClick={dismiss}>
                {t('updateDialog.close')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>
              {meta ? t('updateDialog.availableTitleVersion', { version: meta.version }) : t('updateDialog.availableTitle')}
            </DialogTitle>
            <DialogDescription>
              {meta
                ? t('updateDialog.availableDescVersion', { current: meta.currentVersion, version: meta.version })
                : t('updateDialog.availableDesc')}
            </DialogDescription>
            {meta?.body ? (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 text-[13px] whitespace-pre-wrap text-foreground/90">
                {meta.body}
              </div>
            ) : null}
            {status === 'downloading' && <DownloadProgress downloaded={downloaded} total={total} />}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={dismiss}
                disabled={status === 'downloading'}
              >
                {t('updateDialog.later')}
              </Button>
              <Button type="button" onClick={() => void install()} disabled={status === 'downloading'}>
                {status === 'downloading' ? t('updateDialog.updating') : t('updateDialog.update')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
