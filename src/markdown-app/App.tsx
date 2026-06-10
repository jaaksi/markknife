import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toolbar, type AppMode } from './Toolbar'
import type { TabContextActions } from './TabBar'
import { MarkdownReadonlyView } from './MarkdownReadonlyView'
import { MarkdownEditableView } from './MarkdownEditableView'
import { SplitView, type SplitOrientation } from './SplitView'
import { SettingsDialog } from './SettingsDialog'
import { UpdateBanner } from './UpdateBanner'
import { useAppUpdate } from './useAppUpdate'
import { ReadingPreferencesProvider } from './useReadingPreferences'
import { ReadingStyleProvider } from './useReadingStyle'
import { TocPreferencesProvider, useTocPreferences } from './useTocPreferences'
import { EditorPreferencesProvider, useEditorPreferences } from './useEditorPreferences'
import { ShortcutsProvider, useShortcuts, eventToCombo } from './useShortcuts'
import { LanguageProvider, useLanguage } from './useLanguage'
import { TocPanel, TocReopenRail } from './TocPanel'
import { useTocHeadings } from './useTocHeadings'
import { SearchBar } from './SearchBar'
import { useDocumentSearch } from './useDocumentSearch'
import { useOpenWithFile } from './useOpenWithFile'
import { invokeCommand } from './invokeCommand'
import { isTauri } from '../mock-tauri'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { writeClipboardText } from '../utils/clipboardText'
import { StartPage } from './StartPage'
import { useRecentFiles } from './useRecentFiles'
import {
  basenameOf,
  createMarkdownFile,
  dirnameOf,
  openMarkdownFiles,
  readMarkdownFile,
  writeMarkdownFile,
} from './fileIo'

/** 内容变更后多久自动落盘。 */
const AUTOSAVE_DEBOUNCE_MS = 800

/** 一个打开的标签:路径 + 文件名 + 内存内容 + 未保存标记。 */
interface OpenTab {
  path: string
  name: string
  content: string
  dirty: boolean
}

/**
 * 多标签 Markdown 查看 / 编辑应用外壳。
 * 真相源是 `tabs[]`(每个标签各自一份内容)+ `activePath`(当前标签);三种表面读 / 写当前标签。
 */
