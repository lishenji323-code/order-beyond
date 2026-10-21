import { z } from 'zod'
import { validNarrativeTitle } from './narrative'
import type { Book, EngineResponse, StoryState } from '../types/story'
const text = z.string().max(50000)
const short = z.string().max(3000)
const id = z.string().min(1).max(150)
const date = z.string().refine((v) => Number.isFinite(Date.parse(v)))
const number = z.number().finite()
const storyTime = z.object({
  day: number.int().min(1).max(100000),
  period: z.enum(['day', 'night']),
  label: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .refine(
      (v) =>
        /^(翌日|次日|翌晨|当晚|入夜|天亮时|翌年)$|后$/.test(v) &&
        !/[\r\n]/.test(v),
    )
    .optional(),
})
const narrative = z.object({
  title: z.string().trim().min(1).max(24).refine(validNarrativeTitle),
  time: storyTime,
})
const relationship = z.object({
  attraction: number,
  curiosity: number,
  trust: number,
  attachment: number,
  jealousy: number,
  distance: number,
  tension: number,
  commitment: number,
})
const plot = z.object({
  worldPressure: number,
  arcLabel: short,
  chapter: number.int().min(1).optional(),
  scene: number.int().min(0),
  turnsSinceRelationshipProgress: number.int().min(0),
  turnsSincePlotProgress: number.int().min(0),
})
const memory = z.object({
  type: z.enum(['fact', 'relationship', 'emotional', 'promise']),
  content: short,
  importance: number.min(0).max(10),
})
const thread = z.object({
  content: short,
  knownByPlayer: z.boolean(),
  urgency: number.min(0).max(1),
})
const sceneOffer = z.object({
  content: short,
  status: z.enum(['pending', 'accepted', 'declined']),
})
const scenePosition = z.object({
  where: short,
  status: z.enum(['present', 'leaving', 'gone']),
})
const sceneState = z.object({
  status: z.enum(['open', 'closed']),
  established: z.array(short).max(60),
  props: z.array(short).max(40),
  offers: z.array(sceneOffer).max(30),
  position: scenePosition.optional(),
})
const secret = z
  .record(z.string().max(100), z.union([short, number, z.boolean()]))
  .refine(
    (v) =>
      !['__proto__', 'constructor', 'prototype'].some((k) =>
        Object.hasOwn(v, k),
      ),
  )
export const storySchema = z.object({
  narrative: narrative.optional(),
  config: z.object({
    id,
    background: z.enum([
      'modern_city',
      'workplace',
      'entertainment',
      'republican_era',
      'hongkong_circle',
      'campus',
      'esports',
      'wealthy_family',
      'overseas',
      'historical_court',
      'fantasy',
      'apocalypse',
    ]),
    trope: z.enum([
      'marriage_first',
      'love_hate',
      'second_chance',
      'rake_reformed',
      'reunion',
      'saint_exception',
      'possessive_love',
      'past_life',
      'childhood',
      'secret_romance',
      'contract_love',
      'rivals',
      'secret_crush',
    ]),
    createdAt: date,
    openingClue: short.optional(),
    openingSituation: z
      .object({
        place: short,
        event: short,
        socialCue: short,
        localLine: short,
        maleHint: short.optional(),
        shape: short.optional(),
      })
      .optional(),
    tone: number.min(0).max(100).optional(),
    intimacyLevel: z.enum(['fade', 'implicit', 'explicit']).optional(),
    maleLead: z.object({
      background: short.optional(),
      name: short,
      archetype: z.enum([
        'gentle_tease',
        'cool_quiet',
        'restrained_power',
        'free_spirit',
        'wild_danger',
        'bright_unreliable',
        'sweet_dark',
        'scheming_gentleman',
        'principled_cold',
        'silent_doer',
        'sharp_soft',
        'loyal_devoted',
      ]),
      traits: z.array(short).max(30),
      customNote: short.optional(),
      appearance: z.object({
        height: short,
        build: short,
        hair: short,
        face: short,
        style: short,
        signature: short,
        aura: short,
      }),
    }),
    player: z.object({
      name: short,
      background: short,
      addressByMaleLead: short.optional(),
    }),
  }),
  relationship,
  plot,
  secret,
  memories: z
    .array(memory.extend({ id, createdAt: date, active: z.boolean() }))
    .max(100),
  threads: z
    .array(thread.extend({ id, status: z.enum(['open', 'resolved']) }))
    .max(100),
  messages: z
    .array(
      z.object({
        id,
        role: z.enum(['narrator', 'male', 'player', 'system']),
        content: text,
        createdAt: date,
        chapter: number.int().min(1).optional(),
        storyTime: storyTime.optional(),
      }),
    )
    .max(30000),
  sceneSummary: short,
  briefing: short.optional(),
  sceneState: sceneState.optional(),
  lastInteractionAt: date,
})
export const bookSchema = z
  .object({
    id,
    title: z.string().min(1).max(80),
    state: storySchema,
    updatedAt: date,
    revision: number.int().min(0),
    archived: z.boolean(),
    draft: z.string().max(4000),
    bookmark: id.optional(),
    pending: z
      .object({ input: z.string().max(4000), opening: z.boolean() })
      .optional(),
  })
  .refine((v) => v.id === v.state.config.id)
