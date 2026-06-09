import type { VaultEntry } from '../types'
import { basenameOf } from './fileIo'

/**
 * 为「单文件」模式构造 BlockNote 内容编排所需的最小 VaultEntry。
 * 字段模板取自原 EditorContentLayout 的 LOADING_BREADCRUMB_ENTRY，仅填入当前文件名。
 */
export function createSyntheticEntry(path: string): VaultEntry {
  const filename = basenameOf(path) || 'untitled.md'
  const title = filename.replace(/\.(md|markdown)$/i, '')
  return {
    path,
    filename,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    fileKind: 'markdown',
  }
}
