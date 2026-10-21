import { AUTHOR_BIBLE } from './prompt'
import type {
  EngineResponse,
  ModelSettings,
  ReasoningMode,
} from '../types/story'
import { looksTruncated, parseEngineResponse } from './validation'

/**
 * Set at build time. Off by default so a local checkout, or a copy served
 * without the function, still asks for a personal key instead of failing on a
 * proxy that is not there.
 */
// Read defensively: import.meta.env only exists under Vite, and the engine is
// also loaded by the node test runner.
const buildEnv: Partial<ImportMetaEnv> =
  (import.meta as { env?: ImportMetaEnv }).env ?? {}
export const TRIAL_AVAILABLE = buildEnv.VITE_TRIAL === '1'
const trialCode = buildEnv.VITE_TRIAL_CODE ?? ''
const errorForStatus = (status: number) =>
  ({
    401: '密钥无效或已失效，请到设置中更新。',
    402: '模型账户余额不足，请充值或选择其他模型。',
    403: '当前账户无法使用这个模型。',
    404: '找不到这个模型，请检查模型标识。',
    408: '模型响应超时，可以重试。',
    429: '模型请求过于频繁，请稍后重试。',
  })[status] ?? `模型服务暂时不可用（${status}），可以稍后重试。`

/**
 * Pulls the value of the first "story" field out of a half-received JSON body.
 * The contract puts story first precisely so the prose can be shown while the
 * rest of the object is still arriving; anything unparseable yields '' and the
 * caller simply shows nothing yet.
 */
export function partialStory(buffer: string): string {
  const key = buffer.indexOf('"story"')
  if (key < 0) return ''
  const colon = buffer.indexOf(':', key + 7)
  if (colon < 0) return ''
  const open = buffer.indexOf('"', colon + 1)
  if (open < 0) return ''
  let out = ''
  for (let i = open + 1; i < buffer.length; i++) {
    const c = buffer[i]
    if (c === '"') break
    if (c !== '\\') {
      out += c
      continue
    }
    const next = buffer[i + 1]
    if (next === undefined) break
    if (next === 'u') {
      const hex = buffer.slice(i + 2, i + 6)
      if (hex.length < 4) break
      out += String.fromCharCode(parseInt(hex, 16))
      i += 5
      continue
    }
    out +=
      next === 'n'
        ? '\n'
        : next === 't'
          ? '\t'
          : next === 'r'
            ? '\r'
            : next === 'b' || next === 'f'
              ? ''
              : next
    i += 1
  }
  return out
}

/**
 * Trims a half-received story to its last finished sentence. Anything shorter
 * than a couple of lines is not worth showing, and the turn is refused instead.
 */
function salvagePartial(content: string) {
  const story = partialStory(content)
  const cut = Math.max(
    story.lastIndexOf('。'),
    story.lastIndexOf('”'),
    story.lastIndexOf('！'),
    story.lastIndexOf('？'),
  )
  const trimmed = story.slice(0, cut + 1).trim()
  return trimmed.replace(/[\p{P}\p{Z}\s]/gu, '').length >= 30 ? trimmed : ''
}

/** Truncation is self-correcting: the same request is retried once with a
 * larger budget before the turn is reported as failed. Raising the default
 * instead would break models whose output cap is 4096, and reasoning models
 * spend an unpredictable share of the budget before the first visible token. */
const TOKEN_BUDGETS = [4000, 8000]

/**
 * AbortSignal.timeout and AbortSignal.any are recent additions; Safari only
 * shipped them in 17. Calling a missing one throws a TypeError, which the
 * catch below would have reported as a dropped connection.
 */
function deadline(ms: number) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
    return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(new DOMException('TimeoutError')), ms)
  return controller.signal
}

function either(a: AbortSignal | undefined, b: AbortSignal) {
  if (!a) return b
  if (typeof AbortSignal !== 'undefined' && AbortSignal.any)
    return AbortSignal.any([a, b])
  const controller = new AbortController()
  const stop = () => controller.abort()
  for (const signal of [a, b]) {
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  }
  return controller.signal
}

