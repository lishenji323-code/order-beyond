# 秩序之外 — Codex Handoff

## Project identity

- Product name: **秩序之外**
- English repo name: `order-beyond`
- Product type: mobile-first AI interactive romance fiction / companionship narrative PWA.
- Core experience: the player freely types replies like messaging in WeChat; the app is responsible for maintaining novel-like pacing, male-lead autonomy, relationship development, memory, and story continuity.
- This is **not** a chatbot-builder, prompt marketplace, or fixed-choice visual novel.

## Product north star

The player should feel that she is living inside a serialized romance novel rather than asking an AI to role-play.

Key moments to optimize for:

1. “He remembered that.”
2. “I didn’t ask him to come; he came on his own.”
3. “I thought he didn’t care.”
4. “That earlier detail was actually setup.”
5. “How did the situation suddenly become this?”
6. “That line is exactly something *he* would say.”

## Scope for MVP

### In scope

- Story/world background selection.
- Romance storyline/trope selection.
- Male-lead archetype + 2–3 modifiers + optional custom sentence.
- Male appearance generated automatically from personality/background; player does **not** configure looks.
- Player name and basic player background.
- Free-text interaction only. No inspiration/suggested-response buttons.
- Novel narration + dialogue.
- Hidden relationship state.
- Secret male-lead state and autonomous plans.
- Long-term structured memory.
- Real elapsed-time awareness.
- Local autosave.
- Local story import/export.
- OpenRouter BYOK connection.
- PWA / Add to Home Screen.
- Mobile-first Visual Novel Lite interface.
- Mock mode usable without API key for development.

### Explicitly out of scope for Week 1

- Community / marketplace.
- User accounts.
- Cloud save.
- Payments.
- Voice.
- Real-time AI portrait generation.
- Multi-male-lead routes.
- Public affection meters.
- Choice buttons / reply suggestions.

## Core narrative principles

### 1. Romance is the main plot

Female-lead career, school, exams, business, politics, family, survival, etc. may exist, but they primarily serve romance by creating proximity, pressure, misunderstanding, choices, separation, dependence, jealousy, or changes in identity/commitment.

If an external subplot can continue for several scenes without changing the relationship, compress it.

Do not turn the product into a female-lead career-growth novel.

### 2. Distinguish plot progress from relationship progress

Two separate concepts must exist:

- `plotProgress`: the world changes — e.g. a business battle advances, a succession struggle changes, a team wins a match, a family dispute escalates.
- `relationshipProgress`: the male lead and player relationship changes in trust, distance, attraction, attachment, commitment, jealousy, dependence, identity, boundaries, or mutual understanding.

A world event only counts as romance progress if it causes a relationship change.

### 3. Feelings may be slow; story cannot be static

Do not equate progression with confession/kissing/official dating.

Progress can be:
- new information;
- changed constraint;
- changed relationship behavior;
- changed emotional stance;
- changed identity/status;
- an irreversible event.

### 4. Player controls the heroine; system controls continuation

The player decides what she says/does/accepts/refuses.
The narrative engine decides what the male lead and world do next.

The player should never need to type “推进剧情”.

### 5. Male lead is an event generator, not a response generator

Each turn, consider whether he initiates something:
- message/call/show up;
- change plan;
- invite/refuse;
- hide information;
- contact a third person;
- solve a practical problem;
- make a mistake;
- leave;
- create a consequence.

He can have plans and information unknown to the player.

## Pacing / momentum engine

### Relationship stagnation counter

Track `turnsSinceRelationshipProgress`.

If ~10 effective player turns pass without a meaningful relationship change, the next turn must force an important chapter beat.

This replaces the old “3 active hours” hard limit.

### Force meaningful events, not random accidents

Forced progression priority:

1. resolve/escalate an existing open thread;
2. execute the male lead’s already-established private plan;
3. trigger an established supporting character;
4. trigger a world/background event already seeded;
5. only then create a new conflict seed.

Avoid arbitrary car crashes, illnesses, kidnappings, etc. just because pacing is slow.

### Suggested pacing layers

- 2–4 player turns: micro beat / small change.
- 6–10 turns: scene direction should shift.
- around 10 turns without relationship progress: forced major beat.
- one relationship phase should not remain unchanged for too many full scenes; escalate or setback.

## Thread system

Maintain `openThreads` such as:

- male lead will leave the city next week;
- player promised to tell him before business travel;
- a supporting male character has invited player to an event;
- male lead knows player is hiding something;
- family plans a marriage arrangement;
- press has an unpublished photo.

