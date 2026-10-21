import type { RelationshipState } from '../types/story'

/**
 * One number the reader can watch, derived from the eight the engine keeps.
 *
 * The engine tracks attraction, trust, attachment and the rest separately
 * because they move for different reasons, but eight bars would be a dashboard
 * rather than a story. This folds them into the single question the reader is
 * actually asking: how close is he right now.
 *
 * Distance subtracts. Jealousy and tension are left out entirely: both rise in
 * scenes where he is, if anything, more invested, and showing them as losses
 * would teach the reader to avoid exactly the scenes worth playing.
 */
const WEIGHTS: Partial<Record<keyof RelationshipState, number>> = {
  attraction: 1,
  curiosity: 0.6,
  trust: 1.2,
  attachment: 1.4,
  commitment: 1.2,
  distance: -1.1,
}

export function affinityOf(relationship: RelationshipState) {
  let total = 0
  let positive = 0
  for (const [key, weight] of Object.entries(WEIGHTS) as [
    keyof RelationshipState,
    number,
  ][]) {
    total += (relationship[key] ?? 0) * weight
    if (weight > 0) positive += 100 * weight
  }
  return Math.max(0, Math.min(100, Math.round((total / positive) * 100)))
}

/** The stages are named rather than numbered: a percentage invites min-maxing. */
export function affinityStage(value: number) {
  if (value < 12) return '陌路'
  if (value < 28) return '留意'
  if (value < 45) return '在意'
  if (value < 62) return '动心'
  if (value < 78) return '难舍'
  if (value < 92) return '认定'
  return '非你不可'
}

/** What to show after a turn: the change, or nothing when it did not move. */
export function affinityShift(before: number, after: number) {
  const delta = after - before
  if (Math.abs(delta) < 1) return null
  return { delta, rising: delta > 0 }
}
