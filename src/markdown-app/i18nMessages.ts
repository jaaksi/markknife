/**
 * MarkKnife 自带的轻量 i18n 文案目录(纯模块,不含 React)。
 * 目前支持简体中文与英文;新增语言只需在 MESSAGES 里补一份完整目录。
 *
 * - `translate(lang, key, values)`:纯翻译函数,缺失键回退英文,支持 {name} 插值。
 * - 模块级「当前语言」+ `t()`:供非组件 / 事件回调(如插入内容、保存 toast)取用,
 *   由 LanguageProvider 在语言变化时同步。组件渲染请用 useLanguage() 的响应式 t。
 */

export type Language = 'zh-CN' | 'en'

/** 以简体中文目录为「键的真相源」:en 必须实现同样的键(类型约束保证不漏)。 */
const zhCN = {
  // —— 工具栏 ——
  'toolbar.open': '打开文件',
  'toolbar.settings': '设置',
  'toolbar.unsaved': '未保存',
  'toolbar.startPage': 'MarkKnife · 起始页',
  'toolbar.modeGroup': '模式',
  'tab.new': '新建标签',
  'tab.close': '关闭标签',
  'tab.menu.openInNewWindow': '在新窗口打开',
  'tab.menu.reveal': '在访达中显示',
  'tab.menu.copyPath': '复制文件路径',
  'tab.menu.rename': '重命名',
  'tab.menu.closeOthers': '关闭其他',
  'tab.menu.pathCopied': '已复制文件路径',
  'tab.rename.title': '重命名文件',
  'tab.rename.placeholder': '输入新的文件名',
  'tab.rename.cancel': '取消',
  'tab.rename.confirm': '重命名',
  'tab.rename.failed': '重命名失败:{message}',
  'mode.view': '查看',
  'mode.wysiwyg': '所见即所得',
  'mode.split': '分栏',

  // —— 起始页 ——
  'startPage.welcomeTitle': '欢迎使用 MarkKnife',
  'startPage.welcomeSubtitle': '从最近打开的文档继续,或打开 / 新建一个 Markdown 文件',
  'startPage.open': '打开文件',
  'startPage.new': '新建文件',
  'startPage.searchPlaceholder': '搜索历史记录(文件名或路径)…',
  'startPage.clearSearch': '清除搜索',
  'startPage.clear': '清除',
  'startPage.recent': '最近打开',
  'startPage.clearAll': '清空全部',
  'startPage.searchEmptyTitle': '未找到匹配的记录',
  'startPage.searchEmptyBefore': '没有与 ',
  'startPage.searchEmptyAfter': ' 匹配的历史记录',
  'startPage.emptyTitle': '还没有最近打开的文件',
  'startPage.emptyDesc': '打开一个 Markdown 文件后,它会出现在这里',
  'startPage.removeRecent': '从历史中删除',

  // —— 设置:导航 ——
  'settings.title': '设置',
  'settings.subtitle': '自定义你的阅读与编辑体验',
  'settings.close': '关闭设置',
  'settings.reset': '恢复默认',
  'settings.nav.appearance': '外观',
  'settings.nav.styles': '样式',
  'settings.nav.language': '语言',
  'settings.nav.keys': '快捷键',
  'settings.nav.toc': '目录',
  'settings.nav.editor': '编辑',
  'settings.nav.about': '关于',

  // —— 设置:外观 ——
  'settings.appearance.section': '外观',
  'settings.appearance.widthMode': '内容宽度',
  'settings.appearance.widthModeDesc': '「铺满窗口」时忽略最大宽度,内容随窗口自适应',
  'settings.appearance.widthLimited': '限制宽度',
  'settings.appearance.widthFull': '铺满窗口',
  'settings.appearance.maxWidth': '最大宽度',
  'settings.appearance.maxWidthDesc': '限制内容宽度以提高可读性',
  'settings.appearance.colorMode': '深色模式',
  'settings.appearance.colorModeDesc': '跟随系统,或强制浅色 / 深色',
  'colorMode.system': '跟随系统',
  'colorMode.light': '浅色',
  'colorMode.dark': '深色',

  // —— 设置:样式 ——
  'settings.styles.section': '阅读样式',
  'settings.styles.desc': '选择一套预设排版主题,影响正文配色、字体与间距。',
  'style.default': '默认',
  'style.sepia': '护眼',
  'style.serif': '衬线',
  'style.nord': 'Nord',
  'style.rose': '玫瑰',
  'style.dark': '深色',

  // —— 设置:语言 ——
  'settings.language.section': '界面语言',
  'lang.zh-CN.sub': 'Chinese (Simplified)',
  'lang.en.sub': '英语',

  // —— 设置:快捷键 ——
  'settings.keys.section': '快捷键',
  'settings.keys.hint': '点右侧 ✎ 录制新的组合键,Esc 取消。',
  'settings.keys.recording': '按下新组合键…',
  'settings.keys.recordAria': '录制「{label}」快捷键',
  'settings.keys.cancelAria': '取消录制',
  'shortcut.toggleToc.label': '收起 / 展开目录',
  'shortcut.toggleToc.detail': '隐藏或显示目录面板',
  'shortcut.modeView.label': '切换到「查看」',
  'shortcut.modeWysiwyg.label': '切换到「所见即所得」',
  'shortcut.modeSplit.label': '切换到「分栏」',
  'shortcut.save.label': '保存',
  'shortcut.save.detail': '立即写回磁盘',
  'shortcut.open.label': '打开文件',
  'shortcut.openInNewWindow.label': '在新窗口打开当前标签',
  'shortcut.newTab.label': '新建标签',
  'shortcut.closeTab.label': '关闭标签',
  'shortcut.nextTab.label': '下一个标签',
  'shortcut.prevTab.label': '上一个标签',

  // —— 设置:目录 ——
  'settings.toc.section': '目录',
  'settings.toc.defaultVisible': '默认显示目录面板',
  'settings.toc.defaultVisibleDesc': '打开文件时是否默认展开目录',
  'settings.toc.position': '目录位置',
  'settings.toc.positionDesc': '目录面板显示在内容的哪一侧',
  'toc.position.left': '左侧',
  'toc.position.right': '右侧',

  // —— 设置:编辑 ——
  'settings.editor.section': '编辑',
  'settings.editor.splitOrientation': '分栏方向',
  'settings.editor.splitOrientationDesc': '分栏模式下编辑区与预览区的左右排列',
  'settings.editor.openInNewWindow': '在新窗口中打开文件',
  'settings.editor.openInNewWindowDesc': '打开文件时默认在新窗口中打开(而非当前窗口新建标签)',
  'split.sourceLeft': '编辑·预览',
  'split.previewLeft': '预览·编辑',

  // —— 设置:关于 / 更新 ——
  'settings.about.section': '关于 / 更新',
  'update.label.checkApp': '检查应用更新',
  'update.label.available': '发现新版本',
  'update.label.availableVersion': '发现新版本 v{version}',
  'update.label.downloading': '正在下载更新…',
  'update.label.ready': '更新已下载',
  'update.label.upToDate': '已是最新版本',
  'update.label.error': '检查更新失败',
  'update.detail.ready': '重启应用以完成更新。',
  'update.detail.current': '当前 v{version}',
  'update.action.update': '立即更新',
  'update.action.relaunch': '立即重启',
  'update.action.checking': '检查中…',
  'update.action.downloading': '下载中…',
  'update.action.check': '检查更新',

  // —— 更新弹窗 ——
  'updateDialog.readyTitle': '更新已就绪',
  'updateDialog.readyDesc': '新版本已下载完成,重启应用即可完成更新。',
  'updateDialog.later': '稍后',
  'updateDialog.relaunch': '立即重启',
  'updateDialog.errorTitle': '更新失败',
  'updateDialog.unknownError': '发生未知错误。',
  'updateDialog.close': '关闭',
  'updateDialog.availableTitle': '发现新版本',
  'updateDialog.availableTitleVersion': '发现新版本 v{version}',
  'updateDialog.availableDesc': '有可用的新版本。',
  'updateDialog.availableDescVersion': '当前版本 v{current},可更新到 v{version}。',
  'updateDialog.updating': '更新中…',
  'updateDialog.update': '立即更新',
  'updateDialog.downloadingBusy': '正在下载… {size}',
  'updateDialog.downloadedPercent': '已下载 {percent}%({size})',

  // —— 应用:toast 与对话框 ——
  'app.loading': '加载中…',
  'app.toast.saved': '已保存',
  'app.toast.noFile': '没有打开的文件,无法保存',
  'app.toast.saveFailed': '保存失败:{message}',
  'app.close.title': '未保存的更改',
  'app.close.descNamed': '「{name}」有未保存的更改,关闭前要保存吗?',
  'app.close.descUnnamed': '当前文件有未保存的更改,关闭前要保存吗?',
  'app.close.cancel': '取消',
  'app.close.discard': '不保存',
  'app.close.save': '保存',
  'app.close.descMultiple': '有 {count} 个文件未保存,关闭前要全部保存吗?',

  // —— 目录面板 ——
  'toc.title': '目录',
  'toc.expandAll': '全部展开',
  'toc.collapseAll': '全部折叠',
  'toc.collapse': '收起目录',
  'toc.expand': '展开目录',
  'toc.expandChildren': '展开子目录',
  'toc.collapseChildren': '折叠子目录',
  'toc.untitled': '(无标题)',

  // —— 相对时间(绝对日期在代码里按语言格式化)——
  'time.justNow': '刚刚',
  'time.minutesAgo': '{n} 分钟前',
  'time.hoursAgo': '{n} 小时前',
  'time.todayAt': '今天 {time}',
  'time.yesterday': '昨天',
  'time.daysAgo': '{n} 天前',

  // —— 格式化工具栏(分栏源码侧)——
  'format.toolbarAria': 'Markdown 编辑',
  'format.undo': '撤销 (⌘Z)',
  'format.redo': '重做 (⌘⇧Z)',
  'format.h1': '标题 1',
  'format.h2': '标题 2',
  'format.h3': '标题 3',
  'format.bold': '加粗 (⌘B)',
  'format.italic': '斜体 (⌘I)',
  'format.strikethrough': '删除线',
  'format.inlineCode': '行内代码',
  'format.quote': '引用',
  'format.codeBlock': '代码块',
  'format.bulletList': '无序列表',
  'format.orderedList': '有序列表',
  'format.taskList': '任务列表',
  'format.link': '链接 (⌘K)',
  'format.image': '图片',
  'format.table': '表格',
  'format.divider': '分割线',

  // —— 插入到文档的默认内容(跟随界面语言)——
  'content.linkText': '链接文字',
  'content.imageAlt': '描述',
  'content.tableTemplate': '\n| 列 1 | 列 2 |\n| --- | --- |\n| 单元格 | 单元格 |\n',
  'content.untitledFile': '未命名.md',
} as const

