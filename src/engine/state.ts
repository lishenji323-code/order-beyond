import { sameTime, timeOrder } from './narrative'
import type {
  EngineResponse,
  SceneState,
  StoryMemory,
  StoryState,
  StoryThread,
} from '../types/story'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

const emptyScene = (): SceneState => ({
  status: 'open',
  established: [],
  props: [],
  offers: [],
})

const trimmed = (items: string[] | undefined) =>
  (items ?? []).map((v) => v.trim()).filter(Boolean)

// established/props/offers arrive as this turn's additions. A new scene, or a
// turn following a closed one, starts the bookkeeping over.
function nextSceneState(
  state: StoryState,
  result: EngineResponse,
  startsNewScene: boolean,
): SceneState {
  const previous =
    startsNewScene || state.sceneState?.status === 'closed'
      ? emptyScene()
      : (state.sceneState ?? emptyScene())
  const patch = result.scenePatch
  const established = [
    ...previous.established,
    ...trimmed(patch?.established),
  ].filter((v, i, all) => all.indexOf(v) === i)
  // One entry per object: a later position replaces the earlier one.
  const props = [...previous.props]
  for (const prop of trimmed(patch?.props)) {
    const key = prop.split(/[：:]/)[0].trim()
    const at = props.findIndex((p) => p.split(/[：:]/)[0].trim() === key)
    if (at >= 0) props[at] = prop
    else props.push(prop)
  }
  const offers = [...previous.offers]
  for (const offer of patch?.offers ?? []) {
    const content = offer.content.trim()
    if (!content) continue
    const at = offers.findIndex((o) => o.content.trim() === content)
    if (at >= 0) offers[at] = { ...offers[at], status: offer.status }
    else offers.push({ content, status: offer.status })
  }
  return {
    status: patch?.status ?? 'open',
    established: established.slice(-60),
    props: props.slice(-40),
    offers: offers.slice(-30),
    // Carried forward when the turn says nothing about it, so that silence
    // cannot quietly undo a departure.
    position: patch?.position ?? previous.position,
  }
}

export function applyEngineResponse(
  state: StoryState,
  result: EngineResponse,
): StoryState {
  // A clock that goes backwards is corrected, not fatal. The model omits or
  // fumbles the time field often enough that refusing the turn over it threw
  // away scenes the reader had just watched being written; the saved time is
  // simply kept instead.
  const asked = result.narrative.time
  const corrected =
    (!state.narrative && asked.day !== 1) ||
    (state.narrative && timeOrder(asked) < timeOrder(state.narrative.time))
  if (corrected)
    console.warn('[time] 返回的时间早于存档，已沿用存档时间', {
      asked,
      kept: state.narrative?.time ?? { day: 1, period: asked.period },
    })
  const time = corrected
    ? (state.narrative?.time ?? { day: 1, period: asked.period })
    : asked
  result = { ...result, narrative: { ...result.narrative, time } }
  const previousTime = state.narrative?.time
  const sameMoment = sameTime(previousTime, result.narrative.time)
  const continuingScene =
    sameMoment &&
    result.narrative.title === state.narrative?.title &&
    !result.plotPatch?.scene
  const label = continuingScene
    ? previousTime?.label
    : !sameMoment &&
        previousTime &&
        result.narrative.time.label !== previousTime.label
      ? result.narrative.time.label
      : undefined
  const narrative = {
    ...result.narrative,
    time: {
      day: result.narrative.time.day,
      period: result.narrative.time.period,
      ...(label ? { label } : {}),
    },
  }
  const relationship = { ...state.relationship }
  for (const [key, value] of Object.entries(result.relationshipPatch ?? {})) {
    if (typeof value === 'number' && key in relationship) {
      ;(relationship as any)[key] = clamp((relationship as any)[key] + value)
    }
  }

  const plot = { ...state.plot }
  plot.turnsSinceRelationshipProgress = result.relationshipProgress
    ? 0
    : plot.turnsSinceRelationshipProgress + 1
  plot.turnsSincePlotProgress = result.plotProgress
    ? 0
    : plot.turnsSincePlotProgress + 1
  const startsNewScene = Boolean(result.plotPatch?.scene)
  if (result.plotPatch) {
    plot.worldPressure = clamp(
      plot.worldPressure + (result.plotPatch.worldPressure ?? 0),
    )
    if (result.plotPatch.arcLabel) plot.arcLabel = result.plotPatch.arcLabel
    plot.scene += result.plotPatch.scene ?? 0
  }

  const memories: StoryMemory[] = [...state.memories]
  for (const m of result.memories ?? []) {
    memories.push({
      ...m,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      active: true,
    })
  }

  const resolved = new Set(result.resolveThreadIds ?? [])
  const threads: StoryThread[] = state.threads.map((t) =>
    resolved.has(t.id) ? { ...t, status: 'resolved' } : t,
  )
  for (const t of result.openThreads ?? []) {
    threads.push({ ...t, id: crypto.randomUUID(), status: 'open' })
  }

  return {
    ...state,
    narrative,
    config: {
      ...state.config,
      maleLead: {
        ...state.config.maleLead,
        background: state.config.maleLead.background || result.maleBackground,
      },
    },
    relationship,
    plot,
    secret: { ...state.secret, ...(result.secretStatePatch ?? {}) },
    memories: memories.sort((a, b) => b.importance - a.importance).slice(0, 80),
    threads: threads.slice(-40),
    sceneSummary: result.sceneSummary || state.sceneSummary,
    // Written once with the opening and then left alone.
    briefing: state.briefing || result.briefing,
    sceneState: nextSceneState(state, result, startsNewScene),
    lastInteractionAt: new Date().toISOString(),
  }
}
