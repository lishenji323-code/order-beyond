import type { ScenePatch, StoryState } from '../types/story'

const delegatedReview = (input: string) =>
  !/不用|不要|别/.test(input) &&
  /(?:你|替我|帮我).{0,5}(?:过目|看|检查)|先过目|你决定/.test(input)
const completedAction = (input: string) =>
  /照做|照着做|按照.{0,10}做|按.{0,8}说的做|开口念|念那一句|读那一句|播放录音/.test(
    input,
  )

// Conservative cue, not a replacement for reading the surrounding conversation.
export function isConversationalClosing(state: StoryState, input: string) {
  if (
    /[？?]|不过|但是|可是|还有|能不能|可不可以|要不要|怎么|为什么|哪里|在哪|留下|陪我|别走|等一下|告诉我|想问/.test(
      input,
    )
  )
    return false
  let value = input.replace(/[\p{P}\p{Z}\s]/gu, '')
  if (/^(?:嗯|嗯嗯|好|好的|好吧|行|行吧|知道了|明白了|收到)+$/.test(value))
    return false
  const name = state.config.maleLead.name
  for (const address of [name, ...(name.length === 3 ? [name.slice(1)] : [])]) {
    if (value.endsWith(address)) value = value.slice(0, -address.length)
  }
  return (
    /^(?:嗯|嗯嗯|好|好的|好吧|行|行吧|知道了|明白了|收到|谢谢你|谢谢|多谢|谢了|辛苦了|麻烦你了|不用了|没事了|再见|晚安|回头见|我先走了|先这样|就这样|那就这样|你先忙|你去忙吧|啦|哦|啊|吧|呀)+$/.test(
      value,
    ) ||
    /^(?:不用了|不必了|没事了|算了|那就先|先不|就先|先这样|就这样).{0,40}(?:谢谢你|谢谢|多谢|谢了|辛苦了)$/.test(
      value,
    )
  )
}

