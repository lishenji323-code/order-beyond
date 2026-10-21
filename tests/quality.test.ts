import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeState } from '../src/engine/create'
import {
  formatStory,
  measureStyle,
  paragraphShape,
  softStyleIssues,
  styleIssue,
} from '../src/engine/style'
import { partialStory, resetProviderFlags } from '../src/engine/openrouter'
import {
  DAILY_TURN_CAP,
  MAX_TOKENS_CAP,
  TRIAL_BURST,
  TRIAL_TURNS,
  checkTrial,
  emptyUsage,
  sanitizeRequest,
} from '../src/engine/trial'
import {
  chooseScenario,
  maleRoles,
  openingPlaces,
  playerRoles,
  storyWorlds,
} from '../src/engine/worlds'
import {
  affinityOf,
  affinityShift,
  affinityStage,
} from '../src/engine/affinity'
import { backgrounds, getTrope, tropes } from '../src/data/catalog'
import {
  generateIdentity,
  randomMaleName,
  relationshipSeeds,
} from '../src/engine/identity'
import {
  CONTINUE_TURN,
  continuityIssue,
  echoIssue,
  isConversationalClosing,
  openingIssue,
  repeatedExitIssue,
  repetitionIssue,
  softSceneIssues,
  turnGuidance,
} from '../src/engine/turns'
import {
  buildOpeningPrompt,
  buildPrompt,
  intimacyDirection,
} from '../src/engine/prompt'
import { applyEngineResponse } from '../src/engine/state'
import {
  looksTruncated,
  parseEngineResponse,
  parseStory,
} from '../src/engine/validation'
import { generateStory, qualityIssues } from '../src/engine/generation'
import type {
  EngineResponse,
  RelationshipState,
  StoryState,
} from '../src/types/story'

const base = () =>
  makeState({
    background: 'overseas',
    trope: 'secret_crush',
    archetype: 'cool_quiet',
    playerName: 'hally',
  })

const said = (state: StoryState, ...contents: string[]) => {
  state.messages = contents.map((content, i) => ({
    id: String(i),
    role: 'narrator' as const,
    content,
    createdAt: new Date().toISOString(),
  }))
  return state
}

const response = (story: string): EngineResponse => ({
  story,
  narrative: { title: '停水的楼道', time: { day: 1, period: 'night' } },
  relationshipProgress: false,
  plotProgress: false,
})

test('the failing turn from the water-bucket log is caught, and a short turn is not', () => {
  const log4 =
    '他看你收回提议，手臂松了松，把水桶靠墙放好：“好，不开就先别打开。水先放这儿，别把译稿弄湿。修好前我住楼上，有事直接敲门，hally。”'
  const log5 =
    '他点点头，把手按在水桶沿上，声音干冷却不急：“别把稿子弄湿，先放回袋子里。我上去看看管道，晚点会在楼上。”他转身到楼梯口，回头补了一句，“有事就敲门。”'
  // 62 characters in one paragraph: inside the outlier guard, but well past the
  // 50-character soft line, and the dialogue pooled over recent turns runs long.
  assert.equal(measureStyle(log5).longestParagraph, 62)
  assert.equal(styleIssue(log5), undefined)
  const soft = softStyleIssues(log5, [
    '他把桶靠在你脚边，语气收了收：“邻居说他见过那把钥匙，但也记不清放哪儿了。不像是丢了，就是被收在楼下那个旧鞋柜或杂物箱里。要我现在下去再找一趟吗，hally？”',
    log4,
  ])
  assert.equal(soft.length, 2)
  assert.match(soft.join(), /有段落62字/)
  assert.match(soft.join(), /台词整体偏长/)
  const short = '他点头。\n\n“管道我上去看看。”\n\n他走到楼梯口，没回头。'
  assert.equal(styleIssue(short), undefined)
  assert.equal(
    softStyleIssues(short, [
      '他把桶靠在你脚边，语气收了收：“邻居说他见过那把钥匙，但也记不清放哪儿了。不像是丢了，就是被收在楼下那个旧鞋柜或杂物箱里。要我现在下去再找一趟吗，hally？”',
      log4,
    ]).length,
    0,
  )
})

test('an outlier paragraph is a hard failure, and the opening is allowed more room', () => {
  const heavy =
    '楼道里的水汽还没散，他把桶提起来走下去，和守在楼梯口的邻居说了两句，那人叫他房东，又问起你父亲留在旧公寓里的那把钥匙，他没接这个话，端着水上来放在你脚边，说这一桶先用着，修好之前他都在楼上。'
  assert.equal(measureStyle(heavy).longestParagraph, 86)
  assert.match(styleIssue(heavy)!, /有段落超过80字/)
  // An opening of 180 to 300 characters often lands in one or two paragraphs.
  // Hard-failing that would spend the turn's single rewrite on a second
  // full-length request, which is what made the first scene slow and flaky.
  const openingParagraph = heavy + heavy.slice(0, 60)
  assert.ok(measureStyle(openingParagraph).longestParagraph > 140)
  assert.equal(styleIssue(openingParagraph, { opening: true }), undefined)
  assert.ok(styleIssue(openingParagraph))
})

test('description quota, repeated shape and consecutive scenery openings are soft', () => {
  const scenery = '雨还没停，楼道的灯一明一暗。\n\n“伞在门口。”'
  assert.equal(softStyleIssues(scenery, []).length, 0)
  assert.match(
    softStyleIssues(scenery, [scenery]).join(),
    /连续两轮都以环境描写开头/,
  )
  const sceneryHeavy =
    '雨还没停，楼道的灯一明一暗，铁栏杆上挂着水珠。\n\n楼下传来关门的声响，空气里有股霉味。\n\n“伞在门口。”'
  assert.match(softStyleIssues(sceneryHeavy, []).join(), /描写超出额度/)
  const shaped = '他合上册子。\n\n“明天再看。”\n\n他把册子放回架上。'
  assert.equal(paragraphShape(shaped), 'NDN')
  assert.equal(softStyleIssues(shaped, []).length, 0)
  assert.match(
    softStyleIssues(shaped, [shaped, shaped]).join(),
    /段落形状和前两轮相同/,
  )
})