/**
 * Thinking is where a reasoning model earns its quality: on
 * deepseek-v4.1-flash about three quarters of every reply was reasoning
 * tokens, and turning it off made the prose noticeably worse. So it is left on
 * unless the reader asks otherwise, and the cost is stated in the settings
 * rather than quietly optimised away.
 *
 * The parameter is not accepted by every provider, and a model that requires
 * reasoning rejects it outright, so a 4xx caused by this field drops it for the
 * rest of the session and the request is sent again unchanged.
 */
let reasoningAccepted = true

const reasoningBody = (mode: ReasoningMode = 'keep') =>
  mode === 'off'
    ? { reasoning: { enabled: false, exclude: true } }
    : mode === 'brief'
      ? { reasoning: { effort: 'low' as const, exclude: true } }
      : {}

export const resetProviderFlags = () => {
  reasoningAccepted = true
}

async function readStream(
  res: Response,
  onPartial?: (story: string) => void,
): Promise<{ content: string; finish?: string; usage?: any; model?: string }> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('模型没有返回正文，可以重试。')
  const decoder = new TextDecoder()
  let pending = '',
    content = '',
    finish: string | undefined,
    usage: any,
    model: string | undefined,
    shown = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let chunk: any
      try {
        chunk = JSON.parse(payload)
      } catch {
        continue
      }
      model ??= chunk.model
      if (chunk.usage) usage = chunk.usage
      const choice = chunk.choices?.[0]
      if (choice?.finish_reason) finish = choice.finish_reason
      const delta = choice?.delta?.content
      if (typeof delta !== 'string' || !delta) continue
      content += delta
      const story = partialStory(content)
      if (onPartial && story && story !== shown) {
        shown = story
        onPartial(story)
      }
    }
  }
  return { content, finish, usage, model }
}

/** Where a turn goes when the reader has not brought a key of their own. */
export const TRIAL_ENDPOINT = '/api/story'
/** Turns left in the shared trial, as the proxy last reported it. */
export let trialRemaining: number | null = null

