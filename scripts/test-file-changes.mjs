import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/markdown-app/fileChanges.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const { createOpenTab, reconcileDiskContent, withExternalChange, applySavedContent, replaceWithDiskContent, applyEditorChange } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

function opened() { return createOpenTab('/note.md', 'note.md', 'original') }
function edited(tab, content = 'my edits') { return { ...tab, content, dirty: true } }

test('a clean tab refreshes from disk without triggering autosave', () => {
  const tab = opened()
  const next = reconcileDiskContent(tab, tab, 'external edits')
  assert.equal(next.content, 'external edits')
  assert.equal(next.diskContent, 'external edits')
  assert.equal(next.dirty, false)
  assert.equal(next.reloadRevision, 1)
  assert.equal(next.externalChange, null)
})

test('local edits remain intact when disk changes, including edits made while a check was running', () => {
  const snapshot = opened()
  const local = edited(snapshot)
  const next = reconcileDiskContent(local, snapshot, 'external edits')
  assert.equal(next.content, 'my edits')
  assert.equal(next.diskContent, 'original')
  assert.equal(next.dirty, true)
  assert.deepEqual(next.externalChange, { kind: 'modified', content: 'external edits' })
  assert.equal(next.reloadRevision, 0)
})

test('content differing from the disk baseline is protected even if the dirty flag is stale', () => {
  const tab = { ...edited(opened()), dirty: false }
  assert.equal(reconcileDiskContent(tab, tab, 'external').content, 'my edits')
})

test('saving advances the baseline without clearing newer local edits', () => {
  const snapshot = edited(opened(), 'first edit')
  const tab = edited(snapshot, 'second edit')
  const next = applySavedContent(tab, snapshot, snapshot.content)
  assert.equal(next.diskContent, 'first edit')
  assert.equal(next.content, 'second edit')
  assert.equal(next.dirty, true)
  assert.equal(reconcileDiskContent(next, next, 'first edit'), next)
})

test('checks issued before saving are ignored even when the saved content is unchanged', () => {
  const snapshot = opened()
  const saved = applySavedContent(snapshot, snapshot, snapshot.content)
  assert.equal(reconcileDiskContent(saved, snapshot, 'stale result'), saved)
})

test('checks and saves from a closed or renamed tab cannot affect its replacement', () => {
  const snapshot = opened()
  const reopened = opened()
  assert.equal(reconcileDiskContent(reopened, snapshot, 'stale'), reopened)
  assert.equal(applySavedContent(reopened, snapshot, 'stale'), reopened)
  const renamed = { ...snapshot, path: '/renamed.md' }
  assert.equal(reconcileDiskContent(renamed, snapshot, 'stale'), renamed)
  assert.equal(applySavedContent(renamed, snapshot, 'stale'), renamed)
})

test('deleted files retain clean or dirty in-memory content instead of being recreated', () => {
  for (const tab of [opened(), edited(opened())]) {
    const next = reconcileDiskContent(tab, tab, null)
    assert.equal(next.content, tab.content)
    assert.deepEqual(next.externalChange, { kind: 'missing' })
    assert.equal(next.diskContent, 'original')
  }
})

test('matching local and external edits converge without a conflict', () => {
  const tab = edited(opened())
  const next = reconcileDiskContent(tab, tab, 'my edits')
  assert.equal(next.dirty, false)
  assert.equal(next.externalChange, null)
  assert.equal(next.diskContent, 'my edits')
})

test('repeated polling leaves an existing conflict unchanged; reverting disk clears it', () => {
  const tab = edited(opened())
  const conflicted = reconcileDiskContent(tab, tab, 'external')
  assert.equal(reconcileDiskContent(conflicted, conflicted, 'external'), conflicted)
  const resolved = reconcileDiskContent(conflicted, conflicted, 'original')
  assert.equal(resolved.content, 'my edits')
  assert.equal(resolved.dirty, true)
  assert.equal(resolved.externalChange, null)
})

test('confirmed reload replaces the content and invalidates the rich editor cache', () => {
  const tab = edited(opened())
  const next = replaceWithDiskContent(tab, 'external')
  assert.equal(next.content, 'external')
  assert.equal(next.diskContent, 'external')
  assert.equal(next.dirty, false)
  assert.equal(next.reloadRevision, 1)
})

test('unreadable files preserve local content and recover when disk becomes readable', () => {
  const tab = edited(opened())
  const failed = withExternalChange(tab, { kind: 'unreadable', message: 'Permission denied' })
  assert.equal(failed.content, 'my edits')
  assert.equal(withExternalChange(failed, failed.externalChange), failed)
  const recovered = reconcileDiskContent(failed, failed, 'original')
  assert.equal(recovered.externalChange, null)
  assert.equal(recovered.dirty, true)
})

test('a delayed change from the old editor cannot undo an external refresh', () => {
  const original = opened()
  const refreshed = reconcileDiskContent(original, original, 'external edits')
  assert.equal(applyEditorChange(refreshed, 'old editor text', original), refreshed)
  const changed = applyEditorChange(refreshed, 'new local edit', refreshed)
  assert.equal(changed.content, 'new local edit')
  assert.equal(changed.dirty, true)
})