test('one soft indicator is reported and committed; two together fail the turn', () => {
  // Same three-paragraph shape three turns running, but no repeated wording:
  // that is a soft indicator on its own, not a hard failure.
  const shaped = '他合上册子。\n\n“明天再看。”\n\n他把册子放回架上。'
  const onlyShape = qualityIssues(
    said(
      base(),
      '他收起钢笔。\n\n“先这样。”\n\n他把纸压在镇尺下面。',
      '他关了台灯。\n\n“不急。”\n\n他把椅子推回原位。',
    ),
    '好',
    { story: shaped },
    false,
  )
  assert.equal(onlyShape.hard.length, 0)
  assert.equal(onlyShape.soft.length, 1)
  assert.equal(onlyShape.failed, false)
  const log4 =
    '他看你收回提议，手臂松了松，把水桶靠墙放好：“好，不开就先别打开。水先放这儿，别把译稿弄湿。修好前我住楼上，有事直接敲门，hally。”'
  const log5 =
    '他点点头，把手按在水桶沿上，声音干冷却不急：“别把稿子弄湿，先放回袋子里。我上去看看管道，晚点会在楼上。”他转身到楼梯口，回头补了一句，“有事就敲门。”'
  const both = qualityIssues(
    said(
      base(),
      '他把桶靠在你脚边，语气收了收：“邻居说他见过那把钥匙，但也记不清放哪儿了。不像是丢了，就是被收在楼下那个旧鞋柜或杂物箱里。要我现在下去再找一趟吗，hally？”',
      log4,
    ),
    '好',
    { story: log5 },
    false,
  )
  assert.equal(both.soft.length, 2)
  assert.equal(both.failed, true)
  // The opening is exempt from the soft indicators entirely.
  assert.equal(qualityIssues(base(), '', { story: log5 }, true).soft.length, 0)
})

test('anything already established cannot be said again, and a declined offer stays dead', () => {
  const s = base()
  s.sceneState = {
    status: 'open',
    established: ['水修好前他住楼上，有事敲门', '邻居见过你父亲留下的钥匙'],
    props: ['水桶：在你脚边'],
    offers: [{ content: '现在下去问邻居要钥匙', status: 'declined' }],
  }
  assert.match(
    repetitionIssue(
      s,
      '那钥匙呢',
      '他指了指楼上：“水修好前他住楼上，有事敲门。”',
    )!,
    /已经交代过的内容/,
  )
  assert.match(
    repetitionIssue(s, '那钥匙呢', '“要我现在下去问邻居要钥匙吗？”')!,
    /已经被拒绝的提议/,
  )
  assert.equal(
    repetitionIssue(
      s,
      '那钥匙呢',
      '“配电箱后面有颗钉子。”他往楼下抬了下下巴。',
    ),
    undefined,
  )
})

test('an eight-character echo of the previous turn is rejected even when the player only says 好', () => {
  // The bare acknowledgement is deliberately not classified as a closing by the
  // program, so this repetition has to be caught without knowing the intent.
  const s = said(
    base(),
    '他点点头：“别把稿子弄湿。我上去看看管道，晚点会在楼上。”',
  )
  assert.equal(isConversationalClosing(s, '好'), false)
  assert.match(
    repetitionIssue(
      s,
      '好',
      '他又看了一眼你怀里的稿子：“别让稿子湿了。我上去看看管道，晚点会在楼上，有事敲门。”',
    )!,
    /和上一轮正文重合超过八个字/,
  )
  assert.equal(repetitionIssue(s, '好', '他点头，上楼去了。'), undefined)
})

test('a closing turn cannot carry a fresh offer', () => {
  const s = said(base(), '他把桶放在墙边。“这一桶先用。”')
  assert.match(
    repetitionIssue(s, '嗯，谢谢', '他顿了顿：“要不要我明天再来看看？”')!,
    /又提出一个新的提议/,
  )
  assert.equal(repetitionIssue(s, '嗯，谢谢', '他点头，上楼去了。'), undefined)
})

test('scene bookkeeping accumulates, replaces object positions, and clears on a new scene', () => {
  let s = base()
  s = applyEngineResponse(s, {
    ...response('他把桶放在你脚边。'),
    scenePatch: {
      status: 'open',
      established: ['水修好前他住楼上'],
      props: ['水桶：在你脚边'],
      offers: [{ content: '下去问邻居要钥匙', status: 'pending' }],
    },
  })
  assert.deepEqual(s.sceneState!.established, ['水修好前他住楼上'])
  s = applyEngineResponse(s, {
    ...response('“不用问了。”他把桶提进门。'),
    scenePatch: {
      established: ['钥匙在配电箱后面'],
      props: ['水桶：在门内'],
      offers: [{ content: '下去问邻居要钥匙', status: 'declined' }],
    },
  })
  assert.deepEqual(s.sceneState!.established, [
    '水修好前他住楼上',
    '钥匙在配电箱后面',
  ])
  assert.deepEqual(s.sceneState!.props, ['水桶：在门内'])
  assert.deepEqual(s.sceneState!.offers, [
    { content: '下去问邻居要钥匙', status: 'declined' },
  ])
  // Closing the scene, then a new one, starts the bookkeeping over.
  s = applyEngineResponse(s, {
    ...response('他点头，上楼去了。'),
    scenePatch: { status: 'closed' },
  })
  assert.equal(s.sceneState!.status, 'closed')
  assert.equal(s.sceneState!.established.length, 2)
  s = applyEngineResponse(s, {
    ...response('第二天傍晚。他在楼下等着。'),
    narrative: { title: '第二天的楼下', time: { day: 2, period: 'night' } },
    scenePatch: { status: 'open', established: ['他修好了水管'] },
  })
  assert.deepEqual(s.sceneState!.established, ['他修好了水管'])
  assert.deepEqual(s.sceneState!.props, [])
})

test('a closed scene suppresses the forced-advance instruction', () => {
  const s = base()
  s.plot.turnsSinceRelationshipProgress = 14
  assert.ok(buildPrompt(s, '你在忙什么').includes('【强制推进】'))
  s.sceneState = { status: 'closed', established: [], props: [], offers: [] }
  assert.ok(!buildPrompt(s, '你在忙什么').includes('【强制推进】'))
})

test('the scene state and the previous reply reach the model', () => {
  const s = said(base(), '他把桶放在墙边。“这一桶先用。”')
  s.sceneState = {
    status: 'open',
    established: ['水修好前他住楼上'],
    props: ['水桶：在你脚边'],
    offers: [{ content: '下去问邻居要钥匙', status: 'declined' }],
  }
  const prompt = buildPrompt(s, '钥匙在哪里')
  assert.match(prompt, /已经说出口、不得再说第二次的内容/)
  assert.match(prompt, /水修好前他住楼上/)
  assert.match(prompt, /已被拒绝，本场不得重提/)
  assert.match(prompt, /上一轮正文（不得有超过八个字与之重合的句子）/)
  assert.match(prompt, /这一桶先用/)
})

test('the rating comes from the save, and the model cannot change it', () => {
  for (const [level, cue] of [
    ['fade', /止|切场/],
    ['implicit', /不写生殖器/],
    ['explicit', /允许直接的身体/],
  ] as const) {
    const s = makeState({
      background: 'modern_city',
      trope: 'reunion',
      archetype: 'restrained_power',
      playerName: '林夏',
      intimacyLevel: level,
    })
    assert.equal(s.config.intimacyLevel, level)
    const prompt = buildPrompt(s, '你怎么来了')
    assert.match(prompt, cue)
    assert.match(prompt, /不由对话内容推断/)
    assert.match(prompt, /所有人物均为成年人/)
  }
  assert.match(intimacyDirection(), /不写生殖器/)
  // A model reply carrying its own rating is stripped, not applied.
  const s = makeState({
    background: 'modern_city',
    trope: 'reunion',
    archetype: 'restrained_power',
    playerName: '林夏',
    intimacyLevel: 'fade',
  })
  const parsed = parseEngineResponse(
    JSON.stringify({
      ...response('他把伞收起来。'),
      intimacyLevel: 'explicit',
      config: { intimacyLevel: 'explicit' },
    }),
  )
  assert.ok(!('intimacyLevel' in parsed))
  assert.equal(applyEngineResponse(s, parsed).config.intimacyLevel, 'fade')
})

