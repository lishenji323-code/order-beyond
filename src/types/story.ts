export type StoryId = string

export type BackgroundId =
  | 'modern_city'
  | 'workplace'
  | 'entertainment'
  | 'republican_era'
  | 'hongkong_circle'
  | 'campus'
  | 'esports'
  | 'wealthy_family'
  | 'overseas'
  | 'historical_court'
  | 'fantasy'
  | 'apocalypse'

export type TropeId =
  | 'marriage_first'
  | 'love_hate'
  | 'second_chance'
  | 'rake_reformed'
  | 'reunion'
  | 'saint_exception'
  | 'possessive_love'
  | 'past_life'
  | 'childhood'
  | 'secret_romance'
  | 'contract_love'
  | 'rivals'
  | 'secret_crush'

export type ArchetypeId =
  | 'gentle_tease'
  | 'cool_quiet'
  | 'restrained_power'
  | 'free_spirit'
  | 'wild_danger'
  | 'bright_unreliable'
  | 'sweet_dark'
  | 'scheming_gentleman'
  | 'principled_cold'
  | 'silent_doer'
  | 'sharp_soft'
  | 'loyal_devoted'

export interface ChoiceCard {
  id: string
  title: string
  subtitle: string
  hook: string
}

export interface CharacterAppearance {
  height: string
  build: string
  hair: string
  face: string
  style: string
  signature: string
  aura: string
}

export interface CharacterProfile {
  background?: string
  name: string
  archetype: ArchetypeId
  traits: string[]
  customNote?: string
  appearance: CharacterAppearance
}

export interface PlayerProfile {
  name: string
  background: string
  addressByMaleLead?: string
}

export interface RelationshipState {
  attraction: number
  curiosity: number
  trust: number
  attachment: number
  jealousy: number
  distance: number
  tension: number
  commitment: number
}

export interface PlotState {
  worldPressure: number
  arcLabel: string
  chapter?: number // Legacy saves only.
  scene: number
  turnsSinceRelationshipProgress: number
  turnsSincePlotProgress: number
}

export interface StoryMemory {
  id: string
  type: 'fact' | 'relationship' | 'emotional' | 'promise'
  content: string
  importance: number
  createdAt: string
  active: boolean
}

export interface StoryThread {
  id: string
  content: string
  knownByPlayer: boolean
  urgency: number
  status: 'open' | 'resolved'
}

export type IntimacyLevel = 'fade' | 'implicit' | 'explicit'

export interface SceneOffer {
  content: string
  status: 'pending' | 'accepted' | 'declined'
}

/** Where the male lead is at the end of the turn, so that a departure sticks. */
export interface ScenePosition {
  where: string
  status: 'present' | 'leaving' | 'gone'
}

/** Within-scene bookkeeping. Cleared when a new scene begins. */
export interface SceneState {
  status: 'open' | 'closed'
  established: string[]
  props: string[]
  offers: SceneOffer[]
  position?: ScenePosition
}

export interface ScenePatch {
  status?: 'open' | 'closed'
  established?: string[]
  props?: string[]
  offers?: SceneOffer[]
  position?: ScenePosition
}

export interface SecretState {
  currentMask?: string
  privateIntention?: string
  jealousOf?: string
  waitingForExplanation?: boolean
  [key: string]: string | number | boolean | undefined
}

export interface StoryTime {
  day: number
  period: 'day' | 'night'
  label?: string
}

export interface Narrative {
  title: string
  time: StoryTime
}

export interface StoryMessage {
  id: string
  role: 'narrator' | 'male' | 'player' | 'system'
  content: string
  createdAt: string
  chapter?: number // Legacy saves only.
  storyTime?: StoryTime
}

export interface StoryConfig {
  id: StoryId
  background: BackgroundId
  trope: TropeId
  maleLead: CharacterProfile
  player: PlayerProfile
  createdAt: string
  openingClue?: string
  openingSituation?: {
    place: string
    event: string
    socialCue: string
    localLine: string
    /** A direction for the male lead's identity, not the identity itself. */
    maleHint?: string
    /** How the first scene is staged. */
    shape?: string
  }
  tone?: number
  /** Set at creation, never by the model. Legacy saves default to implicit. */
  intimacyLevel?: IntimacyLevel
}

export interface StoryState {
  narrative?: Narrative
  config: StoryConfig
  relationship: RelationshipState
  plot: PlotState
  secret: SecretState
  memories: StoryMemory[]
  threads: StoryThread[]
  messages: StoryMessage[]
  sceneSummary: string
  /** Shown once above the first scene: who they are and what already happened. */
  briefing?: string
  /** Named sceneState to avoid confusion with plot.scene, the scene counter. */
  sceneState?: SceneState
  lastInteractionAt: string
}

/** How much thinking the model is asked to do before it writes. */
export type ReasoningMode = 'keep' | 'brief' | 'off'

export interface ModelSettings {
  apiKey: string
  model: string
  rememberKey?: boolean
  reasoning?: ReasoningMode
  /** When set, any style drift buys a rewrite: better prose, slower turns. */
  strictStyle?: boolean
  /** Invite code for a shared link whose proxy asks for one. */
  trialCode?: string
}

export interface Book {
  id: string
  title: string
  state: StoryState
  updatedAt: string
  revision: number
  archived: boolean
  draft: string
  bookmark?: string
  pending?: { input: string; opening: boolean }
}

export interface ReadingSettings {
  fontSize: number
  lineHeight: number
  theme: 'dream' | 'paper'
}

export interface EngineResponse {
  maleBackground?: string
  narrative: Narrative
  story: string
  relationshipProgress: boolean
  plotProgress: boolean
  progressReason?: string
  relationshipPatch?: Partial<RelationshipState>
  plotPatch?: Partial<PlotState>
  secretStatePatch?: SecretState
  memories?: Omit<StoryMemory, 'id' | 'createdAt' | 'active'>[]
  openThreads?: Omit<StoryThread, 'id' | 'status'>[]
  resolveThreadIds?: string[]
  sceneSummary?: string
  /** Returned with the opening only. */
  briefing?: string
  scenePatch?: ScenePatch
}
