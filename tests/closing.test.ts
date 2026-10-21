import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeState } from '../src/engine/create'
import {
  isConversationalClosing,
  repetitionIssue,
  turnGuidance,
} from '../src/engine/turns'
import { buildPrompt } from '../src/engine/prompt'
import { generateStory } from '../src/engine/generation'
import type { EngineResponse } from '../src/types/story'
function setup() {
  const s = makeState({
    background: 'overseas',
    trope: 'secret_crush',
    archetype: 'cool_quiet',
    playerName: 'hally',
  })
  s.config.maleLead.name = '梁景川'
  s.messages = [
    '他把水桶放在墙边：“水先放这儿。有事敲门就行，hally。”',
    '“邻居还没找到钥匙。要我去找一趟吗，hally？”',
    '他点头：“好，不开就先别打开。别把译稿弄湿。有事直接敲门，hally。”',
  ].map((content, i) => ({
    id: String(i),
    role: 'narrator' as const,
    content,
    createdAt: new Date().toISOString(),
  }))
  return s
}
// A closing now has to end the scene and then put her somewhere she can act,
// instead of stopping on his back.
const good =
  '他点了下头，转身上楼。\n十分钟后。\n水还没来。你在门口遇见收水表的人，他问起三楼那户。'
const bad = '他转身到楼梯口，又回头补了一句：“有事就敲门。”'
const result = (story: string): EngineResponse => ({
  story,
  narrative: { title: '停水的楼道', time: { day: 1, period: 'night' } },
  plotProgress: false,
  relationshipProgress: false,
})
test('courtesy closure does not swallow a new question, invitation, or unfinished acknowledgement', () => {
  const s = setup()
  for (const input of [
    '嗯，谢谢',
    '不用了，那就先不打开了，谢谢你，景川',
    '谢谢你，景川',
    '晚安',
    '不用了，谢谢',
  ])
    assert.equal(isConversationalClosing(s, input), true, input)
  for (const input of [
    '谢谢你...房东？',
    '谢谢，不过你能先留下吗',
    '谢谢，还有件事想问你',
    '不用了，那钥匙在哪里',
    '嗯',
    '好的',
  ])
    assert.equal(isConversationalClosing(s, input), false, input)
  const prompt = buildPrompt(s, '嗯，谢谢')
  assert.match(turnGuidance(s, '嗯，谢谢'), /允许男主一句回应、点头或转身离开/)
  assert.doesNotMatch(prompt, /离开时，要有玩家能做的具体事|末尾停在男主一句/)
  s.plot.turnsSinceRelationshipProgress = 12
  assert.ok(!buildPrompt(s, '嗯，谢谢').includes('【强制推进】'))
})
test('closing can be short and silent; repeating availability and reminders is caught', () => {
  const s = setup()
  assert.equal(repetitionIssue(s, '嗯，谢谢', good), undefined)
  assert.match(repetitionIssue(s, '嗯，谢谢', bad)!, /礼貌收尾/)
  assert.match(
    repetitionIssue(s, '嗯，谢谢', '他走到门口：“别把译稿弄湿。”')!,
    /叮嘱/,
  )
  assert.equal(
    repetitionIssue(s, '谢谢，不过如果我有事该怎么找你？', bad),
    undefined,
  )
})
test('names do not become sentence suffixes, but real calls and ordinary references remain valid', () => {
  const s = setup()
  assert.match(
    repetitionIssue(s, '嗯，谢谢', '“好，我上楼了，hally。”')!,
    /名字或昵称/,
  )
  assert.equal(
    repetitionIssue(s, '等等', '“hally，小心台阶。”他扶稳了水桶。'),
    undefined,
  )
  assert.equal(
    repetitionIssue(s, '谁来了', '他看了看门牌：“这里写的是hally。”'),
    undefined,
  )
  const fresh = setup()
  fresh.messages = []
  assert.equal(repetitionIssue(fresh, '你好', '“你好，hally。”'), undefined)
})
test('a repeated closing is rewritten once, then committed only as a natural ending', async (t) => {
  const s = setup(),
    before = JSON.stringify(s)
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      calls++
      if (calls === 2)
        assert.match(
          JSON.parse(init.body as string).messages[1].content,
          /礼貌收尾/,
        )
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(result(calls === 1 ? bad : good)),
              },
            },
          ],
        }),
      )
    },
  )
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '嗯，谢谢',
    false,
  )
  assert.equal(next.story, good)
  assert.equal(calls, 2)
  assert.equal(JSON.stringify(s), before)
})
