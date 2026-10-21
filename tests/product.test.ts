import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeState } from '../src/engine/create'
import {
  parseEngineResponse,
  parseBackup,
  serializeBackup,
} from '../src/engine/validation'
import { importBooks, listBooks, saveBook } from '../src/engine/library'
import type { Book } from '../src/types/story'
function book(): Book {
  const state = makeState({
    background: 'modern_city',
    trope: 'marriage_first',
    archetype: 'gentle_tease',
    traits: [],
    playerName: '林夏',
  })
  return {
    id: state.config.id,
    title: '先婚后爱',
    state,
    revision: 0,
    updatedAt: new Date().toISOString(),
    archived: false,
    draft: '',
  }
}
test('malformed model responses cannot change story state', () => {
  // No JSON at all, or no prose, still refuses the turn.
  for (const raw of ['not json', '{}', '{"story":"   "}'])
    assert.throws(() => parseEngineResponse(raw))
  // An unusable optional field is dropped instead, so the written scene
  // survives while the bad patch never reaches the save.
  for (const raw of [
    JSON.stringify({
      story: 'hi',
      relationshipProgress: true,
      plotProgress: true,
      plotPatch: { chapter: -1 },
    }),
    JSON.stringify({
      story: 'hi',
      relationshipProgress: true,
      plotProgress: true,
      memories: { content: 'bad' },
    }),
  ]) {
    const parsed = parseEngineResponse(raw)
    assert.equal(parsed.story, 'hi')
    assert.equal(parsed.plotPatch, undefined)
    assert.equal(parsed.memories, undefined)
  }
  assert.equal(
    parseEngineResponse(
      '```json\n{"story":"他把信交给你。","narrative":{"title":"灯下的信","time":{"day":1,"period":"night"}},"relationshipProgress":true,"plotProgress":false}\n```',
    ).story,
    '他把信交给你。',
  )
})
test('book writes are atomic and reject stale revisions from other tabs', async () => {
  const first = await saveBook(book())
  const next = await saveBook({
    ...first,
    pending: { input: '请给我看看。', opening: false },
  })
  await assert.rejects(saveBook({ ...first, title: '过期页面' }), /另一个页面/)
  const found = (await listBooks()).find((b) => b.id === first.id)!
  assert.equal(found.revision, next.revision)
  assert.equal(found.pending?.input, '请给我看看。')
  const complete = await saveBook({ ...found, pending: undefined })
  assert.equal(complete.pending, undefined)
})
test('backups strip unknown secrets and import without overwriting the original', async () => {
  const original = await saveBook(book())
  const raw = serializeBackup([
    { ...original, apiKey: 'secret-that-must-not-export' } as Book,
  ])
  assert.ok(!raw.includes('secret-that-must-not-export'))
  const parsed = parseBackup(raw)
  const copies = await importBooks(parsed)
  assert.notEqual(copies[0].id, original.id)
  assert.equal(copies[0].state.config.id, copies[0].id)
  assert.equal(
    (await listBooks()).filter((b) =>
      [original.id, copies[0].id].includes(b.id),
    ).length,
    2,
  )
  assert.throws(() => parseBackup('{"format":"other"}'))
})

test('tone endpoints guide future chapters and new catalog entries validate', async () => {
  const { toneDirection, buildOpeningPrompt } =
    await import('../src/engine/prompt')
  const { parseStory } = await import('../src/engine/validation')
  assert.match(toneDirection(0), /白头偕老.*不安排死亡/)
  assert.match(toneDirection(100), /生离死别.*长期铺垫/)
  for (const tone of [0, 50, 100]) {
    const state = makeState({
      background: 'republican_era',
      trope: 'saint_exception',
      archetype: 'sharp_soft',
      playerName: '林夏',
      tone,
    })
    assert.equal(parseStory(state).config.tone, tone)
    assert.ok(buildOpeningPrompt(state).includes(`甜虐位置：${tone}/100`))
  }
  const legacy = makeState({
    background: 'wealthy_family',
    trope: 'reunion',
    archetype: 'principled_cold',
    playerName: '林夏',
  })
  assert.ok(buildOpeningPrompt(parseStory(legacy)).includes('豪门世家'))
})
