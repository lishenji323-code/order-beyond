import { storyWorlds } from '../src/engine/worlds'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backgrounds, tropes, traitCatalog } from '../src/data/catalog'
import { generateIdentity } from '../src/engine/identity'
import { generateAppearance } from '../src/engine/appearance'
import { buildOpeningPrompt } from '../src/engine/prompt'
import type { StoryState } from '../src/types/story'
test('30 distinct traits carry distinct behavior instructions', () => {
  assert.equal(traitCatalog.length, 30)
  assert.equal(new Set(traitCatalog.map((t) => t.title)).size, 30)
  assert.equal(new Set(traitCatalog.map((t) => t.behavior)).size, 30)
})
test('every world and relationship produces a stable, appropriate identity and opening', () => {
  for (const bg of backgrounds)
    for (const trope of tropes) {
      const identity = generateIdentity(bg.id, trope.id, '沈远舟')
      assert.notEqual(identity.maleName, '沈远舟')
      assert.ok(
        storyWorlds[bg.id].scenarios.some(
          (s) => s.clue === identity.openingClue,
        ),
      )
      const appearance = generateAppearance('restrained_power', bg.id)
      const state = {
        config: {
          background: bg.id,
          trope: trope.id,
          openingClue: identity.openingClue,
          maleLead: {
            name: identity.maleName,
            archetype: 'restrained_power',
            traits: ['体贴细致'],
            appearance,
          },
          player: { name: '林夏', background: identity.playerBackground },
        },
        plot: { chapter: 1, scene: 0, turnsSinceRelationshipProgress: 0 },
        relationship: {},
        secret: {},
        threads: [],
        memories: [],
        messages: [],
      } as unknown as StoryState
      const original = JSON.stringify(state)
      const prompt = buildOpeningPrompt(state)
      assert.equal(JSON.stringify(state), original)
      assert.ok(prompt.includes('第一幕不介绍长相'))
      assert.ok(prompt.includes('记得具体习惯'))
      assert.ok(prompt.includes(identity.openingClue))
      assert.ok(prompt.includes(appearance.face))
      assert.match(prompt, /场景种子是方向不是脚本/)
    }
})
test('names vary across new stories', () => {
  const names = new Set(
    Array.from(
      { length: 40 },
      () => generateIdentity('modern_city', 'reunion', '林夏').maleName,
    ),
  )
  assert.ok(names.size > 1)
})