function MarkdownAppInner() {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [mode, setMode] = useState<AppMode>('wysiwyg')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 保存结果反馈(界面内 toast):成功「已保存」/ 失败显示错误。
  const [saveFeedback, setSaveFeedback] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  // 有未保存改动时关闭窗口的「是否保存」确认弹窗。
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  // 重命名弹窗:目标文件路径(null 表示未打开)+ 输入中的新文件名。
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
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
  // 「打开文件默认在新窗口」偏好:用 ref 读取,避免进入打开相关回调的依赖、引起 useOpenWithFile 反复重绑。
  const openInNewWindowRef = useRef(editorPrefs.openInNewWindow)
  openInNewWindowRef.current = editorPrefs.openInNewWindow

  const { preferences: tocPrefs } = useTocPreferences()
  const [tocCollapsed, setTocCollapsed] = useState(!tocPrefs.defaultVisible)

  // 由标签拆出而新建的窗口(URL 带 detached 标记):创建时是隐藏的,待文件渲染好再显示,避免闪起始页。
  const isDetachedWindow = useMemo(
    () => new URLSearchParams(window.location.search).get('detached') === '1',
    [],
  )

  // 当前标签的派生值,兼容下游(工具栏 / 目录 / 关闭确认)的单值用法。
  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null
  const filePath = activeTab?.path ?? null
  const markdown = activeTab?.content ?? ''
  const vaultPath = filePath ? dirnameOf(filePath) : undefined

  const toc = useTocHeadings(`${mode}-${filePath ?? ''}`)
  const hasHeadings = toc.headings.length > 0

  // 文档内查找(Cmd+F):仅在有文件时可用;搜索富文本渲染区,签名随模式/文件变化。
  const [searchOpen, setSearchOpen] = useState(false)
  const search = useDocumentSearch({
    active: searchOpen && Boolean(filePath),
    signature: `${mode}-${filePath ?? ''}`,
  })
  // 切换 / 重开文件(activePath 变化)、标题首次出现、或改默认设置,都回到目录默认状态
  // (不记忆运行时临时收起)。用「记录上次触发键 + 渲染期重置」取代 effect 内 setState。
  const tocResetKey = `${activePath ?? ''}|${tocPrefs.defaultVisible}|${hasHeadings}`
  const [prevTocResetKey, setPrevTocResetKey] = useState(tocResetKey)
  if (prevTocResetKey !== tocResetKey) {
    setPrevTocResetKey(tocResetKey)
    setTocCollapsed(!tocPrefs.defaultVisible)
  }

  // 保存 / 关闭闭包通过 ref 读取最新标签与当前路径,避免陈旧闭包。
  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])
  const activePathRef = useRef(activePath)
  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])
  // 当前窗口句柄与「已确认关闭」标志(确认后再次 close 直接放行,避免再弹框)。
  const windowRef = useRef<{ close: () => Promise<void> } | null>(null)
  const closeConfirmedRef = useRef(false)

  // 保存指定标签(默认当前标签)。
  const doSave = useCallback(
    async (targetPath?: string) => {
      const path = targetPath ?? activePathRef.current
      const tab = path ? tabsRef.current.find((t) => t.path === path) : undefined
      if (!tab) {
        setSaveFeedback({ kind: 'error', text: t('app.toast.noFile') })
        return
      }
      try {
        await writeMarkdownFile(tab.path, tab.content)
        setTabs((prev) => prev.map((x) => (x.path === tab.path ? { ...x, dirty: false } : x)))
        setSaveFeedback({ kind: 'saved', text: t('app.toast.saved') })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[markdown-app] 保存失败:', error)
        setSaveFeedback({ kind: 'error', text: t('app.toast.saveFailed', { message }) })
      }
    },
    [t],
  )

  // 在标签里打开一份内容:已打开则只激活(不重复、不覆盖正在编辑的内容),否则新增标签。
  const openInTab = useCallback(
    (path: string, content: string) => {
      setTabs((prev) =>
        prev.some((tab) => tab.path === path)
          ? prev
          : [...prev, { path, name: basenameOf(path), content, dirty: false }],
      )
      setActivePath(path)
      // 打开文件默认进入「所见即所得」模式。
      setMode('wysiwyg')
      recordRecent(path, basenameOf(path))
    },
    [recordRecent],
  )

  // 载入指定路径(系统打开方式、双击、历史记录均复用此入口)。
  const loadPath = useCallback(
    async (path: string) => {
      try {
        // 偏好开启且当前窗口已有标签:在新窗口打开。空窗口 / 拆出窗口加载期标签数为 0,仍走当前窗口,不会递归。
        if (openInNewWindowRef.current && tabsRef.current.length > 0) {
          await invokeCommand('detach_tab_to_window', { path })
          return
        }
        const content = await readMarkdownFile(path)
        openInTab(path, content)
      } catch (error) {
        console.error('[markdown-app] 加载文件失败:', error)
      }
    },
    [openInTab],
  )

  // 打开文件:支持多选,逐个加入标签(已打开的会被跳过,最后一个被激活)。
  const handleOpen = useCallback(async () => {
    try {
      const opened = await openMarkdownFiles()
      // 偏好开启且当前窗口已有标签:每个选中文件各开一个新窗口;否则在当前窗口逐个新建标签。
      if (openInNewWindowRef.current && tabsRef.current.length > 0) {
        for (const file of opened) {
          await invokeCommand('detach_tab_to_window', { path: file.path })
        }
      } else {
        opened.forEach((file) => openInTab(file.path, file.content))
      }
    } catch (error) {
      console.error('[markdown-app] 打开文件失败:', error)
    }
  }, [openInTab])

  // 新建空文件:弹保存框 → 写空内容 → 作为新标签打开。
  const handleNew = useCallback(async () => {
    try {
      const created = await createMarkdownFile()
      if (!created) return
      openInTab(created.path, created.content)
    } catch (error) {
      console.error('[markdown-app] 新建文件失败:', error)
    }
  }, [openInTab])

  // 关闭标签:有未保存改动先落盘(自动保存下通常已存),落盘失败则保留标签并报错;
  // 关的是当前标签时切到右邻、否则左邻;关掉最后一个回起始页。
  const closeTab = useCallback(
    async (path: string) => {
      const cur = tabsRef.current
      const idx = cur.findIndex((tab) => tab.path === path)
      if (idx < 0) return
      const tab = cur[idx]
      if (tab.dirty) {
        try {
          await writeMarkdownFile(tab.path, tab.content)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('[markdown-app] 关闭前保存失败:', error)
          setSaveFeedback({ kind: 'error', text: t('app.toast.saveFailed', { message }) })
          return
        }
      }
      // 关闭最后一个标签:直接关闭当前窗口(而非回到起始页)。内容已落盘,置「已确认」标志绕过
      // 窗口的未保存拦截(setTabs 异步、tabsRef 滞后,否则会误判仍有未保存而弹确认框)。
      // 非 Tauri(浏览器 mock)无窗口句柄时退回起始页。
      if (cur.length === 1) {
        if (windowRef.current) {
          closeConfirmedRef.current = true
          await windowRef.current.close()
        } else {
          setTabs([])
          setActivePath(null)
        }
        return
      }
      setTabs((prev) => prev.filter((x) => x.path !== path))
      if (activePathRef.current === path) {
        const fallback = cur[idx + 1] ?? cur[idx - 1] ?? null
        setActivePath(fallback ? fallback.path : null)
      }
    },
    [t],
  )

  // 切到上一个 / 下一个标签(环形)。
  const switchTab = useCallback((delta: number) => {
    const cur = tabsRef.current
    if (cur.length < 2) return
    const i = cur.findIndex((tab) => tab.path === activePathRef.current)
    if (i < 0) return
    const next = (i + delta + cur.length) % cur.length
    setActivePath(cur[next].path)
  }, [])

  // 右键菜单「在新窗口打开」:先静默落盘(确保新窗口读到最新内容),再拆为独立新窗口并从本窗口移走该标签。
  const handleOpenInNewWindow = useCallback(
    async (path: string) => {
      const tab = tabsRef.current.find((x) => x.path === path)
      if (tab?.dirty) {
        try {
          await writeMarkdownFile(tab.path, tab.content)
          setTabs((prev) => prev.map((x) => (x.path === path ? { ...x, dirty: false } : x)))
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('[markdown-app] 拆出前保存失败:', error)
          setSaveFeedback({ kind: 'error', text: t('app.toast.saveFailed', { message }) })
          return
        }
      }
      try {
        await invokeCommand('detach_tab_to_window', { path })
        void closeTab(path)
      } catch (error) {
        console.error('[markdown-app] 在新窗口打开失败:', error)
      }
    },
    [closeTab, t],
  )

  // 右键菜单「在访达中显示」。
  const handleRevealInFinder = useCallback((path: string) => {
    void invokeCommand('reveal_path_in_dir', { path }).catch((error) =>
      console.error('[markdown-app] 在访达中显示失败:', error),
    )
  }, [])

  // 右键菜单「复制文件路径」:写入剪贴板并提示。
  const handleCopyPath = useCallback(
    async (path: string) => {
      try {
        await writeClipboardText(path)
        setSaveFeedback({ kind: 'saved', text: t('tab.menu.pathCopied') })
      } catch (error) {
        console.error('[markdown-app] 复制文件路径失败:', error)
      }
    },
    [t],
  )

  // 右键菜单「关闭其他」:其余标签先落盘未保存内容,只保留当前标签并激活它。
  const handleCloseOthers = useCallback(async (keepPath: string) => {
    for (const tab of tabsRef.current.filter((x) => x.path !== keepPath && x.dirty)) {
      try {
        await writeMarkdownFile(tab.path, tab.content)
      } catch (error) {
        console.error('[markdown-app] 关闭其他前保存失败:', error)
      }
    }
    setTabs((prev) => prev.filter((x) => x.path === keepPath))
    setActivePath(keepPath)
  }, [])

  // 右键菜单「重命名」:打开弹窗,预填当前文件名。
  const handleRename = useCallback((path: string) => {
    setRenameTarget(path)
    setRenameValue(basenameOf(path))
  }, [])

  // 提交重命名:后端改名后,更新标签 path/name、激活态与最近记录。
  const submitRename = useCallback(async () => {
    const target = renameTarget
    const name = renameValue.trim()
    if (!target || !name) return
    try {
      const newPath = await invokeCommand<string>('rename_markdown_file', { oldPath: target, newName: name })
      setTabs((prev) =>
        prev.map((x) => (x.path === target ? { ...x, path: newPath, name: basenameOf(newPath) } : x)),
      )
      setActivePath((cur) => (cur === target ? newPath : cur))
      recordRecent(newPath, basenameOf(newPath))
      setRenameTarget(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[markdown-app] 重命名失败:', error)
      setSaveFeedback({ kind: 'error', text: t('tab.rename.failed', { message }) })
    }
  }, [renameTarget, renameValue, recordRecent, t])

  // 标签右键菜单的动作集合(透传给 Toolbar → TabBar)。
  const tabActions = useMemo<TabContextActions>(
    () => ({
      onOpenInNewWindow: handleOpenInNewWindow,
      onRevealInFinder: handleRevealInFinder,
      onCopyPath: handleCopyPath,
      onRename: handleRename,
      onCloseOthers: handleCloseOthers,
    }),
    [handleOpenInNewWindow, handleRevealInFinder, handleCopyPath, handleRename, handleCloseOthers],
  )

  // 关闭确认框:保存全部未保存后关 / 不保存直接关(置确认标志后 close 会被放行)。
  const confirmSaveAndClose = useCallback(async () => {
    for (const tab of tabsRef.current.filter((x) => x.dirty)) {
      try {
        await writeMarkdownFile(tab.path, tab.content)
      } catch (error) {
        console.error('[markdown-app] 关闭前保存失败:', error)
      }
    }
    closeConfirmedRef.current = true
    setCloseDialogOpen(false)
    await windowRef.current?.close()
  }, [])
  const confirmDiscardAndClose = useCallback(async () => {
    closeConfirmedRef.current = true
    setCloseDialogOpen(false)
    await windowRef.current?.close()
  }, [])

  // 系统「打开方式 / 双击」传入的文件（冷启动领取 + 运行时事件）。
  useOpenWithFile(loadPath)

  // 编辑某标签内容 → 更新该标签并标记未保存。
  const handleTabChange = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === path ? (tab.content === content ? tab : { ...tab, content, dirty: true }) : tab,
      ),
    )
  }, [])

  // 防抖自动保存:对所有未保存标签落盘(后台标签改过也能存)。
  useEffect(() => {
    const dirtyTabs = tabs.filter((tab) => tab.dirty)
    if (dirtyTabs.length === 0) return
    const handle = setTimeout(() => {
      dirtyTabs.forEach((tab) => void doSave(tab.path))
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [tabs, doSave])

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
      // 文档内查找固定快捷键 Cmd/Ctrl+F:有文件时打开搜索栏(用 e.code 规避布局差异)。
      if (event.code === 'KeyF') {
        if (activePathRef.current) {
          event.preventDefault()
          setSearchOpen(true)
        }
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
        case 'openInNewWindow': {
          // 与右键菜单一致:仅当前窗口有多个标签时才拆出当前标签。
          const path = activePathRef.current
          if (path && tabsRef.current.length > 1) void handleOpenInNewWindow(path)
          break
        }
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
        case 'newTab':
          void handleNew()
          break
        case 'closeTab': {
          const path = activePathRef.current
          if (path) void closeTab(path)
          break
        }
        case 'nextTab':
          switchTab(1)
          break
        case 'prevTab':
          switchTab(-1)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [doSave, handleOpen, handleNew, closeTab, switchTab, handleOpenInNewWindow, comboLookup])

  // toast 自动消失:成功 2 秒,错误 5 秒。
  useEffect(() => {
    if (!saveFeedback) return
    const handle = setTimeout(() => setSaveFeedback(null), saveFeedback.kind === 'saved' ? 2000 : 5000)
    return () => clearTimeout(handle)
  }, [saveFeedback])

  // 关闭窗口:任一标签有未保存改动则拦截并弹「是否保存」确认框;无改动直接放行(非 Tauri 无此事件)。
  useEffect(() => {
    if (!isTauri()) return
    let active = true
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      windowRef.current = win
      return win
        .onCloseRequested((event) => {
          if (closeConfirmedRef.current || !tabsRef.current.some((tab) => tab.dirty)) return // 已确认 / 无改动:放行
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

  // 拆出窗口在领取文件前显示加载态(而非起始页)。兜底:若超时仍没领到文件(异常),回退到起始页,
  // 不让加载态卡死。
  const [detachedLoadTimedOut, setDetachedLoadTimedOut] = useState(false)
  useEffect(() => {
    if (!isDetachedWindow) return
    const handle = setTimeout(() => setDetachedLoadTimedOut(true), 3000)
    return () => clearTimeout(handle)
  }, [isDetachedWindow])

  // 无文件 / 无标题不显示目录。
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

  // 关闭确认文案:多个未保存用计数,单个用文件名。
  const dirtyTabCount = tabs.reduce((n, tab) => (tab.dirty ? n + 1 : n), 0)
  const closeDescription =
    dirtyTabCount > 1
      ? t('app.close.descMultiple', { count: dirtyTabCount })
      : filePath
        ? t('app.close.descNamed', { name: basenameOf(filePath) })
        : t('app.close.descUnnamed')

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar
        tabs={tabs}
        activePath={activePath}
        mode={mode}
        onModeChange={setMode}
        onOpen={handleOpen}
        onActivateTab={setActivePath}
        onCloseTab={closeTab}
        onNewTab={handleNew}
        tabActions={tabActions}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {/* 启动静默检查发现新版时的顶部更新横幅(非模态,不打断编辑) */}
      <UpdateBanner appUpdate={appUpdate} />
      <div className="relative flex min-h-0 flex-1">
        {filePath && activeTab ? (
          <>
            {tocPrefs.position === 'left' && tocPanel}
            <MarkdownWorkspace
              mode={mode}
              tabs={tabs}
              activePath={filePath}
              markdown={markdown}
              filePath={filePath}
              vaultPath={vaultPath}
              splitOrientation={splitOrientation}
              onTabChange={handleTabChange}
              onActiveChange={(content) => handleTabChange(filePath, content)}
              onSave={() => void doSave()}
            />
            {tocPrefs.position === 'right' && tocPanel}
            {showToc && tocCollapsed && (
              <TocReopenRail position={tocPrefs.position} onExpand={() => setTocCollapsed(false)} />
            )}
            {searchOpen && (
              <SearchBar
                query={search.query}
                onQueryChange={search.setQuery}
                total={search.total}
                activeIndex={search.activeIndex}
                onNext={search.next}
                onPrev={search.prev}
                onClose={() => setSearchOpen(false)}
              />
            )}
          </>
        ) : isDetachedWindow && !detachedLoadTimedOut ? (
          // 拆出窗口领取文件期间的加载态(避免闪起始页);领到文件即切走,超时则回退起始页。
          <div className="flex flex-1 items-center justify-center">
            <div
              className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
              aria-label={t('app.loading')}
            />
          </div>
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
          <DialogDescription>{closeDescription}</DialogDescription>
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

      {/* 重命名文件弹窗 */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>{t('tab.rename.title')}</DialogTitle>
          <DialogDescription>{t('tab.rename.placeholder')}</DialogDescription>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submitRename()
            }}
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={t('tab.rename.placeholder')}
              aria-label={t('tab.rename.title')}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
                {t('tab.rename.cancel')}
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                {t('tab.rename.confirm')}
              </Button>
            </DialogFooter>
          </form>
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

/**
 * 根据当前模式渲染对应的编辑 / 查看表面。
 * - 查看 / 分栏:只读,按 activePath 重挂载(只读无光标 / 滚动损失,改动最小)。
 * - 所见即所得:复用 useEditorTabSwap,实例需跨标签存活(不含 activePath 的 key),由引擎缓存并秒切。
 */
function MarkdownWorkspace({
  mode,
  tabs,
  activePath,
  markdown,
  filePath,
  vaultPath,
  splitOrientation,
  onTabChange,
  onActiveChange,
  onSave,
}: {
  mode: AppMode
  tabs: ReadonlyArray<{ path: string; content: string }>
  activePath: string
  markdown: string
  filePath: string
  vaultPath?: string
  splitOrientation: SplitOrientation
  onTabChange: (path: string, content: string) => void
  onActiveChange: (content: string) => void
  onSave: () => void
}) {
  if (mode === 'view') {
    return <MarkdownReadonlyView key={activePath} markdown={markdown} filePath={filePath} vaultPath={vaultPath} />
  }
  if (mode === 'split') {
    return (
      <SplitView
        key={activePath}
        markdown={markdown}
        filePath={filePath}
        vaultPath={vaultPath}
        orientation={splitOrientation}
        onChange={onActiveChange}
        onSave={onSave}
      />
    )
  }
  return (
    <MarkdownEditableView tabs={tabs} activePath={activePath} vaultPath={vaultPath} onChange={onTabChange} />
  )
}