Threads should have:
- id;
- content;
- who knows;
- urgency;
- source;
- optional deadline;
- relationship relevance.

## Relationship state

Numerical values remain hidden from player.

Suggested internal dimensions:
- attraction;
- curiosity;
- trust;
- attachment;
- jealousy;
- distance;
- tension;
- commitment.

Long-arc attachment can generally deepen, while trust/distance/tension may worsen. It should be possible for him to love her more while the relationship deteriorates.

## Secret state

Examples:

- suspectsPlayerIsLying
- waitingForExplanation
- planningToLeave
- hasNotToldPlayer
- jealousOf
- currentMask
- privateIntention
- avoidingContactOnPurpose
- intendsToProtectPlayerWithoutTellingHer

Do not expose raw state in UI.

## Memory model

Four long-term semantic classes:

1. Fact Memory — preferences/facts.
2. Relationship Memory — shared milestones.
3. Emotional Memory — unresolved emotional residues.
4. Promise Memory — explicit promises/commitments.

Also maintain:
- recent conversation window;
- rolling scene/chapter summary;
- current unresolved threads.

Write long-term memory only for meaningful facts, promises, firsts, conflicts, secrets, future plans, and relationship changes.

## Offline / elapsed-time behavior

Store `lastInteractionAt`.

On return, compute absence duration and inject it into narrative context.

Do not always mention absence mechanically.
Character personality + current relationship determine reaction.

For MVP, when the app reopens after >24h, show a social-app-like unread male-lead message if appropriate. Reliable push while the PWA is fully closed requires backend/Web Push and is not required for Week 1.

## Writing style / anti-AI rules

The user supplied a corpus of romance novels across modern, campus, workplace/business, Hong Kong entertainment/high-society, historical/political, fantasy, apocalypse, etc. The repo should contain **derived style rules only**, not redistributed source novels.

### House style

- Natural Chinese, mobile-readable prose.
- Mix dialogue, actions, environment, and interiority.
- Avoid too many consecutive one-line short sentences. AI often over-fragments prose; specifically prevent this.
- Use varied sentence length and complete paragraphs.
- Use ordinary concrete life vocabulary where appropriate: transport, food, messages, clothing, rooms, work details, weather, objects.
- Emotion is shown through behavior and consequence rather than constantly named.
- Dialogue can be indirect, interrupted, evasive, sarcastic, silent, or wrong.
- Male lead should not provide perfect therapy-style responses.
- Avoid “AI motivational/reassurance voice”.
- Do not over-explain what the reader should feel.
- Avoid repetitive stock phrases such as “空气仿佛凝固”, “眼底闪过复杂情绪”, “心底最柔软的地方”, “时间仿佛静止”, etc.
- Avoid a poetic aphorism at the end of every turn.
- Avoid repetitive eye-contact/heartbeat/breath-distance beats.

### Modern register

Specific, conversational, concrete, slightly humorous where character-appropriate. Use real-life settings and objects to carry emotion.

### Historical register

More restrained, status-conscious, power-aware. Politics, family, marriage, rank, etiquette, travel, information asymmetry, and physical danger should materially affect romance.

### Fantasy/apocalypse register

World rules must actively interfere with romance rather than serving as decorative skin.

## Male lead generation

Player selects:
- one archetype;
- up to 3 modifiers;
- optional custom sentence.

Appearance is generated automatically and should be coherent with personality/world.

Potential archetypes:
- 温柔会逗人的年上
- 高冷寡言型
- 克制上位者
- 自由浪荡型
- 野性危险型
- 明亮不靠谱的少年型
- 外甜内黑型
- 风流病弱/权谋型
- 清冷原则型
- 沉默行动派

Appearance generation should include:
- build;
- hair;
- skin tone;
- facial vibe;
- clothing;
- 1–2 signature life details (scar, ring, ear piercing, watch, glasses, work-worn hands, habitual scent, etc.).

Do not output a generic stack of height + nose + lips.

## Romance storyline / trope set

Current intended 10:

1. 先婚后爱
2. 恨海情天
3. 破镜重圆
4. 浪子回头
5. 久别重逢
6. 青梅竹马 / 年少旧识
7. 地下恋
8. 契约恋爱 / 假情侣
9. 宿敌 / 竞争关系
10. 暗恋成真

Each trope should define:
- initial relationship;
- core contradiction;
- 8–12 beat map;
- escalation triggers;
- supporting-character roles;
- HE / bittersweet / BE conditions.

Specific scenes must remain dynamic and player-dependent.

## World/background set