test('legacy saves without scene state or a rating keep working and gain both', () => {
  const legacy = JSON.parse(JSON.stringify(base())) as Record<string, unknown>
  delete legacy.sceneState
  delete (legacy.config as Record<string, unknown>).intimacyLevel
  const parsed = parseStory(legacy)
  assert.equal(parsed.sceneState, undefined)
  assert.equal(parsed.config.intimacyLevel, undefined)
  const prompt = buildPrompt(parsed, '你在吗')
  assert.match(prompt, /旧存档没有记录场景状态/)
  assert.match(prompt, /不写生殖器/)
  assert.equal(repetitionIssue(parsed, '好', '他点头，上楼去了。'), undefined)
  const next = applyEngineResponse(parsed, {
    ...response('他点头，上楼去了。'),
    scenePatch: { status: 'open', established: ['他住楼上'] },
  })
  assert.deepEqual(next.sceneState, {
    status: 'open',
    established: ['他住楼上'],
    props: [],
    offers: [],
    position: undefined,
  })
})

test('three bare acknowledgements in a row cannot each restate the same reminder', async (t) => {
  const s = said(base(), '他把桶靠在墙边：“别把译稿弄湿。修好前我住楼上。”')
  s.sceneState = {
    status: 'open',
    established: ['水修好前他住楼上，有事敲门', '别把译稿弄湿'],
    props: ['水桶：在你脚边'],
    offers: [],
  }
  const before = JSON.stringify(s)
  const bad = '他又叮嘱一句：“别把译稿弄湿。修好前我住楼上。”'
  const good = '他点头，上楼去了。\n十分钟后。\n水还没来，你去敲隔壁的门。'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(response(calls === 1 ? bad : good)),
            },
          },
        ],
      }),
    )
  })
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '好',
    false,
  )
  assert.equal(next.story, good)
  assert.equal(calls, 2)
  assert.equal(JSON.stringify(s), before)
})

test('soft-only drafts are committed and reported to the caller', async (t) => {
  const shaped = '他合上册子。\n\n“明天再看。”\n\n他把册子放回架上。'
  const s = said(
    base(),
    '他收起钢笔。\n\n“先这样。”\n\n他把纸压在镇尺下面。',
    '他关了台灯。\n\n“不急。”\n\n他把椅子推回原位。',
  )
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(response(shaped)) } }],
        }),
      ),
  )
  const notes: string[][] = []
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '嗯',
    false,
    undefined,
    (n) => notes.push(n),
  )
  assert.equal(next.story, formatStory(shaped))
  assert.equal(notes.length, 1)
  assert.match(notes[0][0], /段落形状和前两轮相同/)
})

test('a truncated reply is retried once with a larger budget before failing', async (t) => {
  const s = said(base(), '他把册子放回架上。')
  const budgets: number[] = []
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      calls++
      budgets.push(JSON.parse(init.body as string).max_tokens)
      if (calls === 1)
        return new Response(
          JSON.stringify({ choices: [{ finish_reason: 'length' }] }),
        )
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify(response('他点头，上楼去了。')),
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
    '嗯',
    false,
  )
  assert.equal(next.story, '他点头，上楼去了。')
  assert.deepEqual(budgets, [4000, 8000])
})

test('two truncated replies in a row report the reasoning-model cause', async (t) => {
  const s = said(base(), '他把册子放回架上。')
  const before = JSON.stringify(s)
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ choices: [{ finish_reason: 'length' }] })),
  )
  await assert.rejects(
    generateStory({ apiKey: 'fixture', model: 'fixture' }, s, '嗯', false),
    /推理型模型/,
  )
  assert.equal(JSON.stringify(s), before)
})

test('narration that names the language spoken, or tells the player to act, is a hard failure', () => {
  assert.match(
    styleIssue(
      '“聽住。”他短促地说粤语，“唔好寫我父親個名。”\n\n又换普通话补了一句，“署名你自己把关。”',
    )!,
    /语言说明/,
  )
  assert.match(
    styleIssue('他按下楼层。电梯门开始合拢，等待你的动作。')!,
    /旁白在催玩家行动/,
  )
  assert.match(
    styleIssue('他靠在门框上，视线落在你掌心的便笺上，等你说话。')!,
    /旁白在催玩家行动/,
  )
  // Cantonese itself is fine; only the narrated label is not.
  assert.equal(
    styleIssue('“坐我隔篱。”他把椅子拉开，“其他嘢我会处理。”'),
    undefined,
  )
})

test('act one must not read the appearance card aloud', () => {
  const s = base()
  s.config.maleLead.appearance.signature = '耳骨一排细小耳钉'
  assert.match(
    openingIssue(s, '他站在电梯厅，外套敞开，耳骨上那排细小耳钉在灯下亮了。')!,
    /第一幕报了男主的外貌/,
  )
  assert.equal(
    openingIssue(s, '他站在电梯厅，外套敞开，按住了电梯门。'),
    undefined,
  )
  assert.equal(
    qualityIssues(s, '', { story: '他按住电梯门。“上来。”' }, true).hard.length,
    0,
  )
})

test('an object handled three turns running is a soft indicator', () => {
  const s = said(base(), '他把便笺塞进你手心。', '他把你掌心的便笺拨开一角。')
  s.sceneState = {
    status: 'open',
    established: [],
    props: ['便笺：在你手里'],
    offers: [],
  }
  assert.match(
    softSceneIssues(s, '他指尖在便笺边上摩了一下。')[0],
    /连续三轮出现在动作里/,
  )
  assert.deepEqual(softSceneIssues(s, '他按了电梯键，没再说话。'), [])
})

test('a departure sticks: he cannot be back in the room without being called or shown returning', () => {
  const s = base()
  s.sceneState = {
    status: 'open',
    established: [],
    props: [],
    offers: [],
    position: { where: '电梯里，门已合上', status: 'gone' },
  }
  const ghost =
    '你还站在会所走廊。他把你掌心的便笺拨开一角。“唔好寫我父親個名。”'
  assert.match(
    continuityIssue(s, '裴先生还有什么吩咐吗', ghost, {
      position: { where: '她面前', status: 'present' },
    })!,
    /上一轮他已经离开/,
  )
  // Omitting position does not launder the contradiction.
  assert.match(
    continuityIssue(s, '裴先生还有什么吩咐吗', ghost)!,
    /上一轮他已经离开/,
  )
  // The player calling him back is the legitimate route.
  assert.equal(
    continuityIssue(s, '稍等一下', ghost, {
      position: { where: '门口', status: 'present' },
    }),
    undefined,
  )
  // So is prose that actually shows him coming back.
  assert.equal(
    continuityIssue(s, '裴先生', '他按住了电梯门，又退回来。“讲。”', {
      position: { where: '门口', status: 'present' },
    }),
    undefined,
  )
  // A phone call does not put him in the room.
  assert.equal(
    continuityIssue(s, '他人呢', '手机震了一下，是他的电话。“稿子改好没有。”', {
      position: { where: '电梯里', status: 'gone' },
    }),
    undefined,
  )
})