function dialogue(story: string) {
  return [...story.matchAll(/[“"]([^”"\n]+)[”"]/g)].map((m) => m[1])
}
function endsWithAddress(story: string, address: string) {
  if (!address) return false
  return dialogue(story).some((line) => {
    const text = line.replace(/[。！？!?…\s]+$/u, '').toLocaleLowerCase()
    const name = address.toLocaleLowerCase()
    if (!text.endsWith(name)) return false
    const prefix = text.slice(0, -name.length)
    return !prefix || /[，,：:\s]$/.test(prefix)
  })
}
const availability =
  /(?:有(?:什么)?事|有需要|需要帮忙|需要帮助|有什么需要).{0,12}(?:敲门|找我|叫我|联系我|说一声|随时)/
// A fresh offer or assignment pushed onto the player while she is closing out.
const newOffer =
  /(?:要不要|要我|需不需要|用不用|我帮你|我去帮你|不如我|我再).{0,16}[吗？?]|(?:明天|待会|等下|回头|一会儿?)\s*(?:你|我们|我)?.{0,10}(?:再|就)?(?:来|过来|去|找我|联系我)/

function socialRepetitionIssue(
  state: StoryState,
  input: string,
  story: string,
): string | undefined {
  const recent = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .slice(-3)
  const addresses = [
    state.config.player.name,
    state.config.player.addressByMaleLead,
  ].filter((v): v is string => Boolean(v))
  if (
    addresses.some(
      (name) =>
        endsWithAddress(story, name) &&
        recent.filter((m) => endsWithAddress(m.content, name)).length >= 2,
    )
  )
    return '连续几轮都以玩家的名字或昵称结尾。本轮省去这个无必要的称呼，像双方已经面对面那样说话，不改用另一个昵称填尾巴。'
  if (!isConversationalClosing(state, input)) return undefined
  if (
    availability.test(story) &&
    recent.some((m) => availability.test(m.content))
  )
    return '玩家正在礼貌收尾，联系方式已经说过。简短回应或自然离开即可，不再补有事敲门、随时找我或新的话头。'
  const oldLines = recent
    .flatMap((m) => dialogue(m.content))
    .join(' ')
    .replace(/\s/g, '')
  const repeatedReminder = dialogue(story)
    .flatMap((line) => line.split(/[，,。！？!?；;]/))
    .some((line) => {
      const part = line.trim()
      return (
        part.length >= 6 &&
        /^(?:别|不要|记得|记住|先把)/.test(part) &&
        oldLines.includes(part)
      )
    })
  if (repeatedReminder)
    return '收尾时重复了已经交代过的叮嘱。让这次回应结束，不重新安排玩家已经知道的事情。'
  return undefined
}

/**
 * Narration that repeats what the player just typed. She read her own line
 * when she wrote it; quoting it back spends a paragraph on nothing. An echo
 * inside dialogue is different and stays allowed.
 */
export function echoIssue(input: string, story: string): string | undefined {
  const said = normalized(input)
  if (said.length < 4) return undefined
  const narration = story.replace(/[“"][^”"\n]*[”"]/g, '　')
  if (longestOverlap(said, narration) < Math.min(said.length, 6))
    return undefined
  return '旁白把玩家刚说的话又复述了一遍。她知道自己说了什么，这一轮直接写他的反应。'
}

// The player calling him back is the legitimate way a departure is undone, and
// it is visible in her own words rather than in anything the model asserts.
const RECALL =
  /叫住|等一下|等等|稍等|先别走|别走|不要走|留下|留步|回来|等陣|等阵|先别|還有一件事|还有一件事|跟(?:上|出|着|過|过)|追(?:上|出)|送(?:他|佢)|一起(?:走|出|去)|上车|上車|同行/
// Narration that actually shows him coming back, rather than him simply being
// there again.
// She may also simply have gone with him, which is not a return at all.
const WENT_ALONG =
  /你(?:也)?(?:跟|随|隨|追)(?:上|出|着|著|过|過)|你们一起|你們一起|你跟在|同他一起|和他一起|与他一起|與他一起/
const RETURN_NARRATION =
  /折回|退回来|退回來|回过身|回過身|停住|停下脚步|停下腳步|重新走回|又走回|走了回来|走了回來|门重新|門重新|按住(?:了)?(?:电梯|電梯)?门|按住(?:了)?門|叫住|拉开(?:了)?门|拉開(?:了)?門/
// Contact that does not require him to be in the room.
const REMOTE = /电话|電話|来电|來電|短信|信息|消息提示|微信|whatsapp|震动|震動/i
const DEPARTURE =
  /转身(?:就|便)?(?:走开|走远|离去|离开|走)|轉身(?:就|便)?(?:走開|走遠|離去|離開|走)|走进(?:了)?电梯|走進(?:了)?電梯|进了电梯|進了電梯|上楼去了|上樓去了|挂断|掛斷|挂了电话|掛了電話|推门(?:出去|离开)|推門(?:出去|離開)|离开了|離開了|走了出去|消失在|背影(?:已经|已經)?(?:融入|消失|不见|不見)|走远了|走遠了|快步(?:走|离开|離開)/

/**
 * A departure has to stick. Once the previous turn left him gone, he can only
 * be in the room again if the player called him back or the prose shows him
 * coming back. Remote contact is exempt: a phone call does not put him here.
 */
export function continuityIssue(
  state: StoryState,
  input: string,
  story: string,
  patch?: ScenePatch,
  newScene = false,
): string | undefined {
  // A new scene starts the room over, so an earlier exit no longer binds.
  if (newScene) return undefined
  const previous = state.sceneState?.position
  const lastTurn = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .at(-1)
  // Falls back to the prose when the turn declined to record a position, so
  // that omitting the field cannot launder a departure away.
  const wasGone =
    previous?.status === 'gone' ||
    (!previous && Boolean(lastTurn && DEPARTURE.test(lastTurn.content)))
  if (!wasGone) return undefined
  const backInTheRoom =
    patch?.position?.status === 'present' ||
    patch?.position?.status === 'leaving' ||
    (!patch?.position && dialogue(story).length > 0)
  if (!backInTheRoom) return undefined
  if (
    RECALL.test(input) ||
    RETURN_NARRATION.test(story) ||
    REMOTE.test(story) ||
    WENT_ALONG.test(story)
  )
    return undefined
  return `上一轮他已经离开（${previous?.where || '正文里写了他走开'}），这一轮却又在她身边。玩家没有叫住他，正文也没有写他怎么回来的。要么让他保持离开、由她自己行动，要么先写出可信的返回过程。`
}

/** Soft: leaving twice running means the first exit never took effect. */
export function repeatedExitIssue(state: StoryState, story: string): string[] {
  const last = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .at(-1)
  if (!last || !DEPARTURE.test(story) || !DEPARTURE.test(last.content))
    return []
  return [
    '他上一轮已经离开过一次，这一轮又离开一次。第一次离开没有生效，说明中间那一轮不该把他留在原地。让这一次真正结束场景，或者让他从头就没走。',
  ]
}

/**
 * The first scene must not read the character sheet aloud. Appearance is
 * private reference data; a five-character run of it in act one means the card
 * was copied rather than the scene written.
 */
export function openingIssue(
  state: StoryState,
  story: string,
): string | undefined {
  const a = state.config.maleLead.appearance
  const leaked = [a.signature, a.face, a.hair, a.build, a.height].find(
    (item) => item && longestOverlap(item, story) >= 5,
  )
  if (leaked)
    return `第一幕报了男主的外貌（${leaked}）。外貌是私下保持一致的资料，第一幕不介绍长相；用他的身份、动作和旁人的态度交代这个人。`
  return undefined
}

/**
 * Soft: the same object being handled turn after turn. A prop that has already
 * changed hands should stay where it was put, not be touched again to fill a
 * beat.
 */
export function softSceneIssues(state: StoryState, story: string): string[] {
  const props = state.sceneState?.props ?? []
  if (!props.length) return []
  const recent = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .slice(-2)
  if (recent.length < 2) return []
  const stale = props
    .map((prop) => prop.split(/[：:]/)[0].trim())
    .find(
      (key) =>
        key.length >= 2 &&
        story.includes(key) &&
        recent.every((m) => m.content.includes(key)),
    )
  return stale
    ? [
        `“${stale}”连续三轮出现在动作里。已经交到对方手上的东西就让它停在那儿，这一轮换一件事做或者什么都不碰。`,
      ]
    : []
}

/**
 * What an empty Enter sends. The reader is telling the engine that nothing here
 * needs her, so typing "继续" every time would be busywork. It never appears in
 * the transcript.
 */
export const CONTINUE_TURN = '【继续】'

export function turnGuidance(state: StoryState, input: string) {
  if (input === CONTINUE_TURN)
    return '玩家没有说话，直接示意往下走。这一轮属 F 推进：跳过所有不需要她参与的过程，直接写到下一件落到她面前的事。可以换场景、过掉一段时间、让别人找上门，或者让一件事在她不在场时发生完再传到她耳朵里。不要只写他走远、不要原地复述刚才的状态，也不要问她想做什么。'
  const closing = isConversationalClosing(state, input)
  const notes = [
    closing
      ? '本轮有礼貌收尾信号。结合前文，若小事已经处理完，允许男主一句回应、点头或转身离开，随后结束本轮。无需留互动钩子，不重复联系方式、叮嘱或称呼，不立刻开启新一幕。不要把谢谢当作对尚未同意的行动授权；若现场仍有明确紧急事件则先合理处理。'
      : '先处理玩家本轮已经表达的行动或问题。只在确有未决事项时继续谈，不强制每轮留下回应点。',
    '称呼只在真正呼唤或强调时使用，通常省略姓名；不要在句尾机械加上玩家名字。',
  ]
  if (delegatedReview(input))
    notes.push(
      '玩家已把检查或决定委托给男主。本轮直接完成并给出具体结论，不再次询问要不要过目、标注或检查；也不替玩家签署、接受等重大决定。',
    )
  if (completedAction(input))
    notes.push(
      '玩家已完成/授权上一轮说的常规动作。本轮让录音、朗读或操作实际发生，并补出虚构内容及结果。不能再次让她准备、开口或逐字提供原文。',
    )
  if (
    /离开|走了|走出|转身走|出门/.test(input) &&
    !/不想离开|没有离开|不离开/.test(input)
  )
    notes.push(
      '玩家已经移动或离场。更新她的位置，回应离开的态度与后果，不能仍按她在桌前描写，不默认她停步或返回。',
    )
  if (/怎么办|不知道|随便|你决定/.test(input))
    notes.push(
      '用男主自己的判断给一个可执行的办法或直接完成眼前小事，不将同一道题原样退还玩家。',
    )
  const recent = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .slice(-3)
  if (recent.length >= 2 && !closing)
    notes.push(
      '检查最近几轮：已经问过、完成、拒绝或离开的动作不能重新布置。若仍围绕同一小任务，本轮收束它；按上下文决定继续还是告一段落，不强行追加话题。',
    )
  return notes.join('\n')
}

const normalized = (value: string) => value.replace(/[\p{P}\p{Z}\s]/gu, '')
function grams(value: string) {
  const clean = normalized(value)
  return new Set(
    Array.from({ length: Math.max(0, clean.length - 2) }, (_, i) =>
      clean.slice(i, i + 3),
    ),
  )
}
function similarity(a: string, b: string) {
  const left = grams(a),
    right = grams(b)
  if (!left.size || !right.size) return 0
  return (
    (2 * [...left].filter((x) => right.has(x)).length) /
    (left.size + right.size)
  )
}

// Longest run of identical characters shared by two passages, ignoring punctuation.
function longestOverlap(a: string, b: string) {
  const left = normalized(a),
    right = normalized(b)
  if (!left || !right) return 0
  let best = 0
  const row = new Array<number>(right.length + 1).fill(0)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = 0
    for (let j = 1; j <= right.length; j++) {
      const previous = row[j]
      row[j] = left[i - 1] === right[j - 1] ? diagonal + 1 : 0
      if (row[j] > best) best = row[j]
      diagonal = previous
    }
  }
  return best
}

// Scene bookkeeping the model maintains: anything already said, any object
// already handed over, any offer already refused.
function sceneStateIssue(state: StoryState, story: string): string | undefined {
  const scene = state.sceneState
  if (!scene) return undefined
  // Established entries are short, deliberate notes, so a six-character run is
  // already a restatement rather than a coincidence.
  const said = scene.established.find(
    (item) => normalized(item).length >= 6 && longestOverlap(item, story) >= 6,
  )
  if (said)
    return `正文重复了本场已经交代过的内容（${said}）。它已经在场景状态里，不需要再说第二次，换一种说法也不行。`
  const declined = scene.offers.find(
    (offer) =>
      offer.status === 'declined' &&
      normalized(offer.content).length >= 6 &&
      longestOverlap(offer.content, story) >= 6,
  )
  if (declined)
    return `本场已经被拒绝的提议（${declined.content}）又出现了一次。被拒绝的提议即作废，不再重提，也不换说法重提。`
  return undefined
}

// Conservative checks for exact/near copies and already-authorized routine tasks.
// This is not a general semantic judge; unrecognized repetition is addressed by the model rules.
export function repetitionIssue(
  state: StoryState,
  input: string,
  story: string,
): string | undefined {
  const socialIssue = socialRepetitionIssue(state, input, story)
  if (socialIssue) return socialIssue
  const sceneIssue = sceneStateIssue(state, story)
  if (sceneIssue) return sceneIssue
  const recent = state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .slice(-3)
  const previous = recent.at(-1)
  if (previous && longestOverlap(previous.content, story) >= 8)
    return '本轮有一句和上一轮正文重合超过八个字。重写那一句：给这一轮新的结果或动作，不复述上一轮说过的话。'
  if (isConversationalClosing(state, input) && newOffer.test(story))
    return '玩家正在礼貌收尾，本轮却又提出一个新的提议或任务。让这次回应结束：一句回应、点头或转身离开即可。'
  if (
    recent.some(
      (m) =>
        normalized(m.content) === normalized(story) ||
        (normalized(story).length >= 35 && similarity(m.content, story) >= 0.8),
    )
  )
    return '正文与最近的回复几乎相同。不要换同义词复述。根据当前语境给结果；若玩家在收尾，可以一句回应或离开，不必添加新信息。'
  if (
    delegatedReview(input) &&
    /(?:要我|需不需要|是否需要|用不用我).{0,18}(?:过目|看|检查|标|圈).{0,10}[吗？?]/.test(
      story,
    )
  )
    return '玩家已经授权过目或检查，却又被询问是否要检查/标注。请直接给出检查结果，不必补一个新问题。'
  if (
    completedAction(input) &&
    /(?:你先|你再|先|再)(?:按稿)?(?:念|读|播放)(?:出|那|这|一|录音)|准备好.{0,8}(?:开始|开口)|等你开口|要我.{0,12}标.{0,8}[吗？?]/.test(
      story,
    )
  )
    return '玩家已执行常规动作，回复却再次要求执行或确认。请补出该动作完成后的事实与反应。'
  return undefined
}