export async function callOpenRouter(
  settings: ModelSettings,
  prompt: string,
  signal?: AbortSignal,
  onPartial?: (story: string) => void,
): Promise<EngineResponse> {
  // With no personal key the turn is sent to this site's trial proxy, which
  // holds the host's key. The key never reaches the browser either way.
  const viaTrial = !settings.apiKey.trim()
  if (viaTrial && !TRIAL_AVAILABLE)
    throw new Error('请先连接模型，让故事回应你的选择。')
  // The system rules alone run past 8000 characters, and reasoning models spend
  // their own budget before the first visible token, so the timeout is set for
  // the slow case rather than the median one.
  const timeout = deadline(210000)
  const startedAt = Date.now()
  const messages = prompt.startsWith(AUTHOR_BIBLE)
    ? [
        { role: 'system', content: AUTHOR_BIBLE },
        { role: 'user', content: prompt.slice(AUTHOR_BIBLE.length) },
      ]
    : [{ role: 'user', content: prompt }]
  try {
    let truncated = false,
      lastPartial = ''
    for (const maxTokens of TOKEN_BUDGETS) {
      const post = () =>
        fetch(
          viaTrial
            ? TRIAL_ENDPOINT
            : 'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            signal: either(signal, timeout),
            credentials: viaTrial ? 'same-origin' : 'omit',
            headers: viaTrial
              ? {
                  'Content-Type': 'application/json',
                  ...(settings.trialCode?.trim() || trialCode
                    ? {
                        'X-Trial-Code': settings.trialCode?.trim() || trialCode,
                      }
                    : {}),
                }
              : {
                  Authorization: `Bearer ${settings.apiKey.trim()}`,
                  'Content-Type': 'application/json',
                  'X-OpenRouter-Title': 'Order Beyond',
                },
            body: JSON.stringify({
              model: settings.model.trim() || 'openrouter/auto',
              messages,
              temperature: 0.85,
              max_tokens: maxTokens,
              ...(reasoningAccepted ? reasoningBody(settings.reasoning) : {}),
              // Streamed so the prose can appear while the rest of the object is
              // still arriving. Providers that ignore it return a normal body,
              // which the branch below still handles.
              stream: true,
              stream_options: { include_usage: true },
            }),
          },
        )
      let res = await post()
      // A model that requires reasoning rejects the field outright. Drop it for
      // the rest of the session and send the same request again, rather than
      // spending one of the token budgets on the refusal.
      if (
        !res.ok &&
        reasoningAccepted &&
        res.status >= 400 &&
        res.status < 500
      ) {
        reasoningAccepted = false
        console.info('[model] 该模型不接受关闭推理的参数，已改用默认设置')
        res = await post()
      }
      if (!res.ok) {
        // The proxy explains its own refusals: quota spent, code missing, or
        // the day's cap reached. Those messages are written for the reader.
        const stated = viaTrial
          ? await res
              .json()
              .then((body: any) => body?.error?.message as string | undefined)
              .catch(() => undefined)
          : undefined
        throw new Error(stated || errorForStatus(res.status))
      }
      const left = res.headers.get('X-Trial-Remaining')
      if (left !== null) trialRemaining = Number(left)
      const streamed = res.headers
        .get('content-type')
        ?.includes('text/event-stream')
      let content: string, finish: string | undefined, usage: any, model: any
      if (streamed) {
        ;({ content, finish, usage, model } = await readStream(res, onPartial))
      } else {
        const data = await res.json()
        if (data.error)
          throw new Error(errorForStatus(Number(data.error.code) || 502))
        content = data.choices?.[0]?.message?.content
        finish = data.choices?.[0]?.finish_reason
        usage = data.usage
        model = data.model
      }
      // Printed on every call so a stalled or truncated turn can be diagnosed
      // from the console without adding a server: it shows whether the budget
      // went to the visible reply or to a reasoning pass before it.
      console.info('[model]', {
        model: model ?? settings.model,
        finish,
        budget: maxTokens,
        streamed: Boolean(streamed),
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        reasoningTokens:
          usage?.completion_tokens_details?.reasoning_tokens ??
          usage?.reasoning_tokens,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      })
      // Prose with no object in it at all is a refusal or a stray preamble,
      // not a cut-off reply: escalating the budget would only waste a request.
      if (typeof content === 'string' && content && !content.includes('{'))
        throw new Error('模型这次没有按格式返回，可以重试。')
      // A body whose braces never close was cut off, whether or not the
      // provider said so: a dropped stream reports no finish_reason at all.
      if (finish === 'length' || (content && looksTruncated(content))) {
        truncated = true
        lastPartial = content || lastPartial
        continue
      }
      if (typeof content !== 'string' || !content)
        throw new Error('模型没有返回正文，可以重试。')
      return parseEngineResponse(content)
    }
    if (truncated) {
      // Last resort: keep the prose that did arrive, trimmed to its last
      // complete sentence, rather than discarding a scene the reader watched
      // being written. Metadata is left to its defaults and the saved time and
      // title carry over untouched.
      const rescued = salvagePartial(lastPartial)
      if (rescued) {
        console.warn('[model] 输出被截断，已保留写出的部分', {
          chars: rescued.length,
        })
        return parseEngineResponse(
          JSON.stringify({ story: rescued, narrative: {} }),
        )
      }
      throw new Error(
        '这次续写在写完前被截断，故事尚未改变。推理型模型会先花掉大部分额度，换一个不带推理的模型通常就好了。',
      )
    }
    throw new Error('模型没有返回正文，可以重试。')
  } catch (e) {
    if (signal?.aborted)
      throw new Error('已停止生成。你的回应已保留，可以继续重试。')
    if (timeout.aborted)
      throw new Error(
        '等待模型超过三分半，你的回应已保留。慢的多半是推理型模型，可以重试或换一个更快的。',
      )
    // Only a genuine fetch failure is a dropped connection. Any other
    // TypeError is a bug on this side, and saying "network" about it hides it.
    const failedToReach =
      e instanceof TypeError &&
      /fetch|network|load failed|connection/i.test((e as Error).message)
    if (failedToReach)
      throw new Error('网络连接中断。已有故事已保存，联网后可以重试。')
    if (e instanceof TypeError) {
      console.error('[model] 请求过程出错', e)
      throw new Error(
        `这次请求没能发出去：${(e as Error).message}。故事已保留，可以重试。`,
      )
    }
    throw e
  }
}
export async function testConnection(apiKey: string) {
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(errorForStatus(res.status))
  const data = await res.json()
  if (!data.data) throw new Error('连接未能验证，请稍后重试。')
  return '密钥验证成功。所选模型的可用性将在续写时确认。'
}
