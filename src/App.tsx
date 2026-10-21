import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { archetypes, backgrounds, tropes } from './data/catalog'
import { makeState } from './engine/create'
import { generateStory } from './engine/generation'
import { applyEngineResponse } from './engine/state'
import { timeLabel, readingTitle, sameTime } from './engine/narrative'
import {
  downloadFile,
  listBooks,
  migrateLegacy,
  saveBook,
} from './engine/library'
import { serializeBackup } from './engine/validation'
import { CONTINUE_TURN } from './engine/turns'
import { TRIAL_AVAILABLE, trialRemaining } from './engine/openrouter'
import { affinityOf, affinityShift, affinityStage } from './engine/affinity'
import { randomMaleName } from './engine/identity'
import { readerBackground } from './data/backgrounds'
import type {
  ArchetypeId,
  IntimacyLevel,
  ReasoningMode,
  BackgroundId,
  Book,
  ModelSettings,
  StoryState,
  TropeId,
} from './types/story'

type Screen =
  'home' | 'world' | 'trope' | 'person' | 'name' | 'reader' | 'settings'
type Draft = {
  maleName: string
  background: BackgroundId
  trope: TropeId
  archetype: ArchetypeId
  tone: number
  intimacyLevel: IntimacyLevel
  playerName: string
}
const intimacyOptions: { id: IntimacyLevel; label: string; hint: string }[] = [
  { id: 'fade', label: '止于门前', hint: '亲吻与抚触，再往下切场' },
  { id: 'implicit', label: '含蓄', hint: '过程可写，不写具体细节' },
  { id: 'explicit', label: '直白', hint: '允许直接的身体描写' },
]
const steps: Screen[] = ['world', 'trope', 'person', 'name']
const initialDraft: Draft = {
  background: 'modern_city',
  trope: 'marriage_first',
  archetype: 'gentle_tease',
  tone: 50,
  intimacyLevel: 'implicit',
  playerName: '',
  maleName: '',
}
const SETTINGS_KEY = 'order-beyond:model'
// Thinking is what a reasoning model writes well with, so the default keeps it.
const reasoningModes: { id: ReasoningMode; label: string; hint: string }[] = [
  { id: 'keep', label: '保持', hint: '让模型充分思考，文字最好，最慢' },
  { id: 'brief', label: '精简', hint: '只做简短思考，快一些' },
  { id: 'off', label: '关闭', hint: '不思考直接写，最快，文字会变粗糙' },
]
function readSettings(): ModelSettings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
      model: typeof v.model === 'string' ? v.model : 'openrouter/auto',
      reasoning: reasoningModes.some((m) => m.id === v.reasoning)
        ? v.reasoning
        : 'keep',
      strictStyle: v.strictStyle === true,
      trialCode: typeof v.trialCode === 'string' ? v.trialCode : '',
    }
  } catch {
    return { apiKey: '', model: 'openrouter/auto', reasoning: 'keep' }
  }
}
function readDraft(): Draft {
  try {
    const v = JSON.parse(localStorage.getItem('order-beyond:draft') || 'null')
    if (
      v &&
      backgrounds.some((x) => x.id === v.background) &&
      tropes.some((x) => x.id === v.trope) &&
      archetypes.some((x) => x.id === v.archetype) &&
      typeof v.playerName === 'string'
    ) {
      return {
        background: v.background,
        trope: v.trope,
        archetype: v.archetype,
        playerName: v.playerName.slice(0, 20),
        tone: Number.isFinite(v.tone) ? Math.max(0, Math.min(100, v.tone)) : 50,
        intimacyLevel: intimacyOptions.some((x) => x.id === v.intimacyLevel)
          ? v.intimacyLevel
          : 'implicit',
        maleName: typeof v.maleName === 'string' ? v.maleName.slice(0, 20) : '',
      }
    }
  } catch {}
  return initialDraft
}

