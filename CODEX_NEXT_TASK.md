# Codex Next Task — 秩序之外

Please continue this repo as the primary engineer. Do not redesign the product from scratch.

## Immediate goal

Turn the current prototype into a stable, playable vertical slice covering:

**Create story → generate male lead → immersive opening → free-text interaction → OpenRouter reply → hidden state update → memory → relationship pacing → local save → reopen/continue.**

## Execute in this order

1. Run `npm install` and `npm run build`.
2. Fix all build/runtime issues without changing core product decisions in `CODEX_HANDOFF.md` and `SPEC.md`.
3. Review the current UI and make the story-creation flow mobile-first and coherent.
4. Ensure appearance is generated automatically after archetype/background selection.
5. Implement/verify two distinct progress streams:
   - world/plot progress;
   - relationship progress.
6. Implement a robust relationship-stagnation counter. If ~10 effective player turns pass without relationship progress, force an important beat by prioritizing open threads.
7. Make model output structured JSON and validate it before committing state.
8. Implement memory extraction/update in the same turn if possible; avoid multiple expensive model calls for MVP.
9. Implement offline return behavior using `lastInteractionAt` and an unread-message presentation on reopen.
10. Build four high-quality seeded demo scenarios:
   - 职场/商战 × 先婚后爱 × 克制上位者
   - 现代都市 × 浪子回头 × 自由浪荡型
   - 古代权谋 × 恨海情天 × 清冷原则型
   - 港圈 × 地下恋 or 久别重逢 × 克制/上位者男主（自然粤语）
11. For each scenario, write a strong immersive opening and an initial beat map/open-thread set.
12. Add a small developer/debug panel that is hidden in production but can inspect:
   - relationship state;
   - secret state;
   - open threads;
   - turns since relationship progress;
   - long-term memory;
   - current scene summary.
13. Add export/import for local story JSON.
14. Verify PWA installability.
15. Update README with exact local/dev/deploy instructions.

## Narrative QA requirements

During playtesting, reject outputs that show these patterns:

- too many one-line short sentences;
- generic AI poetic phrasing;
- therapy/reassurance voice;
- male lead always agrees/comforts;
- relationship stalls in the same emotional state;
- forced event has no setup;
- career/politics subplot expands without romance impact;
- every jealousy scene looks the same;
- narrator explicitly labels all emotions;
- male lead forgets promises or unresolved conflicts;
- Hong Kong dialogue is fake Cantonese created by sprinkling particles.

## Implementation preference

Prefer a clear deterministic app state machine around one LLM actor rather than introducing a multi-agent framework for MVP.

The application is the director; the model is the actor/writer.
