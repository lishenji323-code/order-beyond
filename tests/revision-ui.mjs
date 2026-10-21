import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
async function shot(name) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `test-results/${name}.png` })
}
async function next() {
  await page.getByRole('button', { name: '下一步' }).first().click()
}
async function savedBooks() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('order-beyond-library')
        r.onsuccess = () => {
          const q = r.result.transaction('books').objectStore('books').getAll()
          q.onsuccess = () => {
            resolve(q.result)
            r.result.close()
          }
          q.onerror = reject
        }
      }),
  )
}
await page.goto('http://localhost:5173')
await page.getByRole('button', { name: '与我一起堕入梦境吧，公主' }).waitFor()
await shot('revision-home')
assert.equal(
  await page
    .locator('.cover-title')
    .evaluate((e) => Math.round(e.getBoundingClientRect().top)),
  53,
)
await page.getByRole('button', { name: '与我一起堕入梦境吧，公主' }).click()
assert.equal(await page.locator('.choice').count(), 10)
assert.ok(
  (await page.locator('.choices').innerText()).includes(
    '当年的事，我们各有难处',
  ),
)
assert.ok(!(await page.locator('.choices').innerText()).includes('豪门世家'))
const second = page.locator('.choice').nth(1)
await second.hover()
await page.waitForTimeout(250)
assert.ok(
  (
    await second.locator('img').evaluate((e) => getComputedStyle(e).filter)
  ).includes('1.9'),
)
await second.click()
await page.mouse.move(380, 150)
await page.waitForTimeout(250)
assert.equal(await second.getAttribute('aria-pressed'), 'true')
assert.equal(
  await second.evaluate((e) => getComputedStyle(e).outlineStyle),
  'none',
)
assert.equal(
  await second.locator('img').evaluate((e) => getComputedStyle(e).opacity),
  '1',
)
assert.equal(
  await page
    .locator('.choice')
    .first()
    .locator('img')
    .evaluate((e) => getComputedStyle(e).opacity),
  '0.46',
)
await shot('revision-world')
await next()
assert.equal(await page.locator('.choice').count(), 12)
assert.ok(!(await page.locator('.choices').innerText()).includes('久别重逢'))
await page.getByRole('button', { name: '前世今生 我们又何止三生三世' }).click()
await shot('revision-trope')
await next()
assert.equal(await page.locator('.choice').count(), 10)
assert.equal(await page.locator('.chip,.traits').count(), 0)
await page
  .getByRole('button', { name: '忠犬行动派 太太，老婆，宝贝，家妻，我的爱人' })
  .click()
const slider = page.getByRole('slider', { name: '甜虐调节器' })
await slider.focus()
await slider.press('End')
assert.equal(await slider.inputValue(), '100')
assert.equal(await slider.getAttribute('aria-valuetext'), '生离死别')
await shot('revision-tone')
await next()
const name = page.getByLabel('你的名字')
await name.fill('林夏')
assert.equal(
  await name.evaluate((e) => getComputedStyle(e).outlineStyle),
  'none',
)
await shot('revision-name')
await page.getByRole('button', { name: '我的恋人，请与我相爱' }).click()
await page.locator('.story-message').waitFor()
await shot('revision-reader')
const first = (await savedBooks())[0]
assert.equal(first.state.config.tone, 100)
assert.equal(first.state.config.background, 'entertainment')
assert.equal(first.state.config.trope, 'past_life')
assert.equal(first.state.config.maleLead.archetype, 'loyal_devoted')
assert.deepEqual(first.state.config.maleLead.traits, [])
await page.locator('textarea').fill('我想听你说。')
assert.equal(
  await page
    .locator('textarea')
    .evaluate((e) => getComputedStyle(e).outlineStyle),
  'none',
)
assert.equal(
  await page
    .locator('.composer')
    .evaluate((e) => getComputedStyle(e).borderTopWidth),
  '0px',
)
assert.equal(
  await page
    .locator('.composer')
    .evaluate((e) => getComputedStyle(e).backgroundColor),
  'rgba(0, 0, 0, 0)',
)
await page.getByRole('button', { name: '重新开始', exact: true }).click()
assert.equal(new URL(page.url()).hash, '#/world')
await page
  .getByRole('button', { name: '民国虐恋 当年的事，我们各有难处' })
  .click()
await next()
await next()
await page.getByRole('slider').press('Home')
await next()
await page.getByLabel('你的名字').fill('初晴')
await page.getByRole('button', { name: '我的恋人，请与我相爱' }).click()
await page.locator('.story-message').waitFor()
const books = await savedBooks()
assert.equal(books.length, 2)
const fresh = books.find((x) => x.id !== first.id)
assert.equal(fresh.state.config.background, 'republican_era')
assert.equal(fresh.state.config.tone, 0)
assert.equal(fresh.state.config.player.name, '初晴')
assert.ok(!/手机|工作群|西装|车灯/.test(fresh.state.messages[0].content))
await page.reload()
await page.locator('.story-message').waitFor()
assert.equal((await savedBooks()).length, 2)
await page.setViewportSize({ width: 320, height: 700 })
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
)
assert.deepEqual(errors, [])
console.log(
  'PASS: latest Figma layout, requested catalog counts, hover/select glow, no focus frames, tone range saved, no traits, restart preserves old story, new setting takes effect, 320px layout',
)
await browser.close()
