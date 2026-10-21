/**
 * Trial proxy. Holds the host's OpenRouter key so a friend can read a few
 * scenes before deciding whether to bring their own, and streams the reply
 * straight through so the reader still sees the prose arrive.
 *
 * Deploy as a Cloudflare Pages Function at /api/story.
 *
 * Bindings and variables:
 *   OPENROUTER_KEY  secret   the host's key. Never reaches the browser.
 *   TRIAL           KV       per-visitor and per-day counters.
 *   TRIAL_MODELS    var      comma-separated allowlist; the first is the default.
 *   TRIAL_CODE      var      optional shared invite code. Set it if the link
 *                            might travel further than intended.
 *   COOKIE_SECRET   secret   signs the visitor cookie.
 *
 * The per-visitor count is a courtesy, not a wall: clearing the cookie earns
 * another allowance. What actually protects the bill is DAILY_TURN_CAP, the
 * model allowlist and the token cap.
 */
import {
  DAILY_TURN_CAP,
  TRIAL_TURNS,
  checkTrial,
  sanitizeRequest,
  type TrialUsage,
} from '../../src/engine/trial'

interface Env {
  OPENROUTER_KEY: string
  TRIAL: KVNamespace
  TRIAL_MODELS?: string
  TRIAL_CODE?: string
  COOKIE_SECRET?: string
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const refuse = (message: string, status = 429, headers: HeadersInit = {}) =>
  json({ error: { message, code: status } }, status, headers)

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

/** A signed, http-only id so the count survives a reload but not a new browser. */
async function visitorId(request: Request, secret: string) {
  const cookie = request.headers.get('Cookie') ?? ''
  const found = /(?:^|;\s*)ob_trial=([^;]+)/.exec(cookie)?.[1]
  if (found) {
    const [id, mac] = decodeURIComponent(found).split('.')
    if (id && mac && (await sign(id, secret)) === mac) return { id, fresh: false }
  }
  const id = crypto.randomUUID()
  return { id, fresh: true }
}

const today = () => new Date().toISOString().slice(0, 10)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OPENROUTER_KEY)
    return refuse('这个站点还没有配置试玩额度，请填入你自己的密钥。', 503)
  const secret = env.COOKIE_SECRET || env.OPENROUTER_KEY
  const allowed = (env.TRIAL_MODELS || 'deepseek/deepseek-chat')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)

  if (env.TRIAL_CODE) {
    const given = request.headers.get('X-Trial-Code') ?? ''
    if (given !== env.TRIAL_CODE)
      return refuse('需要邀请码才能试玩，或者填入你自己的密钥。', 403)
  }

  const prepared = sanitizeRequest(await request.json().catch(() => null), allowed)
  if ('error' in prepared) return refuse(prepared.error, 400)

  const { id, fresh } = await visitorId(request, secret)
  const dayKey = `day:${today()}`
  const [usageRaw, dayRaw] = await Promise.all([
    env.TRIAL.get(`visitor:${id}`),
    env.TRIAL.get(dayKey),
  ])
  const usage = usageRaw ? (JSON.parse(usageRaw) as TrialUsage) : null
  const dayTurns = Number(dayRaw) || 0
  const verdict = checkTrial(usage, Date.now(), dayTurns)

  const cookie = fresh
    ? {
        'Set-Cookie': `ob_trial=${encodeURIComponent(
          `${id}.${await sign(id, secret)}`,
        )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      }
    : {}

  if (!verdict.allowed)
    return refuse(verdict.reason ?? '试玩额度已用完。', 429, {
      ...cookie,
      'X-Trial-Remaining': '0',
      'X-Trial-Total': String(TRIAL_TURNS),
    })

  // Counted before the call, so a hung or aborted request cannot be replayed
  // for free. A trial turn is cheap; an unmetered one is not.
  await Promise.all([
    env.TRIAL.put(`visitor:${id}`, JSON.stringify(verdict.next), {
      expirationTtl: 60 * 60 * 24 * 30,
    }),
    env.TRIAL.put(dayKey, String(dayTurns + 1), {
      expirationTtl: 60 * 60 * 48,
    }),
  ])

  const upstream = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'Order Beyond (trial)',
      },
      body: JSON.stringify(prepared.body),
      signal: request.signal,
    },
  )

  const headers = new Headers({
    ...cookie,
    'X-Trial-Remaining': String(verdict.remaining),
    'X-Trial-Total': String(TRIAL_TURNS),
    'Cache-Control': 'no-store',
  })
  const type = upstream.headers.get('Content-Type')
  if (type) headers.set('Content-Type', type)
  if (dayTurns + 1 >= DAILY_TURN_CAP) headers.set('X-Trial-Day-Closed', '1')
  return new Response(upstream.body, { status: upstream.status, headers })
}
