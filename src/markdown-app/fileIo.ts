import { open, save } from '@tauri-apps/plugin-dialog'
import { isTauri } from '../mock-tauri'
import { invokeCommand } from './invokeCommand'
import { t } from './i18nMessages'

export interface OpenedFile {
  path: string
  content: string
}

/** 浏览器/测试环境下使用的占位文件路径（由 mock 提供内容）。 */
const DEV_FALLBACK_PATH = 'mock-vault/welcome.md'

/** 取路径所在目录（作为 vaultPath，供图片落盘与相对化使用）。 */
export function dirnameOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx >= 0 ? path.slice(0, idx) : ''
}

/** 取路径的文件名。 */
export function basenameOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx >= 0 ? path.slice(idx + 1) : path
}

export function readMarkdownFile(path: string): Promise<string> {
  return invokeCommand<string>('read_markdown_file', { path })
}

export function writeMarkdownFile(path: string, content: string): Promise<void> {
  return invokeCommand<void>('write_markdown_file', { path, content })
}

/** 弹出系统文件选择框并读取选中的 Markdown 文件。取消则返回 null。 */
export async function openMarkdownFile(): Promise<OpenedFile | null> {
  if (!isTauri()) {
    const content = await readMarkdownFile(DEV_FALLBACK_PATH)
    return { path: DEV_FALLBACK_PATH, content }
  }

  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  if (typeof selected !== 'string') return null

  const content = await readMarkdownFile(selected)
  return { path: selected, content }
}

/** 多选打开:返回所有选中的 Markdown 文件(已读出内容)。取消返回空数组。 */
export async function openMarkdownFiles(): Promise<OpenedFile[]> {
  if (!isTauri()) {
    const content = await readMarkdownFile(DEV_FALLBACK_PATH)
    return [{ path: DEV_FALLBACK_PATH, content }]
  }

  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  const paths = Array.isArray(selected) ? selected : typeof selected === 'string' ? [selected] : []
  return Promise.all(paths.map(async (path) => ({ path, content: await readMarkdownFile(path) })))
}

/** 新建一个空 Markdown 文件:弹保存框选路径 → 写入空内容 → 返回。取消则返回 null。 */
export async function createMarkdownFile(): Promise<OpenedFile | null> {
  if (!isTauri()) {
    // 浏览器/测试环境:直接给一份空白文档(不落盘)。
    return { path: `mock-vault/${t('content.untitledFile')}`, content: '' }
  }

  const target = await save({
    defaultPath: t('content.untitledFile'),
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  if (typeof target !== 'string') return null

  await writeMarkdownFile(target, '')
  return { path: target, content: '' }
}