test('leaving twice running is a soft indicator', () => {
  const s = said(base(), '他说完，按了下楼层键，转身离开。')
  assert.match(
    repeatedExitIssue(s, '他侧身往电梯里走去，离开了。')[0],
    /上一轮已经离开过一次/,
  )
  assert.deepEqual(repeatedExitIssue(s, '他停在门口，没说话。'), [])
})

test('position carries forward when a turn says nothing about it', () => {
  let s = applyEngineResponse(base(), {
    ...response('他走进电梯。'),
    scenePatch: { position: { where: '电梯里', status: 'gone' } },
  })
  assert.equal(s.sceneState!.position!.status, 'gone')
  s = applyEngineResponse(s, {
    ...response('走廊灯灭了一盏。'),
    scenePatch: { established: ['走廊的灯坏了一盏'] },
  })
  assert.equal(s.sceneState!.position!.status, 'gone')
})

test('a partial JSON body yields the story text as it arrives', () => {
  assert.equal(partialStory('{"story": "他点头'), '他点头')
  assert.equal(
    partialStory('{"story": "他点头。\\n“明天再看。”'),
    '他点头。\n“明天再看。”',
  )
  assert.equal(
    partialStory('{"story": "他点头。", "narrative": {}}'),
    '他点头。',
  )
  // Nothing usable yet, and half-received escapes never leak.
  assert.equal(partialStory('{"narr'), '')
  assert.equal(partialStory('{"story": "他\\'), '他')
  assert.equal(partialStory('{"story": "他\\u4e0a'), '他上')
})

test('every spoken line is laid out on its own row', () => {
  assert.equal(
    formatStory(
      '他靠回门框，指了指椅子。“坐低，講嚟聽。”声音低到只够你们两人听见。',
    ),
    '他靠回门框，指了指椅子。\n“坐低，講嚟聽。”\n声音低到只够你们两人听见。',
  )
  assert.equal(
    formatStory('他点头。\n\n“明天再看。”'),
    '他点头。\n“明天再看。”',
  )
  assert.equal(formatStory('他点头，转身上楼。'), '他点头，转身上楼。')
})

test('speech without quotation marks is caught instead of slipping past every dialogue check', () => {
  const unquoted =
    '他朝餐厅看了一眼，唇线绷着。声音放低，带了句粤语。二叔会问董事席，我知道。但今晚我唔去餐廳。'
  assert.equal(measureStyle(unquoted).dialogue.length, 0)
  assert.match(styleIssue(unquoted)!, /没有用引号/)
})

test('narration does not quote the player back to herself', () => {
  assert.match(
    echoIssue('我担心你', '你说了句短话：我担心你。他听到，身子微转。')!,
    /复述/,
  )
  // An echo inside his own line is a different thing and stays allowed.
  assert.equal(echoIssue('我担心你', '他抬眼。\n“担心我？”'), undefined)
  assert.equal(echoIssue('嗯', '他点头，上楼去了。'), undefined)
})

test('the opening place is drawn independently of the scenario', () => {
  const places = new Set(
    Array.from({ length: 60 }, () => chooseScenario('hongkong_circle').place),
  )
  assert.ok(places.size >= 6, `only ${places.size} distinct places`)
  for (const bg of backgrounds) {
    const pool = openingPlaces[bg.id]
    assert.ok(pool.length >= 6, bg.id)
    assert.ok(pool.every((place) => place.length <= 20))
    assert.ok(pool.includes(chooseScenario(bg.id).place), bg.id)
  }
})

test('empty figures of speech and interpretive tails are caught', () => {
  assert.match(
    styleIssue('他的手没收回，拇指在你手背上蹭了两下，像是确认。')!,
    /没有具体所指的比喻/,
  )
  assert.match(styleIssue('你坐在椅子上，前厅的低语像被拉长的线。')!, /比喻/)
  assert.match(
    softStyleIssues(
      '他往你旁边拉出一把椅子，动作不多，却把你的位置固定下来。',
    )[0],
    /解释它意味着什么/,
  )
  // An ordinary physical action with 却 is untouched, and so is one plain simile.
  assert.deepEqual(softStyleIssues('风很大，他却把门固定住了。'), [])
  assert.equal(styleIssue('他把椅子拉开。\n“坐。”'), undefined)
})

test('three turns of the same length is a rhythm problem', () => {
  assert.match(
    softStyleIssues('一'.repeat(100), [
      '二'.repeat(102),
      '三'.repeat(98),
    ]).join(),
    /连续三轮的长度几乎一样/,
  )
  assert.doesNotMatch(
    softStyleIssues('他点头。', ['二'.repeat(102), '三'.repeat(98)]).join(),
    /连续三轮的长度几乎一样/,
  )
})

test('a departure written in prose binds even when the turn records no position', () => {
  const s = said(base(), '他说完便转身走开，脚步稳健。')
  assert.match(
    continuityIssue(
      s,
      '坐在椅子上等待',
      '他在餐厅门口回头，靠着门框。\n“有事打畀我。”',
    )!,
    /上一轮他已经离开/,
  )
  // A new scene starts the room over.
  assert.equal(
    continuityIssue(
      s,
      '坐在椅子上等待',
      '第二天傍晚。他在门口等你。',
      undefined,
      true,
    ),
    undefined,
  )
})

test('narration made of body choreography is flagged against the corpus baseline', () => {
  // 4.8% of corpus narration sentences carry a posture or gaze word; a turn
  // built out of them is doing stage directions instead of telling the reader
  // what happened.
  const choreography =
    '你坐在椅子上。\n他在餐厅门口回头，靠着门框。\n视线落在你肩上的布包。\n他又抬起看了你一眼。'
  assert.match(softStyleIssues(choreography, []).join(), /句在写身体姿态/)
  const informative =
    '管家点头，转身去厨房外头叫人。\n二叔已经在餐厅坐下了。\n他把请柬递过来。'
  assert.doesNotMatch(softStyleIssues(informative, []).join(), /身体姿态/)
  // One such sentence among several is ordinary and stays clean.
  assert.doesNotMatch(
    softStyleIssues(
      '他把请柬递过来。\n二叔已经坐下了。\n他的视线扫过门口。\n管家去叫人了。',
      [],
    ).join(),
    /身体姿态/,
  )
})

