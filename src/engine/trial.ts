/**
 * Quota decisions for a link shared with a few friends, all of it running on
 * the host's key. Kept pure so it can be tested without a runtime.
 *
 * These numbers are a second line of defence, not the first: the real ceiling
 * is the spend limit set on the OpenRouter key itself, and the real gate is the
 * invite code. A visitor who clears the cookie earns another allowance, which
 * is fine when the guest list is three people.
 */

/** Per visitor. Generous, since everyone here was invited. */
export const TRIAL_TURNS = 400
/** Requests per visitor per hour, so one stuck tab cannot run all night. */
export const TRIAL_BURST = 40
/** Whole-site ceiling for a UTC day, in case the link travels. */
export const DAILY_TURN_CAP = 600
/** Anything above this is an attempt to run something else on the account. */
export const MAX_TOKENS_CAP = 8000

export interface TrialUsage {
  turns: number
  hourStartedAt: number
  hourTurns: number
}

export interface TrialVerdict {
  allowed: boolean
  remaining: number
  /** Sent to the reader verbatim when refused. */
  reason?: string
  next: TrialUsage
}

export const emptyUsage = (now: number): TrialUsage => ({
  turns: 0,
  hourStartedAt: now,
  hourTurns: 0,
})

export function checkTrial(
  usage: TrialUsage | null,
  now: number,
  dayTurns: number,
): TrialVerdict {
  const current = usage ?? emptyUsage(now)
  const hour = 60 * 60 * 1000
  const rolled = now - current.hourStartedAt >= hour
  const hourTurns = rolled ? 0 : current.hourTurns
  const next: TrialUsage = {
    turns: current.turns + 1,
    hourStartedAt: rolled ? now : current.hourStartedAt,
    hourTurns: hourTurns + 1,
  }
  const remaining = Math.max(0, TRIAL_TURNS - current.turns)
  if (dayTurns >= DAILY_TURN_CAP)
    return {
      allowed: false,
      remaining,
      reason:
        '今天这个链接的额度用完了，明天再来，或者告诉分享给你的人。你写的内容已经保留。',
      next: current,
    }
  if (current.turns >= TRIAL_TURNS)
    return {
      allowed: false,
      remaining: 0,
      reason:
        '这个链接给你的额度用完了，告诉分享给你的人就好。你写的内容已经保留。',
      next: current,
    }
  if (hourTurns >= TRIAL_BURST)
    return {
      allowed: false,
      remaining,
      reason: '这一小时的次数到上限了，等一会儿再来。',
      next: current,
    }
  return { allowed: true, remaining: remaining - 1, next }
}

/**
 * The client may not choose what runs on the host's account. Only the models
 * the site is willing to pay for, and only within the token cap.
 */
export function sanitizeRequest(
  body: unknown,
  allowed: string[],
): { body: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { error: '请求格式不对。' }
  const raw = body as Record<string, unknown>
  if (!Array.isArray(raw.messages) || !raw.messages.length)
    return { error: '请求里没有内容。' }
  const asked = typeof raw.model === 'string' ? raw.model : ''
  const model = allowed.includes(asked) ? asked : allowed[0]
  const requested = Number(raw.max_tokens)
  const max_tokens = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.floor(requested)), MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP
  return {
    body: {
      model,
      messages: raw.messages,
      temperature: typeof raw.temperature === 'number' ? raw.temperature : 0.85,
      max_tokens,
      stream: raw.stream === true,
      ...(raw.stream === true
        ? { stream_options: { include_usage: true } }
        : {}),
      ...(raw.reasoning && typeof raw.reasoning === 'object'
        ? { reasoning: raw.reasoning }
        : {}),
    },
  }
}
