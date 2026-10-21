import { formatStory, softStyleIssues, styleIssue } from './style'
import {
  AUTHOR_BIBLE,
  OUTPUT_CONTRACT,
  buildOpeningPrompt,
  buildPrompt,
  sceneStateBlock,
} from './prompt'
import { callOpenRouter } from './openrouter'
import {
  continuityIssue,
  echoIssue,
  openingIssue,
  repeatedExitIssue,
  repetitionIssue,
  softSceneIssues,
} from './turns'
import type { EngineResponse, ModelSettings, StoryState } from '../types/story'

const recentStories = (state: StoryState) =>
  state.messages
    .filter((m) => m.role === 'narrator' || m.role === 'male')
    .slice(-2)
    .map((m) => m.content)

/**
 * Hard issues are mechanical and always worth a rewrite. Soft issues are
 * statistical: one on its own is reported to the caller and committed anyway,
 * two together are treated as a failure. Raising every soft indicator to a hard
 * one would push first-pass failures onto the reader, since only one rewrite is
 * ever allowed.
 */
export function qualityIssues(
  state: StoryState,
  input: string,
  result: Pick<EngineResponse, 'story' | 'scenePatch' | 'plotPatch'>,
  opening: boolean,
  strict = false,
) {
  const { story } = result
  // Blocking: a turn that repeats one already written, or that puts him back
  // in a room he has left. Both contradict the story on the page, and a scene
  // that does not hold together is worse than a turn the reader has to redo.
  const blocking = [
    opening ? undefined : repetitionIssue(state, input, story),
    opening
      ? undefined
      : continuityIssue(
          state,
          input,
          story,
          result.scenePatch,
          Boolean(result.plotPatch?.scene),
        ),
  ].filter((v): v is string => Boolean(v))
  // Worth one rewrite: a broken point of view, unquoted speech, or prose that
  // quotes the player back at herself.
  const found = styleIssue(story, { opening })
  const urgent =
    found && /第二人称限知|没有用引号|段落超过|台词超过/.test(found)
  const style = [
    ...(found && urgent ? [found] : []),
    opening ? openingIssue(state, story) : echoIssue(input, story),
  ].filter((v): v is string => Boolean(v))
  const drift = found && !urgent ? [found] : []
  const hard = [...blocking, ...style]
  const indicators = opening
    ? []
    : [
        ...drift,
        ...softStyleIssues(story, recentStories(state)),
        ...softSceneIssues(state, story),
        ...repeatedExitIssue(state, story),
      ]
  // Advisory only. Both fire on most turns in play: a missing gloss is a
  // formatting habit the model slips on constantly, and three turns of similar
  // length is a weak signal. Counting them meant they paired with any real
  // indicator and bought a whole extra request, which cost more waiting than
  // the drift cost the reader.
  const advisory = strict
    ? []
    : indicators.filter((note) => /括号注简体|连续三轮的长度/.test(note))
  const soft = indicators.filter((note) => !advisory.includes(note))
  return {
    blocking,
    style,
    hard,
    soft,
    // Advisory notes are logged but never push a turn into a second request.
    advisory,
    failed: hard.length > 0 || soft.length >= (strict ? 1 : 2),
  }
}

export async function generateStory(
  settings: ModelSettings,
  state: StoryState,
  input: string,
  opening: boolean,
  signal?: AbortSignal,
  onSoftIssue?: (notes: string[]) => void,
  onPartial?: (story: string) => void,
  onRewrite?: () => void,
): Promise<EngineResponse> {
  const prompt = opening ? buildOpeningPrompt(state) : buildPrompt(state, input)
  const drafted = await callOpenRouter(settings, prompt, signal, onPartial)
  // Laid out before checking, so the paragraph limits apply to what the reader
  // actually sees rather than to the model's raw run-on paragraphs.
  const first = { ...drafted, story: formatStory(drafted.story) }
  const strict = Boolean(settings.strictStyle)
  const firstCheck = qualityIssues(state, input, first, opening, strict)
  if (firstCheck.failed)
    console.info('[quality] 触发重写', {
      blocking: firstCheck.blocking,
      style: firstCheck.style,
      soft: firstCheck.soft,
    })
  if (!firstCheck.failed) {
    const notes = [...firstCheck.soft, ...firstCheck.advisory]
    if (notes.length) onSoftIssue?.(notes)
    return first
  }
  // A rejected draft is never committed. The preview is cleared and the reader
  // is told why, so a draft vanishing mid-sentence reads as a retake rather
  // than as a glitch.
  onPartial?.('')
  onRewrite?.()
  // Only one repair request is allowed.
  // The repair reuses the system rules verbatim (providers cache the identical
  // prefix) but replaces the long per-turn block with just what is needed to
  // fix the draft, which is roughly a quarter of the original user message.
  let repaired: EngineResponse
  try {
    repaired = await callOpenRouter(
      settings,
      [
        AUTHOR_BIBLE,
        '【本轮重写】',
        `上一份草稿已丢弃，未发生在故事中。玩家这一轮的输入是：${input || '（没有说话，示意往下走）'}`,
        '',
        '需要改的地方：',
        [...firstCheck.hard, ...firstCheck.soft].join('\n'),
        '',
        '上一份草稿（只作参照，不要照抄被指出的问题）：',
        first.story,
        '',
        '【当前场景状态】',
        sceneStateBlock(state),
        '',
        '【当前场景摘要】',
        state.sceneSummary || '故事刚开始',
        '',
        '只把上面指出的问题改掉，其余与上一稿一致。不要解释重写过程。只输出 JSON：',
        OUTPUT_CONTRACT,
      ].join('\n'),
      signal,
      onPartial,
    )
  } catch (error) {
    // A failed repair must not cost the reader the draft that already exists.
    // The first one was only style-flagged, so it is committed with a note.
    if (!firstCheck.blocking.length) {
      console.warn('[quality] 重写请求失败，保留第一稿', error)
      onSoftIssue?.([...firstCheck.style, ...firstCheck.soft])
      return first
    }
    throw error
  }
  const repairedTurn = { ...repaired, story: formatStory(repaired.story) }
  const secondCheck = qualityIssues(state, input, repairedTurn, opening, strict)
  // Only a hard failure is worth spending the reader's turn on. If the rewrite
  // merely drifts on the statistical indicators, it is committed and logged:
  // two round trips followed by "try again or change models" is a worse outcome
  // than a turn that reads slightly long.
  // Only a contradiction with the story itself refuses the turn. Style issues
  // that survived one rewrite are committed and logged: two round trips ending
  // in "try again or change models" is the worst outcome available.
  if (secondCheck.blocking.length)
    throw new Error(
      `这一段和前文对不上，没有写入故事：${secondCheck.blocking[0]}你的回应已保留，可以重试。`,
    )
  const remaining = [
    ...secondCheck.style,
    ...secondCheck.soft,
    ...secondCheck.advisory,
  ]
  if (remaining.length) onSoftIssue?.(remaining)
  return repairedTurn
}