test('a two-character turn is valid and a summing-up coda is not', () => {
  // The whole turn can be one short line; nothing is padded onto it.
  assert.equal(styleIssue('“不要。”'), undefined)
  assert.equal(styleIssue('“好。”'), undefined)
  assert.equal(
    styleIssue('他点头，转身上楼。\n十分钟后。\n楼下有人在敲门。'),
    undefined,
  )
  assert.equal(softStyleIssues('“不要。”', []).length, 0)
  for (const coda of [
    '他把杯子放下，转身走了。他只是把一切看得很轻',
    '他点了下头。不过是顺路罢了',
    '他没解释。他向来只是做，不说',
    '他挂了电话。这大概就是他的方式',
  ])
    assert.match(styleIssue(coda)!, /结尾加了一句对人物或关系的总结/, coda)
  // The same words inside his own line are speech, not authorial summing-up.
  assert.equal(styleIssue('“我只是顺路而已。”他把伞收起来'), undefined)
})

test('every world has distinct scenarios and none are borrowed from another', () => {
  // storyWorlds also carries workplace and wealthy_family, which the selection
  // screen no longer offers but old saves still use; they need their own
  // scenarios rather than another world's.
  const seen = new Map<string, string>()
  for (const id of Object.keys(storyWorlds) as (keyof typeof storyWorlds)[]) {
    const scenarios = storyWorlds[id].scenarios
    assert.ok(scenarios.length >= 4, `${id} has ${scenarios.length}`)
    for (const s of scenarios) {
      const previous = seen.get(s.maleBackground)
      assert.equal(previous, undefined, `${id} reuses ${previous}`)
      seen.set(s.maleBackground, id)
    }
  }
  assert.equal(seen.size, 49)
})

test('a turn that ends on him walking out of frame is rejected', () => {
  // Only a real exit from the scene counts. Ordinary movement inside it does
  // not: flagging every 转身/走出 rejected half of the model's legitimate short
  // beats and produced a rewrite storm.
  for (const deadEnd of [
    '谢予衡的脚步消失在走廊尽头。',
    '走廊尽头的脚步声渐远。',
    '他的背影消失不见。',
  ])
    assert.match(styleIssue(deadEnd)!, /玩家除了说“继续”无事可做/, deadEnd)
  for (const ordinary of [
    '他转身去了厨房。',
    '管家点头，转身去厨房外头叫人。',
    '他点了下头，转身上楼。',
    '他站在门口等你，没有催。',
    '你只是点头，把便笺收进掌心。',
  ])
    assert.equal(styleIssue(ordinary), undefined, ordinary)
  // Carrying on to somewhere she can act clears it, and so does leaving her
  // something to answer.
  assert.equal(
    styleIssue(
      '谢予衡走出会议室。\n十分钟后。\n二叔在餐厅门口拦住你，问那份表是谁让做的。',
    ),
    undefined,
  )
  assert.equal(
    styleIssue('他往门口走。\n“落去餐厅。”（下去餐厅。）'),
    undefined,
  )
})

test('Cantonese lines carry a bracketed gloss, kept on the same row', () => {
  assert.equal(
    formatStory(
      '他把餐垫推过来。“冇大太问起你啲工具，就话系帮我整表。”（有人问起你的工具，就说是帮我做表。）他没抬眼。',
    ),
    '他把餐垫推过来。\n“冇大太问起你啲工具，就话系帮我整表。”（有人问起你的工具，就说是帮我做表。）\n他没抬眼。',
  )
  // One unglossed line is not worth half of a rewrite trigger; two are.
  assert.deepEqual(
    softStyleIssues(
      '他把餐垫推过来。\n“冇大太问起你啲工具，就话系帮我整表。”',
      [],
    ),
    [],
  )
  assert.match(
    softStyleIssues(
      '“冇大太问起你啲工具，就话系帮我整表。”\n“二叔嘅事，今晚交俾我處理。”',
      [],
    )[0],
    /没有括号注简体/,
  )
  assert.deepEqual(softStyleIssues('“坐隔篱。”（坐我旁边。）', []), [])
  // Three characters or fewer need no gloss.
  assert.deepEqual(softStyleIssues('“唔好。”', []), [])
})

test('an empty Enter advances the story and leaves no trace in the transcript', () => {
  const s = said(base(), '他说完便转身走开。')
  const guidance = turnGuidance(s, CONTINUE_TURN)
  assert.match(guidance, /玩家没有说话/)
  assert.match(guidance, /F 推进/)
  assert.match(guidance, /不要只写他走远/)
  // The marker reaches the model through the prompt, classified as F.
  const prompt = buildPrompt(s, CONTINUE_TURN)
  assert.match(prompt, /F 推进/)
  assert.match(prompt, /【继续】这个标记/)
  // It is short enough that the echo check ignores it, so a turn mentioning
  // "继续" is not rejected for quoting the player.
  assert.equal(
    echoIssue(CONTINUE_TURN, '他继续往前走。\n二叔在门口等着。'),
    undefined,
  )
})

test('punctuation is repaired rather than rejected', () => {
  assert.equal(
    formatStory('他没说话——目光落在你肩上。'),
    '他没说话，目光落在你肩上。',
  )
  assert.equal(
    formatStory('“我知道。”他顿了顿，“不过——算了。”'),
    '“我知道。”\n他顿了顿，\n“不过，算了。”',
  )
  assert.equal(formatStory('他抬头——'), '他抬头。')
  assert.equal(styleIssue(formatStory('他没说话——目光落在你肩上。')), undefined)
})

test('style issues never refuse the turn, contradictions still do', async (t) => {
  const s = said(base(), '他把桶靠在墙边。')
  // A mannered figure plus a second drifting indicator: worth one rewrite,
  // still committed when the rewrite does no better. A single style issue on
  // its own no longer costs a whole extra request.
  const mannered =
    '他把桌上那叠单据一张张翻过去，翻到最后一页才停下来，手指压在印章那一行上，没有动，也没有说话，窗外的雨声一直没断。他把文件合上，像是确认了什么。\n“明天再说。”'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(response(mannered)) } }],
      }),
    )
  })
  const notes: string[][] = []
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '好',
    false,
    undefined,
    (n) => notes.push(n),
  )
  assert.equal(calls, 2)
  assert.equal(next.story, formatStory(mannered))
  assert.match(notes.at(-1)!.join(), /没有具体所指的比喻/)
  // One style issue alone is reported without a second request.
  const single = '他把文件合上，像是确认了什么。\n“明天再说。”'
  const check = qualityIssues(s, '好', { story: single }, false)
  assert.equal(check.hard.length, 0)
  assert.equal(check.failed, false)
  assert.match(check.soft.join(), /没有具体所指的比喻/)
})

test('a turn that repeats the previous one is still refused after one rewrite', async (t) => {
  const previous =
    '他把桶靠在墙边：“别把译稿弄湿。我上去看看管道，晚点会在楼上。”'
  const s = said(base(), previous)
  const before = JSON.stringify(s)
  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(
                response('他又说了一遍：“我上去看看管道，晚点会在楼上。”'),
              ),
            },
          },
        ],
      }),
    )
  })
  await assert.rejects(
    generateStory({ apiKey: 'fixture', model: 'fixture' }, s, '好', false),
    /和前文对不上/,
  )
  assert.equal(JSON.stringify(s), before)
})

