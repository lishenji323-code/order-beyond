import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await mkdir('test-results', { recursive: true })
const root = process.env.TEST_URL || 'http://localhost:5173'
async function shot(name) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `test-results/${name}.png` })
}
await page.goto(root)
await page.getByRole('button', { name: '与我一起堕入梦境吧，公主' }).waitFor()
await shot('product-home')
await page.getByRole('button', { name: '与我一起堕入梦境吧，公主' }).click()
await shot('product-world')
await page.getByRole('button', { name: '下一步' }).first().click()
await shot('product-trope')
await page.getByRole('button', { name: '下一步' }).first().click()
await shot('product-person')
assert.equal(await page.locator('.chip').count(), 0)
await page.getByRole('slider', { name: '甜虐调节器' }).press('End')
await page.getByRole('button', { name: '下一步' }).first().click()
await shot('product-name')
assert.equal(await page.locator('input').count(), 1)
await page.getByLabel('你的名字').fill('林夏')
await page.getByRole('button', { name: '我的恋人，请与我相爱' }).click()
await page.locator('.story-message').waitFor()
await shot('product-reader')
await page
  .getByRole('textbox', { name: '回复他，或者做你想做的事' })
  .fill('把那封信交给我。')
await page.getByRole('button', { name: '发送', exact: true }).click()
await page.getByRole('heading', { name: '让故事继续' }).waitFor()
await shot('product-settings')
await page.getByLabel('OpenRouter API Key').fill('test-key-not-real')
await page.getByRole('button', { name: '保存并返回' }).click()
let calls = 0
await page.route(
  'https://openrouter.ai/api/v1/chat/completions',
  async (route) => {
    calls++
    if (calls === 1) return route.fulfill({ status: 429, body: '{}' })
    const body = route.request().postDataJSON()
    assert.ok(
      body.messages
        .map((m) => m.content)
        .join('\n')
        .includes('把那封信交给我。'),
    )
    await route.fulfill({
      json: {
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                story:
                  '他将那封信交到你手中。\n\n“背面还有一行字。”他没有催促，等你自己看。',
                narrative: {
                  title: '信的背面',
                  time: { day: 1, period: 'night' },
                },
                relationshipProgress: true,
                plotProgress: true,
                relationshipPatch: { trust: 2 },
                sceneSummary: '他已将信交给林夏。',
              }),
            },
          },
        ],
      },
    })
  },
)
await page.getByRole('button', { name: '发送', exact: true }).click()
await page.getByRole('alert').waitFor()
console.log('Error state:', await page.getByRole('alert').innerText())
assert.ok((await page.getByRole('alert').innerText()).includes('频繁'))
assert.equal(await page.locator('.story-message').count(), 1)
await page.reload()
await page.getByRole('button', { name: '继续刚才的续写' }).click()
await page.waitForFunction(
  () => document.querySelectorAll('.story-message').length === 2,
)
assert.equal(await page.locator('.player-message').count(), 1)
await page.reload()
await page.locator('.story-message').first().waitFor()
assert.equal(await page.locator('.story-message').count(), 2)
assert.equal(calls, 2)
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
)
await page.getByRole('button', { name: '返回', exact: true }).click()
await page.getByRole('button', { name: '与我一起堕入梦境吧，公主' }).click()
assert.equal(await page.locator('.story-message').count(), 2)
await page.setViewportSize({ width: 320, height: 700 })
await shot('product-small')
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
)
assert.deepEqual(errors, [])
console.log(
  'PASS: exact seven-screen flow, tone slider, only name input, model setup, 429 recovery, persisted pending turn, retry without duplicate, reload, 320px layout, no browser errors',
)
await browser.close()