/** 翻译键 = 简体中文目录的键。 */
export type MessageKey = keyof typeof zhCN
export type TranslationValues = Record<string, string | number>

/** 英文目录:用 Record<MessageKey,string> 约束,缺键会在编译期报错。 */
const en: Record<MessageKey, string> = {
  // —— Toolbar ——
  'toolbar.open': 'Open file',
  'toolbar.settings': 'Settings',
  'toolbar.unsaved': 'Unsaved',
  'toolbar.startPage': 'MarkKnife · Start Page',
  'toolbar.modeGroup': 'Mode',
  'tab.new': 'New tab',
  'tab.close': 'Close tab',
  'tab.menu.openInNewWindow': 'Open in New Window',
  'tab.menu.reveal': 'Reveal in Finder',
  'tab.menu.copyPath': 'Copy File Path',
  'tab.menu.rename': 'Rename',
  'tab.menu.closeOthers': 'Close Others',
  'tab.menu.pathCopied': 'File path copied',
  'tab.rename.title': 'Rename File',
  'tab.rename.placeholder': 'Enter a new file name',
  'tab.rename.cancel': 'Cancel',
  'tab.rename.confirm': 'Rename',
  'tab.rename.failed': 'Rename failed: {message}',
  'mode.view': 'View',
  'mode.wysiwyg': 'WYSIWYG',
  'mode.split': 'Split',

  // —— Start page ——
  'startPage.welcomeTitle': 'Welcome to MarkKnife',
  'startPage.welcomeSubtitle': 'Pick up from a recent document, or open / create a Markdown file',
  'startPage.open': 'Open File',
  'startPage.new': 'New File',
  'startPage.searchPlaceholder': 'Search history (file name or path)…',
  'startPage.clearSearch': 'Clear search',
  'startPage.clear': 'Clear',
  'startPage.recent': 'Recent',
  'startPage.clearAll': 'Clear all',
  'startPage.searchEmptyTitle': 'No matching records',
  'startPage.searchEmptyBefore': 'No history matches ',
  'startPage.searchEmptyAfter': '',
  'startPage.emptyTitle': 'No recent files yet',
  'startPage.emptyDesc': 'Open a Markdown file and it will show up here',
  'startPage.removeRecent': 'Remove from history',

  // —— Settings: navigation ——
  'settings.title': 'Settings',
  'settings.subtitle': 'Customize your reading and editing experience',
  'settings.close': 'Close settings',
  'settings.reset': 'Restore defaults',
  'settings.nav.appearance': 'Appearance',
  'settings.nav.styles': 'Styles',
  'settings.nav.language': 'Language',
  'settings.nav.keys': 'Shortcuts',
  'settings.nav.toc': 'Outline',
  'settings.nav.editor': 'Editor',
  'settings.nav.about': 'About',

  // —— Settings: appearance ——
  'settings.appearance.section': 'Appearance',
  'settings.appearance.widthMode': 'Content width',
  'settings.appearance.widthModeDesc': '“Full width” ignores max width — content follows the window',
  'settings.appearance.widthLimited': 'Limited',
  'settings.appearance.widthFull': 'Full width',
  'settings.appearance.maxWidth': 'Max width',
  'settings.appearance.maxWidthDesc': 'Limit content width for readability',
  'settings.appearance.colorMode': 'Dark mode',
  'settings.appearance.colorModeDesc': 'Follow the system, or force light / dark',
  'colorMode.system': 'System',
  'colorMode.light': 'Light',
  'colorMode.dark': 'Dark',

  // —— Settings: styles ——
  'settings.styles.section': 'Reading style',
  'settings.styles.desc': 'Pick a preset typographic theme — affects body colors, fonts and spacing.',
  'style.default': 'Default',
  'style.sepia': 'Sepia',
  'style.serif': 'Serif',
  'style.nord': 'Nord',
  'style.rose': 'Rose',
  'style.dark': 'Dark',

  // —— Settings: language ——
  'settings.language.section': 'Interface language',
  'lang.zh-CN.sub': 'Simplified Chinese',
  'lang.en.sub': 'English',

  // —— Settings: shortcuts ——
  'settings.keys.section': 'Shortcuts',
  'settings.keys.hint': 'Click ✎ on the right to record a new combo, Esc to cancel.',
  'settings.keys.recording': 'Press a new combo…',
  'settings.keys.recordAria': 'Record shortcut for “{label}”',
  'settings.keys.cancelAria': 'Cancel recording',
  'shortcut.toggleToc.label': 'Toggle outline',
  'shortcut.toggleToc.detail': 'Hide or show the outline panel',
  'shortcut.modeView.label': 'Switch to View',
  'shortcut.modeWysiwyg.label': 'Switch to WYSIWYG',
  'shortcut.modeSplit.label': 'Switch to Split',
  'shortcut.save.label': 'Save',
  'shortcut.save.detail': 'Write to disk immediately',
  'shortcut.open.label': 'Open file',
  'shortcut.openInNewWindow.label': 'Open current tab in new window',
  'shortcut.newTab.label': 'New tab',
  'shortcut.closeTab.label': 'Close tab',
  'shortcut.nextTab.label': 'Next tab',
  'shortcut.prevTab.label': 'Previous tab',

  // —— Settings: outline ——
  'settings.toc.section': 'Outline',
  'settings.toc.defaultVisible': 'Show outline by default',
  'settings.toc.defaultVisibleDesc': 'Whether to expand the outline when a file is opened',
  'settings.toc.position': 'Outline position',
  'settings.toc.positionDesc': 'Which side of the content the outline appears on',
  'toc.position.left': 'Left',
  'toc.position.right': 'Right',

  // —— Settings: editor ——
  'settings.editor.section': 'Editor',
  'settings.editor.splitOrientation': 'Split orientation',
  'settings.editor.splitOrientationDesc': 'Left/right arrangement of editor and preview in split mode',
  'settings.editor.openInNewWindow': 'Open files in a new window',
  'settings.editor.openInNewWindowDesc': 'Open files in a new window by default, instead of a new tab in the current window',
  'split.sourceLeft': 'Editor · Preview',
  'split.previewLeft': 'Preview · Editor',

  // —— Settings: about / updates ——
  'settings.about.section': 'About / Updates',
  'update.label.checkApp': 'Check for updates',
  'update.label.available': 'New version available',
  'update.label.availableVersion': 'New version v{version} available',
  'update.label.downloading': 'Downloading update…',
  'update.label.ready': 'Update downloaded',
  'update.label.upToDate': 'You’re up to date',
  'update.label.error': 'Update check failed',
  'update.detail.ready': 'Restart the app to finish updating.',
  'update.detail.current': 'Current v{version}',
  'update.action.update': 'Update now',
  'update.action.relaunch': 'Restart now',
  'update.action.checking': 'Checking…',
  'update.action.downloading': 'Downloading…',
  'update.action.check': 'Check for updates',

  // —— Update dialog ——
  'updateDialog.readyTitle': 'Update ready',
  'updateDialog.readyDesc': 'The new version has been downloaded. Restart the app to finish updating.',
  'updateDialog.later': 'Later',
  'updateDialog.relaunch': 'Restart now',
  'updateDialog.errorTitle': 'Update failed',
  'updateDialog.unknownError': 'An unknown error occurred.',
  'updateDialog.close': 'Close',
  'updateDialog.availableTitle': 'New version available',
  'updateDialog.availableTitleVersion': 'New version v{version}',
  'updateDialog.availableDesc': 'A new version is available.',
  'updateDialog.availableDescVersion': 'Current version v{current}, you can update to v{version}.',
  'updateDialog.updating': 'Updating…',
  'updateDialog.update': 'Update now',
  'updateDialog.downloadingBusy': 'Downloading… {size}',
  'updateDialog.downloadedPercent': 'Downloaded {percent}% ({size})',

  // —— App: toast & dialogs ——
  'app.loading': 'Loading…',
  'app.toast.saved': 'Saved',
  'app.toast.noFile': 'No file is open — nothing to save',
  'app.toast.saveFailed': 'Save failed: {message}',
  'app.close.title': 'Unsaved changes',
  'app.close.descNamed': '“{name}” has unsaved changes. Save before closing?',
  'app.close.descUnnamed': 'The current file has unsaved changes. Save before closing?',
  'app.close.cancel': 'Cancel',
  'app.close.discard': 'Don’t save',
  'app.close.save': 'Save',
  'app.close.descMultiple': '{count} files have unsaved changes. Save all before closing?',

  // —— Outline panel ——
  'toc.title': 'Outline',
  'toc.expandAll': 'Expand all',
  'toc.collapseAll': 'Collapse all',
  'toc.collapse': 'Collapse outline',
  'toc.expand': 'Expand outline',
  'toc.expandChildren': 'Expand subitems',
  'toc.collapseChildren': 'Collapse subitems',
  'toc.untitled': '(untitled)',

  // —— Relative time ——
  'time.justNow': 'Just now',
  'time.minutesAgo': '{n} min ago',
  'time.hoursAgo': '{n} hr ago',
  'time.todayAt': 'Today {time}',
  'time.yesterday': 'Yesterday',
  'time.daysAgo': '{n} days ago',

  // —— Format toolbar ——
  'format.toolbarAria': 'Markdown editing',
  'format.undo': 'Undo (⌘Z)',
  'format.redo': 'Redo (⌘⇧Z)',
  'format.h1': 'Heading 1',
  'format.h2': 'Heading 2',
  'format.h3': 'Heading 3',
  'format.bold': 'Bold (⌘B)',
  'format.italic': 'Italic (⌘I)',
  'format.strikethrough': 'Strikethrough',
  'format.inlineCode': 'Inline code',
  'format.quote': 'Quote',
  'format.codeBlock': 'Code block',
  'format.bulletList': 'Bullet list',
  'format.orderedList': 'Numbered list',
  'format.taskList': 'Task list',
  'format.link': 'Link (⌘K)',
  'format.image': 'Image',
  'format.table': 'Table',
  'format.divider': 'Divider',

  // —— Default inserted content (follows UI language) ——
  'content.linkText': 'link text',
  'content.imageAlt': 'description',
  'content.tableTemplate': '\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n',
  'content.untitledFile': 'Untitled.md',
}

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  'zh-CN': zhCN,
  en,
}

