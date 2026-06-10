import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { openExternalUrl } from '../utils/url'
import type { AppUpdate } from './useAppUpdate'
import { useLanguage } from './useLanguage'

/** 新版本的发行说明页(GitHub Release 对应 tag)。 */
function releaseNotesUrl(version: string): string {
  return `https://github.com/jaaksi/markknife/releases/tag/v${version}`
}

const DownloadIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const ExternalLinkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

const CloseIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/** 横幅右侧的白底蓝字按钮(对齐 Tolaria 原版「立即更新」样式)。 */
function BannerActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      className="h-7 shrink-0 rounded-lg bg-white px-3 text-[13px] font-semibold text-[#2563eb] shadow-none hover:bg-white/90 focus-visible:ring-white/60"
    >
      {children}
    </Button>
  )
}

/** 下载中:横幅内联的细进度条;拿不到总大小时显示忙碌动画(40% 宽度占位)。 */
function BannerProgress({ downloaded, total }: { downloaded: number; total: number | null }) {
  const { t } = useLanguage()
  const percent = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
        {percent === null ? (
          // 总大小未知:不确定态用脉冲动画,避免静态宽度被误读成「已完成 N%」。
          <div className="h-full w-full animate-pulse rounded-full bg-white/70" />
        ) : (
          // 已知总大小:从真实百分比(起点≈0)平滑增长。
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      <span className="text-[12.5px] text-white/90 tabular-nums">
        {percent === null ? t('updateBanner.downloadingBusy') : t('updateBanner.downloading', { percent })}
      </span>
    </div>
  )
}

/**
 * 启动静默检查发现新版本后,顶部出现的更新横幅(对齐 Tolaria 原版样式,非模态、不打断编辑)。
 * 复用 useAppUpdate 状态机:可用 → 点「立即更新」原地变下载进度 → 完成变「重启」按钮;失败显示错误。
 */
export function UpdateBanner({ appUpdate }: { appUpdate: AppUpdate }) {
  const { t } = useLanguage()
  const { status, meta, error, downloaded, total, promptOpen, install, relaunchApp, dismiss } = appUpdate

  if (!promptOpen || !meta) return null

  return (
    <div
      role="status"
      data-testid="update-banner"
      className="flex h-9 shrink-0 items-center gap-3 bg-[#2563eb] pr-2 pl-3.5 text-white"
    >
      <span className="size-[15px] shrink-0" aria-hidden="true">{DownloadIcon}</span>
      <span className="shrink-0 text-[13px] font-bold">
        {status === 'error'
          ? t('updateBanner.errorTitle')
          : status === 'ready'
            ? t('updateBanner.ready')
            : t('updateBanner.available', { version: meta.version })}
      </span>
      {status === 'error' ? (
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/85" title={error ?? undefined}>
          {error ?? t('updateBanner.unknownError')}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void openExternalUrl(releaseNotesUrl(meta.version))}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-[12.5px] text-white/85 underline-offset-2 hover:text-white hover:underline"
          >
            {t('updateBanner.releaseNotes')}
            <span className="size-3" aria-hidden="true">{ExternalLinkIcon}</span>
          </button>
          <span className="flex-1" />
        </>
      )}
      {status === 'downloading' && <BannerProgress downloaded={downloaded} total={total} />}
      {(status === 'available' || status === 'error') && (
        <BannerActionButton onClick={() => void install()}>
          {status === 'error' ? t('updateBanner.retry') : t('updateBanner.update')}
        </BannerActionButton>
      )}
      {status === 'ready' && (
        <BannerActionButton onClick={() => void relaunchApp()}>
          {t('updateBanner.relaunch')}
        </BannerActionButton>
      )}
      {status !== 'downloading' && (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t('updateBanner.close')}
          onClick={dismiss}
          className="shrink-0 text-white/80 hover:bg-white/15 hover:text-white focus-visible:ring-white/60"
        >
          <span className="size-3.5" aria-hidden="true">{CloseIcon}</span>
        </Button>
      )}
    </div>
  )
}