test('a recoverable reply is repaired instead of being thrown away', () => {
  const base = {
    story: '他点头。',
    narrative: { title: '旧舞厅', time: { day: 1, period: 'night' } },
  }
  // Booleans omitted when false, which the contract now invites.
  assert.equal(
    parseEngineResponse(JSON.stringify(base)).relationshipProgress,
    false,
  )
  // A time label outside the jump-hint pattern is dropped, not fatal.
  const labelled = parseEngineResponse(
    JSON.stringify({
      ...base,
      narrative: {
        ...base.narrative,
        time: { day: 1, period: 'night', label: '傍晚' },
      },
    }),
  )
  assert.equal(labelled.narrative.time.label, undefined)
  assert.equal(labelled.story, '他点头。')
  // Real newlines inside a JSON string, and a trailing comma.
  assert.equal(
    parseEngineResponse(
      '{"story": "他点头。\n“明天再说。”", "narrative": {"title":"旧舞厅","time":{"day":1,"period":"night"},},}',
    ).story,
    '他点头。\n“明天再说。”',
  )
})

test('an inline quoted term stays inline; only spoken lines get their own row', () => {
  assert.equal(
    formatStory('经理从楼梯上来，隔着栏杆叫了一声“二少”。'),
    '经理从楼梯上来，隔着栏杆叫了一声“二少”。',
  )
  assert.equal(
    formatStory('落款一个“良”字。日期，九三年五月十一。'),
    '落款一个“良”字。日期，九三年五月十一。',
  )
  assert.equal(
    formatStory('柜台后的阿姐抬头叫了声“二少”。“两位。”'),
    '柜台后的阿姐抬头叫了声“二少”。\n“两位。”',
  )
  assert.equal(
    formatStory('他把餐垫推过来。“坐隔篱。”（坐我旁边。）他没抬眼。'),
    '他把餐垫推过来。\n“坐隔篱。”（坐我旁边。）\n他没抬眼。',
  )
})

test('calling the player 她 breaks the point of view', () => {
  assert.match(styleIssue('她把册子翻回那张合影。')!, /第二人称限知/)
  assert.match(styleIssue('她低头吃饭。他拿起筷子，也吃。')!, /第二人称限知/)
  assert.equal(styleIssue('你把册子翻回那张合影。'), undefined)
  // Another woman in the scene is fine as long as the turn does not open on her.
  assert.equal(styleIssue('陈月眉站在台上。她手里夹着烟。'), undefined)
})

test('a body whose braces never close is treated as truncation, not as garbage', async (t) => {
  const s = said(base(), '他把铁盒推过来。')
  const whole = JSON.stringify(response('他把信放回盒里。\n“下月就拆了。”'))
  const cutOff = whole.slice(0, Math.floor(whole.length * 0.6))
  assert.equal(looksTruncated(cutOff), true)
  assert.equal(looksTruncated(whole), false)
  // A complete reply is never retried for the wrong reason: straight quotes in
  // the prose, real newlines and a trailing comma all read as finished.
  assert.equal(looksTruncated('{"story":"他说"好。","narrative":{}}'), false)
  assert.equal(looksTruncated('{"story":"他点头。\n“明天。”"}'), false)
  assert.equal(looksTruncated('{"story":"他点头。",}'), false)
  assert.equal(looksTruncated('{"story":"他点头。"}\n希望符合要求。'), false)
  const budgets: number[] = []
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      calls++
      budgets.push(JSON.parse(init.body as string).max_tokens)
      // No finish_reason at all, which is what a dropped stream looks like.
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: calls === 1 ? cutOff : whole } }],
        }),
      )
    },
  )
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '',
    false,
  )
  assert.deepEqual(budgets, [4000, 8000])
  assert.equal(next.story, formatStory('他把信放回盒里。\n“下月就拆了。”'))
})

test('prose that did arrive is kept when both attempts are cut off', async (t) => {
  const s = said(base(), '他把铁盒推过来。')
  const long =
    '铁盒在桌上，开着。\n你把竹椅拉过来坐下，先拿照片。\n三张，边角发脆。\n第一张，陈月眉站在舞台上，旗袍，手里夹烟。\n第二张只剩一只手搭在她肩'
  const cutOff = `{"story": ${JSON.stringify(long)}`
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: cutOff } }] }),
      ),
  )
  const next = await generateStory(
    { apiKey: 'fixture', model: 'fixture' },
    s,
    '',
    false,
  )
  // Trimmed back to the last finished sentence, so nothing ends mid-word.
  assert.ok(next.story.endsWith('手里夹烟。'), next.story)
  assert.ok(!next.story.includes('只剩一只手搭在她肩'))
})

test('a truncated reply with almost nothing in it is still refused', async (t) => {
  const s = said(base(), '他把铁盒推过来。')
  const before = JSON.stringify(s)
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"story": "他' } }],
        }),
      ),
  )
  await assert.rejects(
    generateStory({ apiKey: 'fixture', model: 'fixture' }, s, '', false),
    /被截断/,
  )
  assert.equal(JSON.stringify(s), before)
})

test('thinking is kept by default, and the setting is honoured when changed', async (t) => {
  t.after(resetProviderFlags)
  const s = said(base(), '他把桶靠在墙边。')
  const bodies: any[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string))
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(response('他点头，上楼去了。')),
              },
            },
          ],
        }),
      )
    },
  )
  // Reasoning is why the prose is good, so nothing is sent unless asked.
  await generateStory({ apiKey: 'k', model: 'm' }, s, '好', false)
  assert.equal(bodies[0].reasoning, undefined)
  await generateStory(
    { apiKey: 'k', model: 'm', reasoning: 'brief' },
    s,
    '好',
    false,
  )
  assert.deepEqual(bodies[1].reasoning, { effort: 'low', exclude: true })
  await generateStory(
    { apiKey: 'k', model: 'm', reasoning: 'off' },
    s,
    '好',
    false,
  )
  assert.deepEqual(bodies[2].reasoning, { enabled: false, exclude: true })
})

test('a model that refuses the reasoning setting is retried without it', async (t) => {
  t.after(resetProviderFlags)
  const s = said(base(), '他把桶靠在墙边。')
  const bodies: any[] = []
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      calls++
      bodies.push(JSON.parse(init.body as string))
      if (calls === 1)
        return new Response('{"error":{"code":400}}', { status: 400 })
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(response('他点头，上楼去了。')),
              },
            },
          ],
        }),
      )
    },
  )
  const next = await generateStory(
    { apiKey: 'k', model: 'm', reasoning: 'off' },
    s,
    '好',
    false,
  )
  assert.equal(next.story, '他点头，上楼去了。')
  // Dropped after the refusal, and the retry stays on the same token budget
  // rather than burning the escalation to 8000.
  assert.deepEqual(bodies[0].reasoning, { enabled: false, exclude: true })
  assert.equal(bodies[1].reasoning, undefined)
  assert.equal(bodies[0].max_tokens, 4000)
  assert.equal(bodies[1].max_tokens, 4000)
})