const responseSchema = z.object({
  maleBackground: short.optional(),
  narrative,
  story: text.min(1).refine((v) => v.trim().length > 0),
  relationshipProgress: z.boolean(),
  plotProgress: z.boolean(),
  progressReason: short.optional(),
  relationshipPatch: relationship.partial().optional(),
  plotPatch: z
    .object({
      worldPressure: number.min(-100).max(100).optional(),
      arcLabel: short.optional(),
      chapter: number.int().min(0).max(1).optional(),
      scene: number.int().min(0).max(1).optional(),
    })
    .optional(),
  secretStatePatch: secret.optional(),
  memories: z.array(memory).max(20).optional(),
  openThreads: z.array(thread).max(10).optional(),
  resolveThreadIds: z.array(id).max(40).optional(),
  sceneSummary: short.optional(),
  briefing: short.optional(),
  // Additions for this turn only; the engine merges and resets them.
  // intimacyLevel is intentionally not accepted here: the model cannot change the rating.
  scenePatch: z
    .object({
      status: z.enum(['open', 'closed']).optional(),
      established: z.array(short).max(12).optional(),
      props: z.array(short).max(12).optional(),
      offers: z.array(sceneOffer).max(8).optional(),
      position: scenePosition.optional(),
    })
    .optional(),
})
/**
 * Models routinely put real newlines inside JSON strings instead of \n, and
 * leave a trailing comma before a closing brace. Both make JSON.parse fail on
 * an otherwise complete reply, so they are repaired rather than reported.
 */
function salvageJson(raw: string) {
  const chars = [...raw]
  let out = '',
    inString = false,
    escaped = false
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      if (!inString) {
        inString = true
        out += ch
        continue
      }
      // A quote only closes the string when the structure continues after it.
      // Models regularly type straight quotes around dialogue inside the prose,
      // which would otherwise end the value halfway through the scene.
      const rest = chars
        .slice(i + 1)
        .join('')
        .trimStart()
      if (/^[,:}\]]/.test(rest) || rest === '') {
        inString = false
        out += ch
      } else {
        out += '\\"'
      }
      continue
    }
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\t' ? '\\t' : ch === '\r' ? '' : '\\n'
      continue
    }
    out += ch
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

const extractJsonBody = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content
  const open = fenced.indexOf('{')
  const close = fenced.lastIndexOf('}')
  return open < 0 || close < open ? '' : fenced.slice(open, close + 1)
}

/**
 * Whether the reply was cut off in transit or by the token budget.
 *
 * Decided by whether the object can be read, not by counting braces: prose
 * containing an odd number of straight quotes throws a brace scan off and used
 * to have complete replies retried at the larger budget for nothing.
 */
