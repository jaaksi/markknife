import { useCallback, useEffect, useRef, useState } from 'react'
import { Toolbar, type AppMode } from './Toolbar'
import { MarkdownReadonlyView } from './MarkdownReadonlyView'
import { MarkdownEditableView } from './MarkdownEditableView'
import { SplitView, type SplitOrientation } from './SplitView'
import { SettingsDialog } from './SettingsDialog'
import { UpdateDialog } from './UpdateDialog'
import { useAppUpdate } from './useAppUpdate'
import { ReadingPreferencesProvider } from './useReadingPreferences'
import { ReadingStyleProvider } from './useReadingStyle'
import { TocPreferencesProvider, useTocPreferences } from './useTocPreferences'
import { EditorPreferencesProvider, useEditorPreferences } from './useEditorPreferences'
import { ShortcutsProvider, useShortcuts, eventToCombo } from './useShortcuts'
import { LanguageProvider, useLanguage } from './useLanguage'
import { TocPanel, TocReopenRail } from './TocPanel'
import { useTocHeadings } from './useTocHeadings'
import { useOpenWithFile } from './useOpenWithFile'
import { isTauri } from '../mock-tauri'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { StartPage } from './StartPage'
import { useRecentFiles } from './useRecentFiles'
import {
  basenameOf,
  createMarkdownFile,
  dirnameOf,
  openMarkdownFile,
  readMarkdownFile,
  writeMarkdownFile,
} from './fileIo'

/** 内容变更后多久自动落盘。 */
const AUTOSAVE_DEBOUNCE_MS = 800

/**
 * 单文件 Markdown 查看 / 编辑应用外壳。
 * 唯一真相源是内存中的 `markdown` 字符串；三种表面都读 / 写它。
 */