test('the noisiest indicators are reported without buying a second request', () => {
  // Three unglossed Cantonese lines plus an over-long paragraph: in play this
  // pairing fired constantly and cost a full extra request each time.
  const s = said(base(), '他把合影翻回正面。')
  const story =
    '他挑最里面那张圆桌坐下，菜牌翻都没翻，伙计应了一声走开，柜台后的阿姐抬头看了一眼又低下头去忙自己的事。\n“我约咗佢礼拜四。”\n“湾仔呢间拆，佢唔知。”\n“呢单嘢我处理。”'
  const check = qualityIssues(s, '好', { story }, false)
  assert.equal(check.blocking.length, 0)
  assert.match(check.advisory.join(), /括号注简体/)
  assert.ok(
    !check.soft.some((note) => /括号注简体|连续三轮的长度/.test(note)),
    'advisory notes must not be counted',
  )
  assert.equal(check.failed, false)
})

test('a failed repair keeps the draft that already exists', async (t) => {
  const s = said(base(), '他把桶靠在墙边。')
  // Two countable indicators trigger the rewrite; the rewrite then returns
  // something unparseable.
  const drifting =
    '他把桌上那叠单据一张张翻过去，翻到最后一页才停下来，手指压在印章那一行上，没有动，也没有说话，窗外的雨声一直没断。他把文件合上，像是确认了什么。\n“明天再说。”'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                calls === 1
                  ? JSON.stringify(response(drifting))
                  : '抱歉，我无法完成',
            },
          },
        ],
      }),
    )
  })
  const notes: string[][] = []
  const next = await generateStory(
    { apiKey: 'k', model: 'm' },
    s,
    '好',
    false,
    undefined,
    (n) => notes.push(n),
  )
  // The repair is attempted once, fails fast because the reply carries no
  // object at all, and the draft the reader already has is committed.
  assert.equal(calls, 2)
  assert.equal(next.story, formatStory(drifting))
  assert.ok(notes.length)
})

test('strict mode buys a rewrite for any drift; fluent mode does not', () => {
  const s = said(base(), '他把合影翻回正面。')
  const single = '他把文件合上，像是确认了什么。\n“明天再说。”'
  assert.equal(qualityIssues(s, '好', { story: single }, false).failed, false)
  assert.equal(
    qualityIssues(s, '好', { story: single }, false, true).failed,
    true,
  )
  // Advisory notes count in strict mode too, and stop being advisory.
  const unglossed =
    '“我约咗佢礼拜四。”\n“湾仔呢间拆，佢唔知。”\n“呢单嘢我处理。”'
  const fluent = qualityIssues(s, '好', { story: unglossed }, false)
  assert.equal(fluent.failed, false)
  assert.match(fluent.advisory.join(), /括号注简体/)
  const strict = qualityIssues(s, '好', { story: unglossed }, false, true)
  assert.equal(strict.advisory.length, 0)
  assert.equal(strict.failed, true)
  // Neither mode touches the blocking checks.
  assert.equal(fluent.blocking.length, 0)
  assert.equal(strict.blocking.length, 0)
})

test('the trial meters turns, closes for the day, and never runs the wrong model', () => {
  const now = Date.UTC(2026, 0, 1, 12)
  // Each request spends one turn.
  let usage = emptyUsage(now)
  for (let i = 0; i < 5; i++) {
    const verdict = checkTrial(usage, now, 0)
    assert.equal(verdict.allowed, true, `turn ${i + 1}`)
    assert.equal(verdict.remaining, TRIAL_TURNS - i - 1)
    usage = verdict.next
  }
  // Once the visitor's allowance is gone, they are told to ask the host rather
  // than to go and buy a key: on this link everything runs on the host's.
  const spent = checkTrial(
    { turns: TRIAL_TURNS, hourStartedAt: now, hourTurns: 0 },
    now,
    0,
  )
  assert.equal(spent.allowed, false)
  assert.match(spent.reason!, /额度用完/)
  // The hourly burst limit is separate, and rolls over.
  const bursty = { turns: 0, hourStartedAt: now, hourTurns: TRIAL_BURST }
  assert.equal(checkTrial(bursty, now, 0).allowed, false)
  assert.equal(checkTrial(bursty, now + 60 * 60 * 1000, 0).allowed, true)
  // The site-wide daily ceiling closes the link for everyone.
  const closed = checkTrial(emptyUsage(now), now, DAILY_TURN_CAP)
  assert.equal(closed.allowed, false)
  assert.match(closed.reason!, /今天这个链接的额度/)

  // The client cannot pick what runs on the host's account.
  const allowed = ['deepseek/deepseek-chat', 'deepseek/deepseek-v4.1-flash']
  const asked = sanitizeRequest(
    {
      model: 'openai/o3',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 100000,
      stream: true,
      temperature: 3,
      tools: [{ type: 'web_search' }],
    },
    allowed,
  )
  assert.ok('body' in asked)
  if ('body' in asked) {
    assert.equal(asked.body.model, 'deepseek/deepseek-chat')
    assert.equal(asked.body.max_tokens, MAX_TOKENS_CAP)
    assert.equal(asked.body.tools, undefined)
    assert.equal(asked.body.stream, true)
  }
  assert.ok('error' in sanitizeRequest({ messages: [] }, allowed))
  assert.ok('error' in sanitizeRequest('nope', allowed))
})

test('a burst of unanswered messages survives the checks', () => {
  // The beat only works if he can fire several short lines with no reply in
  // between, including two question marks, which every other rule discourages.
  const burst =
    '“没有是什么意思”\n“那你倒是说点别的啊”\n“我刚刚说分手 你一点都不慌是不是”\n“……我他妈现在慌得要死 你能不能哄哄我”'
  const laid = formatStory(burst)
  assert.equal(laid, burst)
  assert.equal(styleIssue(laid), undefined)
  assert.deepEqual(softStyleIssues(laid, []), [])
  // Quoting her two-character reply back at her is the point here, and the
  // echo check is short enough to leave it alone.
  assert.equal(echoIssue('没有', laid), undefined)
  const s = said(base(), '他把手机扣在桌上。')
  assert.equal(qualityIssues(s, '没有', { story: laid }, false).failed, false)
})

