import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeState } from '../src/engine/create'
import { applyEngineResponse } from '../src/engine/state'
import {
  parseEngineResponse,
  parseStory,
  serializeBackup,
  parseBackup,
} from '../src/engine/validation'
import { readingTitle, timeLabel } from '../src/engine/narrative'
import { buildOpeningPrompt } from '../src/engine/prompt'
import { backgrounds, tropes } from '../src/data/catalog'
import type { EngineResponse, Book } from '../src/types/story'
const start = () =>
  makeState({
    background: 'historical_court',
    trope: 'saint_exception',
    archetype: 'cool_quiet',
    playerName: '林夏',
  })
const response = (
  day: number,
  period: 'day' | 'night',
  title = '值房留灯',
): EngineResponse => ({
  narrative: { title, time: { day, period } },
  story: '他将名册转过来：“名字是我划掉的。先别走，我还有话跟你说。”',
  relationshipProgress: false,
  plotProgress: false,
})
test('story clock stays put during conversation; daylight advances only through explicit model state', () => {
  let state = applyEngineResponse(start(), response(1, 'day'))
  assert.equal(timeLabel(state.narrative?.time), '第一天')
  for (let i = 0; i < 12; i++)
    state = applyEngineResponse(state, response(1, 'day'))
  assert.equal(timeLabel(state.narrative?.time), '第一天')
  state = applyEngineResponse(state, response(1, 'night'))
  assert.equal(timeLabel(state.narrative?.time), '第一夜')
  // A clock that runs backwards is corrected rather than refused: the saved
  // time is kept and the scene is committed, because losing a written turn over
  // a metadata field costs the reader more than the wrong label would.
  const backwards = applyEngineResponse(state, response(1, 'day'))
  assert.equal(timeLabel(backwards.narrative?.time), '第一夜')
  assert.equal(backwards.messages.length, state.messages.length)
  state = applyEngineResponse(state, response(2, 'day', '早来的茶'))
  assert.equal(timeLabel(state.narrative?.time), '第二天')
  assert.equal(readingTitle(state), '早来的茶')
  assert.equal(state.plot.chapter, undefined)
  // A story that opens on day three is pulled back to its first day.
  assert.equal(
    timeLabel(applyEngineResponse(start(), response(3, 'day')).narrative?.time),
    '第一天',
  )
})
test('model must return a contextual title and valid time; trope labels and chapter labels are rejected', () => {
  // A title the engine cannot accept falls back to the placeholder rather than
  // discarding a written turn: the reader loses a title, not the scene.
  for (const title of [
    ...tropes.map((x) => x.title),
    '第一章 雨夜',
    '第二夜',
    '',
  ])
    assert.equal(
      parseEngineResponse(JSON.stringify(response(1, 'night', title))).narrative
        .title,
      '未题',
      title,
    )
  assert.equal(
    parseEngineResponse(JSON.stringify(response(1, 'night'))).narrative.title,
    '值房留灯',
  )
  const missing = parseEngineResponse(
    JSON.stringify({ ...response(1, 'night'), narrative: undefined }),
  )
  assert.equal(missing.narrative.title, '未题')
  assert.equal(missing.narrative.time.day, 1)
  // A day of 0 is repaired to 1; applyEngineResponse then keeps the saved time
  // rather than letting the clock run backwards.
  assert.equal(
    parseEngineResponse(JSON.stringify(response(0, 'day'))).narrative.time.day,
    1,
  )
})
test('legacy saves retain prose, gain time on next reply, and new metadata survives backup', () => {
  const legacy = start()
  legacy.plot.chapter = 7
  legacy.messages = [
    {
      id: 'old-message',
      role: 'narrator',
      content: '旧正文原样保留。',
      chapter: 7,
      createdAt: new Date().toISOString(),
    },
  ]
  assert.equal(readingTitle(parseStory(legacy)), '未题')
  assert.equal(timeLabel(legacy.narrative?.time), '此刻')
  const next = applyEngineResponse(legacy, response(1, 'night'))
  const book: Book = {
    id: next.config.id,
    title: '值房留灯',
    state: next,
    revision: 1,
    updatedAt: new Date().toISOString(),
    archived: false,
    draft: '',
  }
  const restored = parseBackup(serializeBackup([book]))[0].state
  assert.deepEqual(restored.narrative, next.narrative)
  assert.deepEqual(restored.messages, legacy.messages)
})
test('local openings offer an immediate conversation in each world without a mystery questionnaire', () => {
  for (const bg of backgrounds)
    for (const trope of tropes) {
      const state = makeState({
        background: bg.id,
        trope: trope.id,
        archetype: 'cool_quiet',
        playerName: '林夏',
      })
      const prompt = buildOpeningPrompt(state)
      assert.ok(prompt.includes(state.config.maleLead.name))
      assert.match(prompt, /约180–300字/)
      assert.match(prompt, /时间从第1天或第1夜开始/)
      assert.match(prompt, /不预设玩家回答/)
      assert.match(prompt, /同一个世界重开一局/)
      assert.equal(timeLabel({ day: 1, period: 'night' }), '第一夜')
    }
})
