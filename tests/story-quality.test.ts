import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeState } from '../src/engine/create'
import { buildOpeningPrompt, buildPrompt } from '../src/engine/prompt'
import { backgrounds, archetypes, tropes } from '../src/data/catalog'
import { maleRoles, storyWorlds } from '../src/engine/worlds'
import { parseEngineResponse, parseStory } from '../src/engine/validation'
import { applyEngineResponse } from '../src/engine/state'
import { timeLabel } from '../src/engine/narrative'
import { repetitionIssue, turnGuidance } from '../src/engine/turns'
import { formatStory, styleIssue } from '../src/engine/style'
import { generateStory } from '../src/engine/generation'
import type { EngineResponse } from '../src/types/story'
const state = () =>
  makeState({
    background: 'hongkong_circle',
    trope: 'saint_exception',
    archetype: 'restrained_power',
    playerName: '心',
  })
const response = (story: string): EngineResponse => ({
  story,
  narrative: { title: '旧宅来客', time: { day: 1, period: 'night' } },
  relationshipProgress: false,
  plotProgress: true,
})
const badRead = '他按住暂停键，低声说：“你先按稿念出那句，准备好了就开始。”'
const badReview = '他翻开末页，抬眼看你：“要我把需要注意的地方圈出来吗？”'
const good =
  '他听完便圈出一个词：“录音说的是暂缓，不是取消。改这里就行，剩下的我去解释。”'