test('a scene that puts him back in a room he left is refused', async (t) => {
  const s = said(base(), '他说完便转身走开，脚步稳健。')
  s.sceneState = {
    status: 'open',
    established: [],
    props: [],
    offers: [],
    position: { where: '大宅外', status: 'gone' },
  }
  const ghost = '他忽然又在你身侧。\n“还没说完。”'
  // A scene that does not hold together is worse than a turn the reader redoes,
  // so this one stays in the blocking bucket.
  assert.equal(
    qualityIssues(s, '那我先回房', { story: ghost }, false).blocking.length,
    1,
  )
  const before = JSON.stringify(s)
  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(response(ghost)) } }],
      }),
    )
  })
  await assert.rejects(
    generateStory({ apiKey: 'k', model: 'm' }, s, '那我先回房', false),
    /和前文对不上/,
  )
  assert.equal(JSON.stringify(s), before)
  // Going with him is not a slip, so that path is never refused.
  assert.equal(
    qualityIssues(s, '跟上去', { story: '你跟上去。\n“上车。”' }, false)
      .blocking.length,
    0,
  )
})

test('she can simply have gone with him', () => {
  const s = said(base(), '他说完便往外走。')
  s.sceneState = {
    status: 'open',
    established: [],
    props: [],
    offers: [],
    position: { where: '大宅外', status: 'gone' },
  }
  assert.equal(
    continuityIssue(s, '你跟上去', '你跟上去，他在阶下停住。\n“上车。”'),
    undefined,
  )
  assert.equal(
    continuityIssue(s, '随便', '你和他一起走到马车边。\n“上来。”'),
    undefined,
  )
})

test('every offered trope carries a pool of histories and the retired one still reads', () => {
  for (const trope of tropes) {
    const seeds = relationshipSeeds[trope.id]
    // Drawn at creation, so the pool has to be wide enough that two stories on
    // the same line do not open the same way.
    assert.ok(seeds.length >= 8, `${trope.title} has ${seeds.length}`)
    // Each has to name something that already happened, not a label.
    assert.ok(
      seeds.every((seed) => seed.length >= 20),
      trope.title,
    )
    assert.equal(
      new Set(seeds).size,
      seeds.length,
      `${trope.title} repeats a history`,
    )
    assert.ok(trope.beats.length >= 6 && trope.pitfall, trope.title)
  }
  // 契约恋爱 is off the selection screen but old saves still open.
  assert.ok(!tropes.some((t) => t.id === 'contract_love'))
  assert.equal(getTrope('contract_love').title, '契约恋爱')
  // Drawn at creation, so two stories on the same trope start differently.
  const drawn = new Set(
    Array.from(
      { length: 40 },
      () =>
        generateIdentity('hongkong_circle', 'love_hate', '心').playerBackground,
    ),
  )
  assert.ok(drawn.size >= 6, `only ${drawn.size} distinct openings`)
})

test('no row is left holding nothing but punctuation', () => {
  const alone = (story: string) =>
    formatStory(story)
      .split('\n')
      .some((row) => !row.replace(/[\p{P}\p{Z}\s]/gu, '').length)
  // The model closes a spoken line and then writes the sentence's full stop
  // after it, which used to land on a row of its own.
  for (const story of [
    '他抬头，看了一眼门口。“进来。”，',
    '管家低声唤道：\n“大少”\n。',
    '“回头见。”\n。',
    '他点头\n。',
    '他点头。\n，\n她没说话。',
  ])
    assert.equal(alone(story), false, story)
  // A stop that would duplicate one already there is dropped, not appended.
  assert.equal(formatStory('“回头见。”\n。'), '“回头见。”')
  // One that completes an unfinished line is kept.
  assert.equal(formatStory('他点头\n。'), '他点头。')
})

test('she can be someone with standing, and he is drawn from a pool too', () => {
  for (const bg of backgrounds) {
    const women = playerRoles[bg.id]
    const men = maleRoles[bg.id]
    assert.ok(women.length >= 8, `${bg.id} offers ${women.length} roles`)
    assert.ok(men.length >= 8, bg.id)
    assert.equal(new Set(women).size, women.length, bg.id)
  }
  // The court used to cast her only as a visiting craftswoman; rank, birth and
  // service now all appear.
  const court = playerRoles.historical_court.join()
  for (const rank of ['公主', '宫女', '女官', '嫡出', '庶出'])
    assert.match(court, new RegExp(rank))
  const drawn = new Set(
    Array.from(
      { length: 60 },
      () => chooseScenario('historical_court').playerRole,
    ),
  )
  assert.ok(drawn.size >= 6, `only ${drawn.size} distinct roles`)
})

test('the male lead can be named by the reader or rolled at random', () => {
  const chosen = makeState({
    background: 'hongkong_circle',
    trope: 'love_hate',
    archetype: 'cool_quiet',
    playerName: '心',
    maleName: '裴砚',
  })
  assert.equal(chosen.config.maleLead.name, '裴砚')
  // Left blank, the story picks one, and it never collides with her own name.
  const auto = makeState({
    background: 'hongkong_circle',
    trope: 'love_hate',
    archetype: 'cool_quiet',
    playerName: '心',
  })
  assert.ok(auto.config.maleLead.name.length >= 2)
  const rolled = new Set(
    Array.from({ length: 30 }, () =>
      randomMaleName('historical_court', '沈砚'),
    ),
  )
  assert.ok(rolled.size >= 10, `only ${rolled.size} names`)
  assert.ok(!rolled.has('沈砚'))
})

test('affinity folds the eight dials into one the reader can watch', () => {
  const cold: RelationshipState = {
    attraction: 0,
    curiosity: 0,
    trust: 0,
    attachment: 0,
    jealousy: 0,
    distance: 100,
    tension: 0,
    commitment: 0,
  }
  assert.equal(affinityOf(cold), 0)
  assert.equal(affinityStage(affinityOf(cold)), '陌路')
  const close: RelationshipState = {
    ...cold,
    attraction: 90,
    curiosity: 80,
    trust: 90,
    attachment: 95,
    commitment: 85,
    distance: 5,
  }
  assert.ok(affinityOf(close) > 80)
  assert.equal(affinityStage(affinityOf(close)), '认定')
  // Jealousy and tension rise in scenes worth playing, so they must not read
  // as a loss.
  const jealous = { ...close, jealousy: 90, tension: 90 }
  assert.equal(affinityOf(jealous), affinityOf(close))
  // Only a real move is reported.
  assert.equal(affinityShift(40, 40), null)
  assert.deepEqual(affinityShift(40, 46), { delta: 6, rising: true })
  assert.deepEqual(affinityShift(46, 40), { delta: -6, rising: false })
})

test('the opening carries a briefing, and later turns never overwrite it', () => {
  const prompt = buildOpeningPrompt(base())
  assert.match(prompt, /briefing/)
  assert.match(prompt, /80–140 字的前情提要/)
  assert.match(prompt, /不剧透后面/)
  let s = applyEngineResponse(base(), {
    ...response('他按住电梯门。\n“上来。”'),
    briefing:
      '你替家族修旧藏，他是这家的长孙。三年前你退过一次婚，退婚的理由到今天还没人说破。',
  })
  assert.match(s.briefing!, /三年前你退过一次婚/)
  s = applyEngineResponse(s, {
    ...response('他点头，上楼去了。'),
    briefing: '不该覆盖',
  })
  assert.match(s.briefing!, /三年前你退过一次婚/)
})