function MarkdownAppInner() {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<AppMode>('view')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 保存结果反馈(界面内 toast):成功「已保存」/ 失败显示错误。
  const [saveFeedback, setSaveFeedback] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  // 有未保存改动时关闭窗口的「是否保存」确认弹窗。
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const { t } = useLanguage()
  const appUpdate = useAppUpdate()
  const checkAppUpdate = appUpdate.check
  // 最近打开历史(起始页展示);打开 / 加载 / 新建文件后都会记录。
  const recentFiles = useRecentFiles()
  const recordRecent = recentFiles.record
  // 可自定义快捷键:combo → 动作 的反查表,供下方键盘分发。
  const { comboLookup } = useShortcuts()

  // 分栏方向是持久化偏好(设置页可改),默认左编辑右预览。
  const { preferences: editorPrefs } = useEditorPreferences()
  const splitOrientation = editorPrefs.splitOrientation

  const { preferences: tocPrefs } = useTocPreferences()
  const [tocCollapsed, setTocCollapsed] = useState(!tocPrefs.defaultVisible)
  // 每完成一次文件加载自增,确保「重开同一路径」也能触发目录重置(filePath 值不变时也会变)。
  const [loadNonce, setLoadNonce] = useState(0)
  const toc = useTocHeadings(`${mode}-${filePath ?? ''}`)
  const hasHeadings = toc.headings.length > 0
  // 选择「每次都按默认显示」:每次加载文件(含重开同一文件)、标题首次出现、或改默认设置,
  // 都回到默认状态(不记忆运行时的临时收起)。用「记录上一次触发键 + 变化时在渲染期重置」
  // 取代 effect 内 setState,避免级联渲染(react-hooks/set-state-in-effect)。
  const tocResetKey = `${loadNonce}|${tocPrefs.defaultVisible}|${hasHeadings}`
  const [prevTocResetKey, setPrevTocResetKey] = useState(tocResetKey)
  if (prevTocResetKey !== tocResetKey) {
    setPrevTocResetKey(tocResetKey)
    setTocCollapsed(!tocPrefs.defaultVisible)
  }

  // 保存闭包通过 ref 读取最新内容，避免陈旧闭包。
  const markdownRef = useRef(markdown)
  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])
  const filePathRef = useRef(filePath)
  useEffect(() => {
    filePathRef.current = filePath
  }, [filePath])
  // 关闭窗口时需读取最新「是否有未保存改动」。
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  // 当前窗口句柄与「已确认关闭」标志(确认后再次 close 直接放行,避免再弹框)。
  const windowRef = useRef<{ close: () => Promise<void> } | null>(null)
  const closeConfirmedRef = useRef(false)

  const vaultPath = filePath ? dirnameOf(filePath) : undefined

  const doSave = useCallback(async () => {
    const path = filePathRef.current
    if (!path) {
      setSaveFeedback({ kind: 'error', text: t('app.toast.noFile') })
      return
    }
    try {
      await writeMarkdownFile(path, markdownRef.current)
      setDirty(false)
      setSaveFeedback({ kind: 'saved', text: t('app.toast.saved') })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[markdown-app] 保存失败:', error)
      setSaveFeedback({ kind: 'error', text: t('app.toast.saveFailed', { message }) })
    }
  }, [t])

  // 打开一份内容到编辑器:重置状态、记入最近打开、触发目录重置。
  const adoptOpenedFile = useCallback(
    (path: string, content: string) => {
      setFilePath(path)
      setMarkdown(content)
      setDirty(false)
      setMode('view')
      setLoadNonce((nonce) => nonce + 1)
      recordRecent(path, basenameOf(path))
    },
    [recordRecent],
  )

  // 载入指定路径的文件（应用内对话框、系统打开方式、双击、历史记录均复用此入口）。
  const loadPath = useCallback(
    async (path: string) => {
      try {
        const content = await readMarkdownFile(path)
        adoptOpenedFile(path, content)
      } catch (error) {
        console.error('[markdown-app] 加载文件失败:', error)
      }
    },
    [adoptOpenedFile],
  )

  const handleOpen = useCallback(async () => {
    try {
      const opened = await openMarkdownFile()
      if (!opened) return
      adoptOpenedFile(opened.path, opened.content)
    } catch (error) {
      console.error('[markdown-app] 打开文件失败:', error)
    }
  }, [adoptOpenedFile])

  // 新建空文件:弹保存框 → 写空内容 → 打开。
  const handleNew = useCallback(async () => {
    try {
      const created = await createMarkdownFile()
      if (!created) return
      adoptOpenedFile(created.path, created.content)
    } catch (error) {
      console.error('[markdown-app] 新建文件失败:', error)
    }
  }, [adoptOpenedFile])

  // 关闭确认框:保存后关 / 不保存直接关(置确认标志后 close 会被放行)。
  const confirmSaveAndClose = useCallback(async () => {
    await doSave()
    closeConfirmedRef.current = true
    setCloseDialogOpen(false)
    await windowRef.current?.close()
  }, [doSave])
  const confirmDiscardAndClose = useCallback(async () => {
    closeConfirmedRef.current = true
    setCloseDialogOpen(false)
    await windowRef.current?.close()
  }, [])

  // 系统「打开方式 / 双击」传入的文件（冷启动领取 + 运行时事件）。
  useOpenWithFile(loadPath)

  const handleMarkdownChange = useCallback((content: string) => {
    setMarkdown((prev) => (prev === content ? prev : content))
    setDirty(true)
  }, [])

  // 防抖自动保存
  useEffect(() => {
    if (!filePath || !dirty) return
    const handle = setTimeout(() => {
      void doSave()
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [markdown, dirty, filePath, doSave])

  // 全局快捷键:可在设置里自定义的动作走 comboLookup 分发;Cmd/Ctrl+, 打开设置为固定键。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      // 设置弹窗固定快捷键(不参与自定义,确保始终可达)。
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
        return
      }
      const combo = eventToCombo(event)
      if (!combo) return
      const action = comboLookup[combo]
      if (!action) return
      event.preventDefault()
      switch (action) {
        case 'save':
          void doSave()
          break
        case 'open':
          void handleOpen()
          break
        case 'toggleToc':
          setTocCollapsed((prev) => !prev)
          break
        case 'modeView':
          setMode('view')
          break
        case 'modeWysiwyg':
          setMode('wysiwyg')
          break
        case 'modeSplit':
          setMode('split')
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [doSave, handleOpen, comboLookup])

  // toast 自动消失:成功 2 秒,错误 5 秒。
  useEffect(() => {
    if (!saveFeedback) return
    const handle = setTimeout(() => setSaveFeedback(null), saveFeedback.kind === 'saved' ? 2000 : 5000)
    return () => clearTimeout(handle)
  }, [saveFeedback])

  // 关闭窗口:有未保存改动则拦截并弹「是否保存」确认框;无改动直接放行(非 Tauri 无此事件)。
  useEffect(() => {
    if (!isTauri()) return
    let active = true
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      windowRef.current = win
      return win
        .onCloseRequested((event) => {
          if (closeConfirmedRef.current || !dirtyRef.current) return // 已确认 / 无改动:放行
          event.preventDefault()
          setCloseDialogOpen(true)
        })
        .then((fn) => {
          if (active) unlisten = fn
          else fn()
        })
    })
    return () => {
      active = false
      unlisten?.()
    }
  }, [])

  // 启动后延迟做一次静默更新检查；发现新版会弹出更新提示框（非 Tauri 环境为空操作）。
  useEffect(() => {
    const handle = setTimeout(() => {
      void checkAppUpdate({ silent: true })
    }, 3000)
    return () => clearTimeout(handle)
  }, [checkAppUpdate])

  // 无文件 / 无标题不显示目录。展开时面板在流内占一列;收起时内容占满宽度,
  // 仅在边缘顶部浮出一个小标签(绝对定位,不占布局宽度),与设计原型一致。
  const showToc = Boolean(filePath) && hasHeadings
  const tocPanel =
    showToc && !tocCollapsed ? (
      <TocPanel
        headings={toc.headings}
        activeIndex={toc.activeIndex}
        position={tocPrefs.position}
        onSelect={toc.scrollTo}
        onCollapse={() => setTocCollapsed(true)}
      />
    ) : null

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar
        filePath={filePath}
        dirty={dirty}
        mode={mode}
        onModeChange={setMode}
        onOpen={handleOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="relative flex min-h-0 flex-1">
        {filePath ? (
          <>
            {tocPrefs.position === 'left' && tocPanel}
            <MarkdownWorkspace
              key={`${mode}-${filePath}`}
              mode={mode}
              markdown={markdown}
              filePath={filePath}
              vaultPath={vaultPath}
              splitOrientation={splitOrientation}
              onChange={handleMarkdownChange}
              onSave={() => void doSave()}
            />
            {tocPrefs.position === 'right' && tocPanel}
            {showToc && tocCollapsed && (
              <TocReopenRail position={tocPrefs.position} onExpand={() => setTocCollapsed(false)} />
            )}
          </>
        ) : (
          <StartPage
            recents={recentFiles.recents}
            onOpen={handleOpen}
            onNew={handleNew}
            onOpenRecent={loadPath}
            onRemoveRecent={recentFiles.remove}
            onClearRecents={recentFiles.clear}
          />
        )}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} appUpdate={appUpdate} />
      <UpdateDialog appUpdate={appUpdate} />

      {/* 保存结果 toast:成功「已保存」,失败显示错误,底部居中浮出 */}
      {saveFeedback && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-medium shadow-lg ${
            saveFeedback.kind === 'saved' ? 'bg-foreground text-background' : 'bg-destructive text-white'
          }`}
        >
          {saveFeedback.kind === 'saved' ? `✓ ${saveFeedback.text}` : saveFeedback.text}
        </div>
      )}

      {/* 未保存改动时关闭窗口的确认弹窗 */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>{t('app.close.title')}</DialogTitle>
          <DialogDescription>
            {filePath
              ? t('app.close.descNamed', { name: basenameOf(filePath) })
              : t('app.close.descUnnamed')}
          </DialogDescription>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setCloseDialogOpen(false)}>
              {t('app.close.cancel')}
            </Button>
            <Button variant="outline" onClick={() => void confirmDiscardAndClose()}>
              {t('app.close.discard')}
            </Button>
            <Button onClick={() => void confirmSaveAndClose()}>{t('app.close.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * 应用根组件:挂载阅读 / 目录 / 编辑三个偏好 Provider,内部组件消费它们。
 */
export default function MarkdownApp() {
  return (
    <LanguageProvider>
      <ReadingPreferencesProvider>
        <ReadingStyleProvider>
          <TocPreferencesProvider>
            <EditorPreferencesProvider>
              <ShortcutsProvider>
                <MarkdownAppInner />
              </ShortcutsProvider>
            </EditorPreferencesProvider>
          </TocPreferencesProvider>
        </ReadingStyleProvider>
      </ReadingPreferencesProvider>
    </LanguageProvider>
  )
}

/** 根据当前模式渲染对应的编辑 / 查看表面。 */
function MarkdownWorkspace({
  mode,
  markdown,
  filePath,
  vaultPath,
  splitOrientation,
  onChange,
  onSave,
}: {
  mode: AppMode
  markdown: string
  filePath: string
  vaultPath?: string
  splitOrientation: SplitOrientation
  onChange: (content: string) => void
  onSave: () => void
}) {
  if (mode === 'view') {
    return <MarkdownReadonlyView markdown={markdown} filePath={filePath} vaultPath={vaultPath} />
  }
  if (mode === 'split') {
    return (
      <SplitView
        markdown={markdown}
        filePath={filePath}
        vaultPath={vaultPath}
        orientation={splitOrientation}
        onChange={onChange}
        onSave={onSave}
      />
    )
  }
  return (
    <MarkdownEditableView markdown={markdown} filePath={filePath} vaultPath={vaultPath} onChange={onChange} />
  )
}