test('UI jokes stay out of generation; world details and stable male identity survive save parsing', () => {
  for (const bg of backgrounds) {
    const s = makeState({
      background: bg.id,
      trope: 'saint_exception',
      archetype: 'restrained_power',
      playerName: '心',
    })
    const saved = parseStory(s)
    // A new story carries a direction, not a fixed identity: the model writes
    // the concrete one on the first turn and it is pinned from then on.
    assert.equal(saved.config.maleLead.background, undefined)
    assert.deepEqual(saved.config.openingSituation, s.config.openingSituation)
    // Drawn from the world's pool rather than tied to the scenario, so that a
    // world with five scenarios no longer means five men.
    assert.ok(
      maleRoles[bg.id].includes(saved.config.openingSituation!.maleHint!),
      bg.id,
    )
    const prompt = buildOpeningPrompt(saved)
    for (const card of [...backgrounds, ...tropes, ...archetypes])
      assert.ok(!prompt.includes(card.subtitle), card.subtitle)
    assert.match(prompt, /不要照抄这个方向/)
    assert.ok(prompt.includes(saved.config.openingSituation!.maleHint!))
    const pinned = applyEngineResponse(saved, {
      story: '他把门带上。“坐。”',
      narrative: { title: '进门', time: { day: 1, period: 'night' } },
      relationshipProgress: false,
      plotProgress: true,
      maleBackground: '替家里看着两间旧铺面的次子',
    })
    assert.equal(
      pinned.config.maleLead.background,
      '替家里看着两间旧铺面的次子',
    )
    assert.ok(
      buildPrompt(pinned, '你怎么在这').includes('替家里看着两间旧铺面的次子'),
    )
  }
  const prompt = buildOpeningPrompt(state())
  assert.match(prompt, /粤语/)
  assert.match(prompt, /信托/)
  assert.match(prompt, /至少两处侧面信息/)
  for (const opening of storyWorlds.hongkong_circle.scenarios) {
    const s = state()
    s.config.openingSituation = { ...opening, maleHint: opening.maleBackground }
    const seeded = buildOpeningPrompt(s)
    assert.ok(seeded.includes(opening.socialCue))
    assert.ok(seeded.includes(opening.localLine))
    assert.match(seeded, /场景种子是方向不是脚本/)
  }
})
test('completed tasks and delegated checks do not become another permission loop', () => {
  const s = state()
  for (const input of ['按照他说的做', '开口念那一句', '播放录音']) {
    assert.ok(repetitionIssue(s, input, badRead))
    assert.equal(repetitionIssue(s, input, good), undefined)
    assert.match(turnGuidance(s, input), /已完成|已执行|已.*授权/)
  }
  assert.ok(repetitionIssue(s, '阿sir，你先过目啦', badReview))
  assert.equal(repetitionIssue(s, '不用过目，我要走了', badReview), undefined)
  assert.match(
    turnGuidance(s, '不用了，我已经知道了，然后负气离开'),
    /已经移动或离场/,
  )
  const prompt = buildPrompt(s, '开口念那一句')
  assert.match(prompt, /它们不是真实上传材料/)
  assert.match(prompt, /不能再等她逐字输入/)
})
test('style rules avoid requested tics without erasing normal speech', () => {
  assert.ok(styleIssue('他顿了一下——“你把我看得太轻了。”'))
  assert.ok(styleIssue('“你把我看得太轻了。”'))
  assert.equal(styleIssue('“这份账我看不懂，得找懂行的人。”'), undefined)
  const s = state()
  s.messages = [
    {
      id: 'n',
      role: 'narrator',
      createdAt: new Date().toISOString(),
      content: good,
    },
  ]
  assert.ok(repetitionIssue(s, '嗯', good))
  assert.equal(
    repetitionIssue(
      s,
      '我想回去了',
      '他拿起车钥匙，起身去门口：“走吧，我送你。”',
    ),
    undefined,
  )
})
test('time skip labels persist through a scene and reload but are not repeated on the next day', () => {
  let s = applyEngineResponse(state(), response('“先坐。”'))
  const jump = response('三个月后，他出差回来。')
  jump.narrative = {
    title: '归来的行李',
    time: { day: 91, period: 'night', label: '三个月后' },
  }
  s = applyEngineResponse(s, parseEngineResponse(JSON.stringify(jump)))
  assert.equal(timeLabel(s.narrative!.time), '三个月后')
  const continued = response('他放下行李：“这次留得久些。”')
  continued.narrative = {
    title: '归来的行李',
    time: { day: 91, period: 'night' },
  }
  s = applyEngineResponse(s, continued)
  assert.equal(
    timeLabel(parseStory(JSON.parse(JSON.stringify(s))).narrative!.time),
    '三个月后',
  )
  const next = response('天亮了。')
  next.narrative = {
    title: '归来的行李',
    time: { day: 92, period: 'day', label: '三个月后' },
  }
  s = applyEngineResponse(s, next)
  assert.equal(timeLabel(s.narrative!.time), '第九十二天')
  // Replaying the earlier jump no longer refuses the turn: the clock holds at
  // the saved day and the scene is written anyway.
  const replayed = applyEngineResponse(s, jump)
  assert.equal(timeLabel(replayed.narrative!.time), '第九十二天')
})
test('quality repair is bounded, sends system rules, and never mutates the saved story', async (t) => {
  const s = state(),
    before = JSON.stringify(s),
    requests: any[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string))
      const story = requests.length === 1 ? badRead : good
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: { content: JSON.stringify(response(story)) },
            },
          ],
        }),
        { status: 200 },
      )
    },
  )
  const result = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '开口念那一句',
    false,
  )
  assert.equal(result.story, formatStory(good))
  assert.equal(requests.length, 2)
  assert.equal(requests[0].messages[0].role, 'system')
  assert.ok(!requests[0].messages[0].content.includes('【玩家刚才的输入】'))
  assert.match(requests[1].messages[1].content, /本轮重写/)
  assert.equal(JSON.stringify(s), before)
})
test('a second bad draft is rejected instead of retrying forever', async (t) => {
  const s = state(),
    before = JSON.stringify(s)
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: JSON.stringify(response(badReview)) } },
        ],
      }),
      { status: 200 },
    )
  })
  await assert.rejects(
    generateStory(
      { apiKey: 'fixture', model: 'fixture' },
      s,
      '阿sir，你先过目啦',
      false,
    ),
    /没有写入/,
  )
  assert.equal(calls, 2)
  assert.equal(JSON.stringify(s), before)
})
