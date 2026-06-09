import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import { FrontendReadyMarker } from './components/FrontendReadyMarker'
import { LinuxTitlebar } from './components/LinuxTitlebar'
import { applyStoredThemeMode } from './lib/themeMode'
import { isRecoveredBlockNoteRenderError } from './components/blockNoteRenderRecovery'
import { isMac, shouldUseCustomWindowChrome } from './utils/platform'
import { reloadFrontendOnceIfStartupFailed } from './utils/frontendReady'

const RootApp = lazy(() => import('./markdown-app/App.tsx'))

function dataTransferHasFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files.length > 0) return true
  if (Array.from(dataTransfer.types).includes('Files')) return true

  return Array.from(dataTransfer.items).some((item) => item.kind === 'file')
}

function preventFileDropNavigation(event: DragEvent): void {
  if (!dataTransferHasFiles(event.dataTransfer)) return

  event.preventDefault()
}

document.addEventListener('dragover', preventFileDropNavigation, true)
document.addEventListener('drop', preventFileDropNavigation, true)

// Disable native WebKit context menu in Tauri (WKWebView intercepts right-click
// at native level before React's synthetic events can call preventDefault).
if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
  document.addEventListener('contextmenu', (event) => event.preventDefault(), true)
}

if (shouldUseCustomWindowChrome()) {
  document.body.classList.add('custom-window-chrome')
}

if (isMac()) {
  document.body.classList.add('mac-chrome')
}

applyStoredThemeMode(document, window.localStorage)

function isResizeObserverLoopError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ResizeObserver loop completed with undelivered notifications')
    || message.includes('ResizeObserver loop limit exceeded')
}

function showFatalRenderError(
  error: unknown,
  errorInfo: { componentStack?: string },
): void {
  const existing = document.getElementById('markknife-fatal-render-error')
  const overlay = existing ?? document.createElement('pre')
  overlay.id = 'markknife-fatal-render-error'
  overlay.style.cssText = [
    'position:fixed',
    'inset:24px',
    'z-index:2147483647',
    'overflow:auto',
    'margin:0',
    'padding:16px',
    'border-radius:8px',
    'background:#1f1f1f',
    'color:#fff',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'white-space:pre-wrap',
  ].join(';')

  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  overlay.textContent = [
    'Markknife render error',
    '',
    message,
    '',
    errorInfo.componentStack ?? '',
  ].join('\n')
  document.body.appendChild(overlay)
}

function captureReactRootError(
  error: unknown,
  errorInfo: { componentStack?: string },
): void {
  if (isResizeObserverLoopError(error)) return

  showFatalRenderError(error, { componentStack: errorInfo.componentStack ?? '' })
  reloadFrontendOnceIfStartupFailed()
}

function captureRecoverableReactRootError(
  error: unknown,
  errorInfo: { componentStack?: string },
): void {
  const componentStack = errorInfo.componentStack ?? ''
  if (isResizeObserverLoopError(error)) return
  if (isRecoveredBlockNoteRenderError(error, componentStack)) return

  captureReactRootError(error, { componentStack })
}

createRoot(document.getElementById('root')!, {
  onCaughtError: captureRecoverableReactRootError,
  onUncaughtError: captureReactRootError,
  onRecoverableError: captureRecoverableReactRootError,
}).render(
  <StrictMode>
    <TooltipProvider>
      <LinuxTitlebar />
      <Suspense fallback={null}>
        <RootApp />
        <FrontendReadyMarker />
      </Suspense>
    </TooltipProvider>
  </StrictMode>,
)