Current intended 10:

1. 现代都市
2. 职场 / 商战
3. 娱乐圈
4. 港圈 / 香港上流与娱乐产业
5. 校园青春
6. 电竞 / 竞技
7. 豪门世家
8. 古代权谋
9. 架空奇幻
10. 末日生存

Each background needs:
- EventPool
- ConflictPool
- SupportingCastPool
- ForcedContactMechanisms
- language register
- high-value scene locations
- plot-progress rules

### 港圈 special rule

Narration remains natural Simplified Chinese.
The male lead may naturally switch into Cantonese during intimacy, jokes, irritation, family/social scenes, or emotionally revealing moments.
Do not make every line Cantonese.
Do not mechanically add Cantonese particles to Mandarin.
If Cantonese is used, keep it fluent and character-motivated.

Possible Hong Kong story resources:
- family business;
- film/TV/music industry;
- luxury brands/events;
- press/paparazzi;
- public relationship risk;
- old-money family pressure;
- Central / Mid-Levels / Victoria Harbour / hotel / studio / gala / club / family residence scenes.

## Opening generator

Opening must feel immersive and immediately playable.

Do not start with encyclopedia-style world exposition.

Recommended structure:

1. a concrete present moment;
2. ordinary routine under slight pressure;
3. disruption within first 150–300 Chinese characters;
4. male lead trace or collision;
5. at least two unanswered questions/open threads;
6. stop at a point where the player has something meaningful to respond to.

Use sensory and situational detail, not generic “命运齿轮转动” language.

## Supporting male characters

Create 1–3 potential supporting male characters per story, but introduce them only when useful.

Types:
- stable alternative;
- past connection;
- power/work connection.

They should be complete characters, not jealousy props that automatically fall in love with player.

## Jealousy behavior must match archetype

- restrained: asks one specific question, changes behavior, remembers details;
- free-spirited: sarcasm, sudden appearance, tests relationship boundaries;
- quiet: stays longer / cancels departure / subtle practical action;
- wild: direct interrogation or visible irritation;
- sweet-dark: becomes more gentle while privately tracking the rival.

Jealousy reveals the player’s importance. It should not default to aggression.

## Conflict model

Each argument has:

Surface Issue → Actual Fear → Character Defense → Consequence

Arguments must leave residue. Do not auto-resolve with one explanation + hug.

Story generation should seed:
- 2 core trope conflicts;
- 2 personality conflicts;
- 2–4 world conflicts.

## Current code architecture

Important files:

- `src/types/story.ts` — story/state types.
- `src/data/catalog.ts` — backgrounds, storylines/archetypes/catalog.
- `src/engine/appearance.ts` — male appearance generation.
- `src/engine/state.ts` — local story state and progress logic.
- `src/engine/prompt.ts` — system/context prompt composition.
- `src/engine/openrouter.ts` — OpenRouter client.
- `src/engine/mock.ts` — no-key development mode.
- `src/App.tsx` — current single-app UI.
- `src/styles.css` — mobile-first styling.
- `public/manifest.webmanifest`, `public/sw.js`, `src/pwa.ts` — PWA skeleton.
- `SPEC.md` — narrative/product specification.
- `README.md` — run instructions.

## Current validation status

- Git repo exists with commits.
- TypeScript source was checked during initial creation.
- Full dependency installation/build was not conclusively completed in the original environment because install timed out.
- First task in a normal dev environment: `npm install && npm run build`, then fix any dependency/build/runtime issues.

## Security model

MVP uses user-owned OpenRouter API key in browser/local storage.

Never add an app-owned shared API key to frontend source.
If the product later funds model usage, introduce a backend/serverless proxy and secret env vars.

## Source corpus note

The product spec was informed by user-provided excerpts/full texts of multiple romance novels (modern workplace, campus, historical, fantasy, apocalypse, Hong Kong/entertainment, etc.). Do **not** reproduce or commit those texts. Use `SPEC.md` and this handoff as the derived design source. If deeper re-analysis is needed, ask the user to attach the source corpus in the Codex workspace.

## Product decisions that should NOT be reversed without asking user

- No suggested reply buttons.
- Romance remains dominant over heroine career-growth.
- Male appearance is generated, not selected by player.
- 10-turn relationship stagnation should trigger meaningful progression.
- Community is post-MVP.
- No account system in MVP.
- Male lead must have autonomy and secret state.
- No visible affection score.
- Hong Kong storyline/background should support natural Cantonese male-lead dialogue.
- The tone should feel like a published romance novel, not an AI assistant.