export function looksTruncated(content: string) {
  const body = extractJsonBody(content)
  if (!body) return true
  try {
    JSON.parse(body)
    return false
  } catch {}
  try {
    JSON.parse(salvageJson(body))
    return false
  } catch {}
  return true
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/**
 * Only `story` is essential. Everything else is repaired or dropped, because
 * refusing a written turn over a title or a time label costs the reader far
 * more than a missing field costs the engine.
 */
function normalizeResponse(value: unknown) {
  if (!isRecord(value)) return value
  const raw = { ...value }
  // Booleans are routinely omitted when false.
  raw.relationshipProgress = raw.relationshipProgress === true
  raw.plotProgress = raw.plotProgress === true
  const narrative = isRecord(raw.narrative) ? { ...raw.narrative } : {}
  const title =
    typeof narrative.title === 'string'
      ? narrative.title.trim().slice(0, 24)
      : ''
  narrative.title = title && validNarrativeTitle(title) ? title : '未题'
  const time = isRecord(narrative.time) ? { ...narrative.time } : {}
  const day = Number(time.day)
  time.day = Number.isFinite(day) && day >= 1 ? Math.floor(day) : 1
  time.period = time.period === 'day' ? 'day' : 'night'
  // A label that does not match the jump-hint pattern is dropped, not fatal.
  if (typeof time.label !== 'string' || !storyTime.safeParse(time).success)
    delete time.label
  narrative.time = time
  raw.narrative = narrative
  // Numbers arrive as strings often enough to be worth coercing rather than
  // dropping the whole patch they sit in.
  for (const key of ['plotPatch', 'relationshipPatch'] as const)
    if (isRecord(raw[key])) {
      const patch: Record<string, unknown> = { ...raw[key] }
      for (const [field, value] of Object.entries(patch)) {
        if (typeof value !== 'string') continue
        const asNumber = Number(value)
        if (Number.isFinite(asNumber)) patch[field] = asNumber
      }
      if (typeof patch.scene === 'number') patch.scene = Math.round(patch.scene)
      raw[key] = patch
    }
  for (const [key, limit] of [
    ['memories', 20],
    ['openThreads', 10],
    ['resolveThreadIds', 40],
  ] as const)
    if (Array.isArray(raw[key]))
      raw[key] = (raw[key] as unknown[]).slice(0, limit)
  // Numbers arrive as strings often enough to be worth coercing rather than
  // dropping the whole patch over.
  if (isRecord(raw.plotPatch)) {
    const patch = { ...raw.plotPatch }
    for (const key of ['worldPressure', 'scene'] as const) {
      const value = Number(patch[key])
      if (patch[key] !== undefined)
        patch[key] = Number.isFinite(value) ? Math.trunc(value) : undefined
    }
    raw.plotPatch = patch
  }
  if (isRecord(raw.scenePatch)) {
    const patch = { ...raw.scenePatch }
    for (const [key, limit] of [
      ['established', 12],
      ['props', 12],
      ['offers', 8],
    ] as const)
      if (Array.isArray(patch[key]))
        patch[key] = (patch[key] as unknown[]).slice(0, limit)
    raw.scenePatch = patch
  }
  return raw
}

export function parseEngineResponse(content: string): EngineResponse {
  const body = extractJsonBody(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    try {
      parsed = JSON.parse(salvageJson(body))
    } catch {
      console.warn('[parse] JSON 无法解析，尾部：', body.slice(-160))
      throw new Error(
        '这次续写没有完整返回。原来的故事已保留，可以重试或更换模型。',
      )
    }
  }
  const normalized = normalizeResponse(parsed)
  const first = responseSchema.safeParse(normalized)
  if (first.success) return first.data
  // Drop whatever optional field is still objectionable and try once more.
  if (isRecord(normalized)) {
    const stripped = { ...normalized }
    for (const issue of first.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && key !== 'story' && key !== 'narrative')
        delete stripped[key]
    }
    const second = responseSchema.safeParse(stripped)
    if (second.success) {
      console.warn(
        '[parse] 已丢弃无法校验的字段：',
        first.error.issues.map((i) => i.path.join('.')).join(', '),
      )
      return second.data
    }
    console.warn('[parse] 校验失败：', second.error.issues.slice(0, 5))
  }
  throw new Error(
    '这次续写没有完整返回。原来的故事已保留，可以重试或更换模型。',
  )
}
export function parseStory(value: unknown): StoryState {
  return storySchema.parse(value)
}
export function parseBook(value: unknown): Book {
  return bookSchema.parse(value)
}
export function parseBackup(raw: string): Book[] {
  if (raw.length > 50 * 1024 * 1024)
    throw new Error('备份超过 50 MB，请分故事导入。')
  try {
    return z
      .object({
        format: z.literal('order-beyond'),
        version: z.literal(1),
        books: z.array(bookSchema).min(1).max(100),
      })
      .parse(JSON.parse(raw)).books
  } catch {
    throw new Error('这不是有效的《秩序之外》备份，已有故事没有改变。')
  }
}
export function serializeBackup(books: Book[]) {
  return JSON.stringify(
    {
      format: 'order-beyond',
      version: 1,
      exportedAt: new Date().toISOString(),
      books: books.map(parseBook),
    },
    null,
    2,
  )
}
