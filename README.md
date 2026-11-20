# Order Beyond · 秩序之外

An interactive romance novel that runs in the browser. You pick a world, a relationship line and a male lead, then write the story one exchange at a time with a language model.

The hard part was never the writing. It was getting a generative model to produce usable prose turn after turn — and to fail gracefully when it doesn't.

<p align="center">
  <img src="docs/screenshots/01-home.png" width="260" alt="Cover screen" />
  <img src="docs/screenshots/06-reader-briefing.png" width="260" alt="Reader with the opening briefing" />
  <img src="docs/screenshots/07-reader-affinity.png" width="260" alt="Reader after a few turns" />
</p>

---

## What it does

**Pick a setting.** Ten worlds, eleven relationship lines, ten male-lead archetypes. Each of those is a pool rather than a fixed script: the opening place, the opening shape, her role, his role and the backstory are all drawn independently, so two stories on the same line do not start the same way.

<p align="center">
  <img src="docs/screenshots/02-world.png" width="200" alt="World selection" />
  <img src="docs/screenshots/03-trope.png" width="200" alt="Relationship line selection" />
  <img src="docs/screenshots/04-person.png" width="200" alt="Archetype selection" />
  <img src="docs/screenshots/05-name.png" width="200" alt="Naming screen" />
</p>

**Read a briefing first.** The opening turn also returns an 80–140 character recap in second person: who you are, who he is, what already happened between you. It is written once and never overwritten.

**Watch one number.** The engine tracks eight relationship dials; the reader sees one bar with a named stage (陌路 → 留意 → 在意 → 动心 → 难舍 → 认定 → 非你不可) and how far this turn moved it. Jealousy and tension are deliberately excluded — they rise in the scenes most worth playing, and showing them as a loss would teach the reader to avoid those scenes.

**Press Enter on an empty box** when nothing needs you, and the story moves on without leaving a row of "继续" in the transcript.

---

## The interesting part: making generated prose hold up

### Quality defined by measurement, not adjectives

Saying a passage "feels like AI" gives a model nothing to act on. So the style rules were derived from a corpus of published Chinese romance — roughly 73,000 lines of dialogue and 163,000 paragraphs:

| Metric | Corpus | Early model output |
| --- | --- | --- |
| Median dialogue line | 10 characters | 30–45 |
| Lines of 5 characters or fewer | 25% | ~0 |
| Median paragraph | 29 characters | 60–100 |
| Similes per 10,000 characters | 2.8 | 45 |
| Narration sentences that are body choreography | **4.8%** | **53%** |

The last row turned out to be the real difference. Sentence length and clause density already matched; what didn't was that the corpus spends its narration telling you what happened, while the model spent it moving bodies around — *he turned, he leaned on the pillar, he straightened, his gaze stopped on your shoulder*. Four sentences, no information.

### A three-tier failure policy

Every generated turn runs through sixteen checks before it reaches the page. They are not equal:

| Tier | Examples | If the rewrite also fails |
| --- | --- | --- |
| **Blocking** | Repeats the previous turn; puts him back in a room he left | Refuse the turn |
| **Style** | Breaks second person; speech without quotation marks; outlier paragraph | Commit it, log it |
| **Advisory** | Missing Cantonese gloss; three turns of identical length | Never triggers a rewrite at all |

The line is drawn at one question: *does this make the story impossible to follow?* A contradiction does. One mannered simile does not — and a slightly mannered paragraph beats showing the reader an error.

That policy came out of a measurement. An earlier version refused anything that failed, and in one session fifteen rewrites ended in fifteen errors. Running the then-current checks against 24 real turns showed **a 50% false-positive rate**, traceable to three over-broad patterns. After narrowing: 0 false positives on the same 24 turns, with all 8 true-positive samples still caught.

### Deterministic problems get repaired, not rewritten

Chinese models reach for the em dash constantly and keep doing it after being told not to. Spending a round trip on punctuation is waste, so the layout pass rewrites it. The same pass puts each spoken line on its own row, keeps a bracketed gloss attached to the line it explains, and never leaves a row holding nothing but a full stop.

### Recovering instead of discarding

A turn the reader watched being written should not vanish because one field was malformed. The parser repairs unescaped newlines and stray straight quotes inside JSON strings, drops trailing commas, defaults omitted booleans, discards an out-of-pattern time label, and clamps a clock that runs backwards. Truncation is decided by whether the body can be parsed — not by counting braces, which a single stray quote throws off — and escalates the token budget once before salvaging whatever prose arrived.

---

## Architecture

Static front end, no backend required. Stories live in the reader's own IndexedDB, so each save is private by construction and nothing is stored server-side.

```
src/engine/
  prompt.ts      assembles the system rules, world, archetype, scene state, JSON contract
  style.ts       the measured style rules + the layout pass + style checks
  turns.ts       input classification, repetition, continuity, echo checks
  generation.ts  the three-tier policy and the single bounded rewrite
  validation.ts  zod schemas + the salvage layers
  state.ts       applies a turn to the save; merges scene bookkeeping
  affinity.ts    folds eight dials into the bar the reader sees
  worlds.ts      worlds, scenarios, place / role / opening-shape pools
  trial.ts       quota logic for the shared-key proxy (pure, unit-tested)
functions/api/   Cloudflare Pages Function: holds the host key, meters the trial
```

**Stack**: TypeScript · React 19 · Vite · Zod · IndexedDB · Cloudflare Pages + Functions + KV · OpenRouter (SSE streaming) · PWA (service worker + manifest).

**Tests**: 81 cases on the node test runner, plus Playwright flows. Most of them started as a real failure in a play session and were pinned so it could not come back.

---

## Running it

```sh
npm ci
npm run dev        # http://localhost:5173
```

Open the settings page and add an OpenRouter key and a model id. Without one the app cannot write the first scene.

```sh
npm test           # engine tests
npm run test:ui    # browser flow against a mocked model
npm run build      # typecheck, bundle, generate the offline shell
```

### Deploying

Cloudflare Pages: build command `npm run build`, output directory `dist`.

To run it on your own key instead of asking each visitor for theirs, set `VITE_TRIAL=1`, bind a KV namespace as `TRIAL`, and set `OPENROUTER_KEY`, `COOKIE_SECRET`, `TRIAL_MODELS` and `TRIAL_CODE` as environment variables. The key stays server-side; the client only ever sees `/api/story`. Quotas live at the top of `src/engine/trial.ts`, but the real ceiling is the spend limit on the key itself.

---

## Honest limits

- **No scale.** This was built for a handful of friends. There is no usage data, no A/B testing, no concurrency story. Changes were validated against regression cases and qualitative reading, not metrics.
- **Stories are device-local.** Clearing browser data or switching devices loses them. Cross-device sync would need accounts and a database.
- **The prompt ships in the bundle.** Anyone can read the rules in the browser's dev tools. Hiding them would mean moving generation server-side.
- **Semantic problems are still out of reach.** The checks catch repetition, contradiction and measurable style drift. They cannot tell whether a motive is believable or a relationship beat has been earned.