function route(): Screen {
  // On a shared link nothing works without the code, so a first-time visitor
  // is sent there before the cover rather than discovering it at the point of
  // writing the first scene.
  if (TRIAL_AVAILABLE && !readSettings().trialCode?.trim()) return 'settings'
  const s = location.hash.slice(2)
  return ['world', 'trope', 'person', 'name', 'reader', 'settings'].includes(s)
    ? (s as Screen)
    : 'home'
}
const screenNumber: Record<Screen, number> = {
  home: 2,
  world: 3,
  trope: 4,
  person: 5,
  name: 6,
  reader: 7,
  settings: 8,
}
const screenText = {
  world: { label: '此地', title: '你想走进哪里' },
  trope: { label: '相逢', title: '我们现在算什么...' },
  person: { label: '其人', title: '我属于你...' },
}
function Scene({
  screen,
  children,
  className = '',
  image,
}: {
  screen: Screen
  children: ReactNode
  className?: string
  /** Overrides the screen's default artwork, used to give each world its own. */
  image?: string
}) {
  return (
    <main
      className={`scene scene-${screen} ${className}`}
      style={
        {
          '--scene-image': `url('${image ?? `/figma/6-${screenNumber[screen]}-img.png`}')`,
        } as CSSProperties
      }
    >
      {children}
    </main>
  )
}
function Back({
  onClick,
  disabled = false,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      className="back"
      aria-label="返回"
      disabled={disabled}
      onClick={onClick}
    >
      <img src="/figma/6-3-img1.svg" width="61" height="48" alt="" />
    </button>
  )
}
function Glow({
  children,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  assetScreen = 7,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  assetScreen?: 6 | 7 | 8
}) {
  return (
    <button
      type={type}
      className={`glow ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <img src={`/figma/6-${assetScreen}-img2.svg`} alt="" />
      {assetScreen !== 6 && (
        <img
          className="inner"
          src={`/figma/6-${assetScreen}-img3.svg`}
          alt=""
        />
      )}
      <span>{children}</span>
    </button>
  )
}
function App() {
  const [screen, setScreen] = useState<Screen>(route),
    [draft, setDraft] = useState(readDraft),
    [settings, setSettings] = useState(readSettings)
  const [book, setBook] = useState<Book | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [streaming, setStreaming] = useState(''),
    [redrafting, setRedrafting] = useState(false),
    [error, setError] = useState(''),
    [unsaved, setUnsaved] = useState<Book | null>(null),
    [input, setInput] = useState(''),
    [online, setOnline] = useState(navigator.onLine)
  const [connection, setConnection] = useState(settings),
    [settingsReturn, setSettingsReturn] = useState<Screen>('reader')
  const active = useRef<Book | null>(null),
    controller = useRef<AbortController | null>(null),
    running = useRef(false),
    startAfterConnect = useRef(false),
    // The value the bar was last drawn at, so a turn can show what it moved by.
    shownAffinity = useRef(0)
  const feed = useRef<HTMLDivElement>(null),
    form = useRef<HTMLTextAreaElement>(null)
  const setCurrent = (value: Book) => {
    // Opening a saved story starts the bar where it already stands, instead of
    // reporting the whole history as one jump.
    if (value.id !== active.current?.id)
      shownAffinity.current = affinityOf(value.state.relationship)
    active.current = value
    setBook(value)
  }
  function go(next: Screen) {
    if (running.current || unsaved) return
    setError('')
    location.hash = `/${next}`
    setScreen(next)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const hash = () => {
      if (running.current) return
      setScreen(route())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', hash)
    return () => window.removeEventListener('hashchange', hash)
  }, [screen])
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        try {
          await migrateLegacy()
        } catch {
          if (alive) setError('旧存档暂时无法迁移，原始数据仍保留在本机。')
        }
        const all = await listBooks()
        const id = localStorage.getItem('order-beyond:active')
        const latest =
          all.find((b) => b.id === id) ?? all.find((b) => !b.archived)
        if (alive && latest) {
          setCurrent(latest)
          setInput(
            latest.pending?.input ??
              localStorage.getItem(`draft:${latest.id}`) ??
              latest.draft,
          )
        }
      } catch (e) {
        if (alive) setError((e as Error).message)
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('order-beyond:draft', JSON.stringify(draft))
    } catch {
      setError('创建进度未能保存，请检查浏览器存储空间。')
    }
  }, [draft])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    if (screen === 'reader' && book) {
      const saved = sessionStorage.getItem(`scroll:${book.id}`)
      if (saved)
        requestAnimationFrame(() => {
          if (feed.current) feed.current.scrollTop = Number(saved)
        })
    }
  }, [screen, book?.id])
  useEffect(() => {
    const saveScroll = () => {
      if (screen === 'reader' && active.current)
        sessionStorage.setItem(
          `scroll:${active.current.id}`,
          String(feed.current?.scrollTop ?? 0),
        )
    }
    document.addEventListener('scroll', saveScroll, {
      passive: true,
      capture: true,
    })
    return () => document.removeEventListener('scroll', saveScroll, true)
  }, [screen])
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (running.current || unsaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [unsaved])
  async function persist(value: Book) {
    try {
      const saved = await saveBook(value)
      setCurrent(saved)
      setUnsaved(null)
      try {
        localStorage.setItem('order-beyond:active', saved.id)
      } catch {}
      return saved
    } catch (e) {
      setUnsaved(value)
      throw e
    }
  }
  async function generate(base: Book, locked = false) {
    if (running.current && !locked) return
    running.current = true
    setLoading(true)
    setError('')
    const ctl = new AbortController()
    controller.current = ctl
    try {
      const pending = base.pending!
      let state = base.state
      if (!pending.opening && pending.input !== CONTINUE_TURN)
        state = {
          ...state,
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              role: 'player',
              content: pending.input,
              createdAt: new Date().toISOString(),
              storyTime: state.narrative?.time,
            },
          ],
        }
      const result = await generateStory(
        settings,
        state,
        pending.input,
        pending.opening,
        ctl.signal,
        // Soft style indicators are observed, not surfaced to the reader: a
        // single one is not worth spending the turn's one rewrite on.
        (notes) => console.info('[style]', notes.join(' ')),
        // Shown as it arrives: a minute of blank waiting is worse than the
        // occasional visible retake. A rewrite dims the draft in place instead
        // of blanking it, so the text is replaced once rather than flickering.
        setStreaming,
        () => setRedrafting(true),
      )
      // Captured before the patch lands, so the bar can show what this turn
      // moved rather than the whole distance from zero.
      shownAffinity.current = affinityOf(state.relationship)
      const next = applyEngineResponse(state, result)
      next.messages = [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'narrator',
          content: result.story,
          createdAt: new Date().toISOString(),
          storyTime: next.narrative?.time,
        },
      ]
      await persist({
        ...base,
        title: next.narrative?.title || base.title,
        state: next,
        pending: undefined,
        draft: '',
      })
      setInput('')
      try {
        localStorage.removeItem(`draft:${base.id}`)
      } catch {}
      setTimeout(
        () =>
          feed.current?.lastElementChild?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
        80,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      running.current = false
      controller.current = null
      setStreaming('')
      setRedrafting(false)
      setLoading(false)
    }
  }
  async function start() {
    if (!draft.playerName.trim() || running.current || unsaved) return
    // The first scene is written by the model, so a key is required before the
    // story exists at all. The intent is remembered and resumed after saving.
    if (!settings.apiKey.trim() && !TRIAL_AVAILABLE) {
      startAfterConnect.current = true
      setError('')
      openSettings()
      return
    }
    setError('')
    running.current = true
    setLoading(true)
    const state = makeState({
      ...draft,
      playerName: draft.playerName.trim(),
      maleName: draft.maleName.trim(),
    })
    let fresh: Book = {
      id: state.config.id,
      title: '未题',
      state,
      updatedAt: new Date().toISOString(),
      revision: 0,
      archived: false,
      draft: '',
    }
    fresh.pending = { input: '', opening: true }
    try {
      const saved = await persist(fresh)
      location.hash = '/reader'
      setScreen('reader')
      setInput('')
      navigator.storage?.persist?.().catch(() => {})
      if (saved.pending) await generate(saved, true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      running.current = false
      setLoading(false)
    }
  }
  function openSettings() {
    setSettingsReturn(screen)
    setConnection(settings)
    go('settings')
  }
  async function send(e?: FormEvent) {
    e?.preventDefault()
    if (running.current || unsaved || !active.current) return
    // An empty Enter means "nothing here needs me, go on". Only offered once
    // the story has started, since the first scene has nothing to continue.
    const text = input.trim() || CONTINUE_TURN
    if (text === CONTINUE_TURN && !active.current.state.messages.length) return
    if (!settings.apiKey.trim() && !TRIAL_AVAILABLE) {
      openSettings()
      return
    }
    if (!navigator.onLine) {
      setError('当前没有网络。你的文字已保留，联网后再发送。')
      return
    }
    running.current = true
    setLoading(true)
    try {
      const saved = await persist({
        ...active.current,
        draft: input,
        pending: { input: text, opening: false },
      })
      await generate(saved, true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      running.current = false
      setLoading(false)
    }
  }
  function changeInput(value: string) {
    setInput(value)
    if (active.current) {
      try {
        localStorage.setItem(`draft:${active.current.id}`, value)
      } catch {
        setError('未发送的文字无法暂存，请不要关闭此页。')
      }
    }
  }
  async function saveSettings() {
    if (
      !TRIAL_AVAILABLE &&
      (!connection.apiKey.trim() || !connection.model.trim())
    ) {
      setError('请填写密钥和模型标识。')
      return
    }
    if (TRIAL_AVAILABLE && !connection.trialCode?.trim()) {
      setError('请填写邀请码。')
      return
    }
    try {
      const next = {
        apiKey: connection.apiKey.trim(),
        model: connection.model.trim(),
        reasoning: connection.reasoning ?? 'keep',
        strictStyle: Boolean(connection.strictStyle),
        trialCode: connection.trialCode?.trim() ?? '',
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      setSettings(next)
      if (startAfterConnect.current) {
        startAfterConnect.current = false
        go('name')
        queueMicrotask(() => void start())
        return
      }
      // Arrived here because the link needed a code, not from inside a story.
      if (!settings.trialCode?.trim() && next.trialCode) {
        go('home')
        return
      }
      go(settingsReturn === 'settings' ? 'home' : settingsReturn)
    } catch {
      setError('设置未能保存，请检查浏览器存储权限。')
    }
  }
  async function retry() {
    if (unsaved) {
      try {
        const saved = await persist(unsaved)
        if (!saved.pending) {
          setInput('')
          try {
            localStorage.removeItem(`draft:${saved.id}`)
          } catch {}
        }
        location.hash = '/reader'
        setScreen('reader')
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }
    if (active.current?.pending) {
      if (!settings.apiKey.trim() && !TRIAL_AVAILABLE) {
        openSettings()
        return
      }
      await generate(active.current)
    }
  }
  const status = (
    <>
      {!online && (
        <div className="notice" role="status">
          当前离线，已保存的故事仍可阅读。
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          {(unsaved || book?.pending) && (
            <button onClick={retry} disabled={loading}>
              {unsaved ? '重试保存' : '重试'}
            </button>
          )}
          {unsaved && (
            <button
              onClick={() =>
                downloadFile(
                  '秩序之外-未保存内容.json',
                  serializeBackup([unsaved]),
                )
              }
            >
              导出未保存内容
            </button>
          )}
          {!unsaved && book?.pending && (
            <button onClick={openSettings} disabled={loading}>
              连接设置
            </button>
          )}
        </div>
      )}
      {loading && book?.pending && (
        <div className="notice generation-status" role="status">
          正在落笔…
          <button onClick={() => controller.current?.abort()}>停止</button>
        </div>
      )}
    </>
  )
  if (!ready)
    return (
      <Scene screen="home">
        <div className="loading-page" role="status">
          正在翻开故事…
        </div>
      </Scene>
    )
  if (screen === 'home')
    return (
      <Scene screen="home">
        <div className="cover-title">
          <img className="halo-outer" src="/figma/6-2-img1.svg" alt="" />
          <img className="halo-inner" src="/figma/6-2-img2.svg" alt="" />
          <h1>
            秩序之外<span>。</span>
          </h1>
        </div>
        <button
          className="cover-cta"
          onClick={() => go(book ? 'reader' : 'world')}
        >
          <img src="/figma/6-2-img3.svg" alt="" />
          <span>与我一起堕入梦境吧，公主</span>
        </button>
        {status}
      </Scene>
    )
  if (screen === 'world' || screen === 'trope' || screen === 'person') {
    const content = screenText[screen],
      index = steps.indexOf(screen),
      options =
        screen === 'world'
          ? backgrounds
          : screen === 'trope'
            ? tropes
            : archetypes
    const selected =
      screen === 'world'
        ? draft.background
        : screen === 'trope'
          ? draft.trope
          : draft.archetype
    return (
      <Scene screen={screen}>
        <header className="creation-heading">
          <Back onClick={() => go(index ? steps[index - 1] : 'home')} />
          <span className="eyebrow">{content.label}</span>
          <h1>{content.title}</h1>
        </header>
        <section className="choices" aria-label={content.title}>
          {options.map((x) => (
            <button
              className={`choice ${selected === x.id ? 'selected' : ''}`}
              aria-pressed={selected === x.id}
              key={x.id}
              onClick={() =>
                setDraft({
                  ...draft,
                  [screen === 'world'
                    ? 'background'
                    : screen === 'trope'
                      ? 'trope'
                      : 'archetype']: x.id,
                })
              }
            >
              <img src={`/figma/6-${screenNumber[screen]}-img10.svg`} alt="" />
              <b>{x.title}</b>
              <span>{x.subtitle}</span>
            </button>
          ))}
        </section>
        {screen === 'person' && (
          <section className="tone-control">
            <label htmlFor="story-tone">甜虐调节器</label>
            <input
              id="story-tone"
              type="range"
              min="0"
              max="100"
              step="1"
              value={draft.tone}
              onChange={(event) =>
                setDraft({ ...draft, tone: Number(event.target.value) })
              }
              aria-valuetext={
                draft.tone === 0
                  ? '白头偕老'
                  : draft.tone === 100
                    ? '生离死别'
                    : `甜 ${100 - draft.tone}，虐 ${draft.tone}`
              }
            />
            <div className="tone-ends">
              <span>白头偕老</span>
              <span>生离死别</span>
            </div>
            <label className="intimacy-label" id="story-intimacy">
              亲密尺度
            </label>
            <div
              className="intimacy-row"
              role="radiogroup"
              aria-labelledby="story-intimacy"
            >
              {intimacyOptions.map((option) => (
                <button
                  key={option.id}
                  role="radio"
                  aria-checked={draft.intimacyLevel === option.id}
                  className={
                    draft.intimacyLevel === option.id
                      ? 'intimacy-option selected'
                      : 'intimacy-option'
                  }
                  onClick={() =>
                    setDraft({ ...draft, intimacyLevel: option.id })
                  }
                >
                  <b>{option.label}</b>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="next-area" aria-hidden="true" />
        <button
          className="primary selection-next"
          onClick={() => go(steps[index + 1])}
        >
          下一步 →
        </button>
        {status}
      </Scene>
    )
  }
  if (screen === 'name')
    return (
      <Scene screen="name">
        <header className="name-heading">
          <Back onClick={() => go('person')} disabled={loading} />
          <span className="eyebrow">落款</span>
          <h1>怎么称呼你？</h1>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            start()
          }}
        >
          <label className="name-field">
            你的名字
            <input
              value={draft.playerName}
              onChange={(e) =>
                setDraft({ ...draft, playerName: e.target.value })
              }
              placeholder="输入..."
              maxLength={20}
              autoComplete="off"
              required
            />
          </label>
          <label className="name-field">
            他的名字
            <input
              value={draft.maleName}
              onChange={(e) => setDraft({ ...draft, maleName: e.target.value })}
              placeholder="留空则由故事决定"
              maxLength={20}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="name-dice"
            onClick={() =>
              setDraft({
                ...draft,
                maleName: randomMaleName(draft.background, draft.playerName),
              })
            }
          >
            换一个名字
          </button>
          <Glow
            assetScreen={6}
            className="name-submit"
            type="submit"
            disabled={loading}
          >
            我的恋人，请与我相爱
          </Glow>
        </form>
        {status}
      </Scene>
    )
  if (screen === 'settings') {
    // Reached before anything else when a shared link still needs its code:
    // there is nothing behind this page yet, so no way back is offered.
    const gated = TRIAL_AVAILABLE && !settings.trialCode?.trim()
    return (
      <Scene screen="settings">
        {!gated && (
          <Back
            onClick={() =>
              go(settingsReturn === 'reader' && !book ? 'home' : settingsReturn)
            }
          />
        )}
        <header className="chapter-heading">
          <span>{gated ? '叩 门' : '书 后 的 几 页'}</span>
          <h1>{gated ? '请出示邀请码' : '让故事继续'}</h1>
        </header>
        <p className="settings-intro">
          {gated
            ? '这本书是私下传阅的。填入分享链接的人给你的那串字，之后就不用再填了。'
            : TRIAL_AVAILABLE
              ? '填一次邀请码就好，之后一直有效。已经写下的故事离线也能读。'
              : '已经写下的故事离线也能读；新的故事需要先连接模型，第一幕由它来写。'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveSettings()
          }}
        >
          <div className="connection-fields">
            {TRIAL_AVAILABLE && (
              <label>
                邀请码
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={connection.trialCode ?? ''}
                  onChange={(e) =>
                    setConnection({ ...connection, trialCode: e.target.value })
                  }
                  placeholder="分享链接给你的人会告诉你"
                />
              </label>
            )}
            {/* Hidden while the link runs on the host's key: a guest has no
                use for a key or a model id, and showing them only invites
                questions about which model to pick. */}
            {!TRIAL_AVAILABLE && (
              <>
                <label>
                  OpenRouter API Key
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={connection.apiKey}
                    onChange={(e) =>
                      setConnection({ ...connection, apiKey: e.target.value })
                    }
                    placeholder="填写你的密钥"
                    required
                  />
                </label>
                <label>
                  模型标识
                  <input
                    value={connection.model}
                    onChange={(e) =>
                      setConnection({ ...connection, model: e.target.value })
                    }
                    placeholder="openrouter/auto"
                    required
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </>
            )}
          </div>
          {/* Not shown at the door: a first-time visitor has nothing to
              tune yet, and three choices there turn an invitation into a form. */}
          {!gated && (
            <>
              <label className="intimacy-label" id="model-reasoning">
                思考深度
              </label>
              <div
                className="intimacy-row"
                role="radiogroup"
                aria-labelledby="model-reasoning"
              >
                {reasoningModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={(connection.reasoning ?? 'keep') === mode.id}
                    className={
                      (connection.reasoning ?? 'keep') === mode.id
                        ? 'intimacy-option selected'
                        : 'intimacy-option'
                    }
                    onClick={() =>
                      setConnection({ ...connection, reasoning: mode.id })
                    }
                  >
                    <b>{mode.label}</b>
                    <span>{mode.hint}</span>
                  </button>
                ))}
              </div>
              <p className="key-note">
                推理型模型的思考会占掉大部分生成时间，也正是它写得好的原因。不支持这项设置的模型会沿用自身默认。
              </p>
              <label className="intimacy-label" id="style-strictness">
                文风把关
              </label>
              <div
                className="intimacy-row two"
                role="radiogroup"
                aria-labelledby="style-strictness"
              >
                {[
                  {
                    strict: false,
                    label: '流畅',
                    hint: '文风偏移记录下来，不为它多等一轮',
                  },
                  {
                    strict: true,
                    label: '严格',
                    hint: '任何文风偏移都重写一次，更慢',
                  },
                ].map((option) => (
                  <button
                    key={String(option.strict)}
                    type="button"
                    role="radio"
                    aria-checked={
                      Boolean(connection.strictStyle) === option.strict
                    }
                    className={
                      Boolean(connection.strictStyle) === option.strict
                        ? 'intimacy-option selected'
                        : 'intimacy-option'
                    }
                    onClick={() =>
                      setConnection({
                        ...connection,
                        strictStyle: option.strict,
                      })
                    }
                  >
                    <b>{option.label}</b>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {!gated && (
            <p className="key-note">
              与前文矛盾、重复上一轮、复述你的原话这几类问题两档都会拦，不受这项设置影响。
            </p>
          )}
          <p className="key-note">
            {TRIAL_AVAILABLE
              ? '填入邀请码就可以开始，不需要自己准备任何东西。'
              : '密钥保存在当前浏览器，请只在自己的设备上使用。模型服务由 OpenRouter 提供。'}
          </p>
          <Glow assetScreen={8} className="settings-submit" type="submit">
            {gated ? '推门进去' : '保存并返回'}
          </Glow>
        </form>
        {status}
      </Scene>
    )
  }
  if (!book)
    return (
      <Scene screen="reader">
        <Back onClick={() => go('home')} />
        <p className="empty">还没有翻开的故事。</p>
        {status}
      </Scene>
    )
  return (
    <Scene
      screen="reader"
      image={readerBackground(book.state.config.background)}
    >
      <nav className="reader-nav">
        <Back onClick={() => go('home')} disabled={loading} />
        <button
          className="restart"
          disabled={loading || Boolean(unsaved)}
          onClick={() => {
            setDraft({ ...initialDraft })
            setInput('')
            go('world')
          }}
        >
          重新开始
        </button>
      </nav>
      <header className="chapter-heading">
        <span>{timeLabel(book.state.narrative?.time)}</span>
        <h1>{readingTitle(book.state)}</h1>
      </header>
      {Boolean(book.state.messages.length) &&
        (() => {
          const value = affinityOf(book.state.relationship)
          const shift = affinityShift(shownAffinity.current, value)
          return (
            <div
              className="affinity"
              role="group"
              aria-label={`他对你的在意：${affinityStage(value)}`}
            >
              <div className="affinity-track">
                <div className="affinity-fill" style={{ width: `${value}%` }} />
              </div>
              <div className="affinity-legend">
                <span>{affinityStage(value)}</span>
                {shift && (
                  <span className={shift.rising ? 'rise' : 'fall'}>
                    {shift.rising ? '↑' : '↓'}
                    {Math.abs(shift.delta)}
                  </span>
                )}
              </div>
            </div>
          )
        })()}
      {book.state.briefing && (
        <details className="briefing" open={book.state.messages.length <= 1}>
          <summary>前情</summary>
          <p>{book.state.briefing}</p>
        </details>
      )}
      <div className="story-feed" ref={feed}>
        {book.state.messages.map((m, i) => (
          <article
            key={m.id}
            id={`message-${i}`}
            className={m.role === 'player' ? 'player-message' : 'story-message'}
          >
            {m.storyTime &&
              i > 0 &&
              !sameTime(m.storyTime, book.state.messages[i - 1]?.storyTime) && (
                <h2 className="time-break">{timeLabel(m.storyTime)}</h2>
              )}
            {m.content
              .split('\n')
              .filter(Boolean)
              .map((p, j) => (
                <p key={j}>{p}</p>
              ))}
          </article>
        ))}
        {book.pending &&
          !book.pending.opening &&
          book.pending.input !== CONTINUE_TURN && (
            <article className="player-message pending">
              <p>{book.pending.input}</p>
            </article>
          )}
        {loading && !streaming && (
          <p className="writing" role="status">
            正在写
          </p>
        )}
        {streaming && (
          <article
            className={`story-message streaming ${redrafting ? 'redrafting' : ''}`}
          >
            {streaming
              .split('\n')
              .filter(Boolean)
              .map((p, j) => (
                <p key={j}>{p}</p>
              ))}
          </article>
        )}
      </div>
      {status}
      <form className={`composer ${input ? 'has-input' : ''}`} onSubmit={send}>
        <img className="composer-glow" src="/figma/6-7-img2.svg" alt="" />
        <img className="composer-inner" src="/figma/6-7-img3.svg" alt="" />
        {!input && (
          <div className="composer-hint">
            <span>回</span>复他，或者做你想做的事......
          </div>
        )}
        {!input && Boolean(book.state.messages.length) && (
          <p className="composer-continue">直接回车，故事往下走</p>
        )}
        <textarea
          ref={form}
          value={input}
          onChange={(e) => changeInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              send()
            }
          }}
          maxLength={4000}
          rows={1}
          disabled={loading || Boolean(book.pending) || Boolean(unsaved)}
          aria-label="回复他，或者做你想做的事"
          placeholder="回复他，或者做你想做的事......"
          enterKeyHint="send"
        />
        {input && !book.pending && (
          <button
            className="send"
            disabled={loading || Boolean(unsaved)}
            type="submit"
          >
            发送
          </button>
        )}
        {book.pending && !loading && !unsaved && (
          <button type="button" className="resume-pending" onClick={retry}>
            继续刚才的续写
          </button>
        )}
      </form>
    </Scene>
  )
}
export default App
