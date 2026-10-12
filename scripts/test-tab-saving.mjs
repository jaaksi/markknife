import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// 复用现有 TypeScript 依赖，测试无需新增框架或写入编译产物。
const source = await readFile(new URL('../src/markdown-app/tabSaving.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const { createMarkdownWriteQueue, markSavedTabs, saveTabsBeforeClose } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

function tab(path, content = path, dirty = true) {
  return { path, content, dirty }
}

function workspace(initial) {
  let tabs = initial
  return {
    readTabs: () => tabs,
    updateTabs: (update) => { tabs = update(tabs) },
    shouldClose: () => true,
    flushEditor: () => {},
  }
}

test('all dirty files must save successfully before closing is allowed', async () => {
  const state = workspace([tab('a.md'), tab('b.md'), tab('clean.md', '', false)])
  const writes = []
  const result = await saveTabsBeforeClose({
    ...state,
    write: async (path, content) => { writes.push([path, content]) },
  })
  assert.equal(result.canClose, true)
  assert.deepEqual(writes, [['a.md', 'a.md'], ['b.md', 'b.md']])
  assert.ok(state.readTabs().every((tab) => !tab.dirty))
})

test('one failure retains every tab and its content; retry only writes the failed file', async () => {
  const initial = [tab('a.md'), tab('b.md'), tab('c.md')]
  const state = workspace(initial)
  const writes = []
  let failing = true
  const write = async (path) => {
    writes.push(path)
    if (path === 'b.md' && failing) throw new Error('Permission denied')
  }
  const failed = await saveTabsBeforeClose({ ...state, write })
  assert.equal(failed.canClose, false)
  assert.deepEqual(failed.failures, [{ path: 'b.md', message: 'Permission denied' }])
  assert.deepEqual(failed.pendingPaths, ['b.md'])
  assert.deepEqual(state.readTabs().map(({ path, content }) => ({ path, content })),
    initial.map(({ path, content }) => ({ path, content })))
  assert.deepEqual(writes, ['a.md', 'b.md', 'c.md'])
  failing = false
  const retried = await saveTabsBeforeClose({ ...state, write })
  assert.equal(retried.canClose, true)
  assert.deepEqual(writes, ['a.md', 'b.md', 'c.md', 'b.md'])
})

test('editing a file during its save keeps it dirty and cancels closing', async () => {
  const state = workspace([tab('a.md', 'old')])
  const result = await saveTabsBeforeClose({
    ...state,
    write: async () => { state.updateTabs(() => [tab('a.md', 'new')]) },
  })
  assert.equal(result.canClose, false)
  assert.deepEqual(result.failures, [])
  assert.deepEqual(result.pendingPaths, ['a.md'])
  assert.deepEqual(state.readTabs(), [tab('a.md', 'new')])
})

test('pending rich editor changes are flushed before saving and before the final check', async () => {
  const state = workspace([tab('a.md', '', false)])
  const writes = []
  let pendingContent = 'typed just before closing'
  const flushEditor = () => {
    if (pendingContent === null) return
    state.updateTabs(() => [tab('a.md', pendingContent)])
    pendingContent = null
  }
  const result = await saveTabsBeforeClose({
    ...state,
    flushEditor,
    write: async (_path, content) => {
      writes.push(content)
      pendingContent = 'typed during saving'
    },
  })
  assert.deepEqual(writes, ['typed just before closing'])
  assert.equal(result.canClose, false)
  assert.deepEqual(state.readTabs(), [tab('a.md', 'typed during saving')])
})

test('close others ignores the kept tab; a new dirty tab blocks closing the whole window', async () => {
  const state = workspace([tab('keep.md'), tab('other.md')])
  const result = await saveTabsBeforeClose({
    ...state,
    shouldClose: (tab) => tab.path === 'other.md',
    write: async () => { state.updateTabs((tabs) => [...tabs, tab('new.md')]) },
  })
  assert.equal(result.canClose, true)
  assert.equal(state.readTabs().find((tab) => tab.path === 'keep.md').dirty, true)
  assert.equal(state.readTabs().find((tab) => tab.path === 'new.md').dirty, true)

  const windowState = workspace([tab('a.md')])
  const windowResult = await saveTabsBeforeClose({
    ...windowState,
    write: async () => { windowState.updateTabs((tabs) => [...tabs, tab('new.md')]) },
  })
  assert.equal(windowResult.canClose, false)
  assert.deepEqual(windowResult.pendingPaths, ['new.md'])
})

test('an earlier successful save cannot clear a newer edit or a renamed tab', () => {
  const current = [tab('a.md', 'new'), tab('renamed.md', 'same')]
  assert.deepEqual(markSavedTabs(current, [tab('a.md', 'old'), tab('old.md', 'same')]), current)
})

test('an older queued snapshot marks the current content dirty even after an intervening save', () => {
  const current = [tab('a.md', 'current', false)]
  assert.deepEqual(markSavedTabs(current, [tab('a.md', 'older')]), [tab('a.md', 'current')])
})

test('writes to the same file wait for older saves; other files can save independently', async () => {
  let finishFirst
  const firstFinished = new Promise((resolve) => { finishFirst = resolve })
  const started = []
  const completed = []
  const write = createMarkdownWriteQueue(async (path, content) => {
    started.push(content)
    if (content === 'old') await firstFinished
    completed.push([path, content])
  })
  const old = write('a.md', 'old')
  const latest = write('a.md', 'latest')
  await write('b.md', 'independent')
  assert.deepEqual(started, ['old', 'independent'])
  finishFirst()
  await Promise.all([old, latest])
  assert.deepEqual(completed, [['b.md', 'independent'], ['a.md', 'old'], ['a.md', 'latest']])
})

test('a failed queued write does not prevent the next save from succeeding', async () => {
  const writes = []
  const write = createMarkdownWriteQueue(async (_path, content) => {
    writes.push(content)
    if (content === 'failure') throw new Error('Disk full')
  })
  const failure = write('a.md', 'failure')
  const retry = write('a.md', 'retry')
  await assert.rejects(failure, /Disk full/)
  await retry
  assert.deepEqual(writes, ['failure', 'retry'])
})