const SUPPORTED_LANGUAGES: readonly Language[] = ['zh-CN', 'en']
const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'markknife.language'

/** {name} 占位插值;未提供的占位原样保留。 */
function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

/** 纯翻译:取目标语言文案,缺失键回退英文,最后回退键名本身。 */
export function translate(language: Language, key: MessageKey, values?: TranslationValues): string {
  const template = MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key
  return interpolate(template, values)
}

/** 首次启动:读 navigator.language —— 中文系统 → 简体中文,其余 → 英文。 */
function detectInitialLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language]
  for (const raw of candidates) {
    if (raw && raw.toLowerCase().startsWith('zh')) return 'zh-CN'
  }
  return DEFAULT_LANGUAGE
}

/** 读持久化的语言偏好;无 / 非法时按系统推断。 */
export function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (raw && SUPPORTED_LANGUAGES.includes(raw as Language)) return raw as Language
  } catch {
    // 读取失败(隐私模式等)忽略,走系统推断。
  }
  return detectInitialLanguage()
}

// 模块级「当前语言」:供非组件 / 事件回调用的 t() 取用,由 LanguageProvider 同步。
let currentLanguage: Language = readStoredLanguage()

export function setCurrentLanguage(language: Language): void {
  currentLanguage = language
}

/** 非响应式翻译:用模块级当前语言。组件渲染请改用 useLanguage() 的 t。 */
export function t(key: MessageKey, values?: TranslationValues): string {
  return translate(currentLanguage, key, values)
}
