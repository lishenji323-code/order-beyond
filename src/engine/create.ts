import { generateIdentity } from './identity'
import { generateAppearance } from './appearance'
import type {
  ArchetypeId,
  BackgroundId,
  IntimacyLevel,
  StoryState,
  TropeId,
} from '../types/story'

export function makeState(data: {
  background: BackgroundId
  trope: TropeId
  archetype: ArchetypeId
  traits?: string[]
  tone?: number
  intimacyLevel?: IntimacyLevel
  playerName: string
  /** Blank lets the story choose. */
  maleName?: string
}): StoryState {
  const now = new Date().toISOString()
  const identity = generateIdentity(
    data.background,
    data.trope,
    data.playerName,
    data.maleName ?? '',
  )
  return {
    config: {
      id: crypto.randomUUID(),
      background: data.background,
      trope: data.trope,
      createdAt: now,
      openingClue: identity.openingClue,
      openingSituation: identity.openingSituation,
      tone: Math.max(
        0,
        Math.min(100, Number.isFinite(data.tone) ? data.tone! : 50),
      ),
      intimacyLevel: data.intimacyLevel ?? 'implicit',
      maleLead: {
        name: identity.maleName,
        // Left unset on purpose: the model returns maleBackground on the first
        // turn and applyEngineResponse pins it for the rest of the story.
        archetype: data.archetype,
        traits: data.traits ?? [],
        appearance: generateAppearance(data.archetype, data.background),
      },
      player: {
        name: data.playerName.trim(),
        background: identity.playerBackground,
      },
    },
    relationship: {
      attraction: 24,
      curiosity: 35,
      trust: 18,
      attachment: 5,
      jealousy: 0,
      distance: 62,
      tension: 22,
      commitment: 0,
    },
    plot: {
      worldPressure: 18,
      arcLabel: 'initial_attraction',
      scene: 0,
      turnsSinceRelationshipProgress: 0,
      turnsSincePlotProgress: 0,
    },
    secret: { currentMask: '自然' },
    memories: [],
    threads: [],
    messages: [],
    sceneSummary: '',
    sceneState: { status: 'open', established: [], props: [], offers: [] },
    lastInteractionAt: now,
  }
}
