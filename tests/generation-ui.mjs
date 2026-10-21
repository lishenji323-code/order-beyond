import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() =>
  localStorage.setItem(
    'order-beyond:model',
    JSON.stringify({ apiKey: 'fixture-key', model: 'fixture/model' }),
  ),
)
let count = 0
await page.route(
  'https://openrouter.ai/api/v1/chat/completions',
  async (route) => {
    count++
    if (count === 1) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        await route.abort()
      } catch {}
      return
    }
    if (count === 2)
      return route.fulfill({
        json: { choices: [{ message: { content: '{"story":' } }] },
      })
    return route.fulfill({
      json: {
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                story: '玻璃窗外落着雨。他把信放在桌边：“等你很久了。”',
                narrative: {
                  title: '灯下的信',
                  time: { day: 1, period: 'night' },
                },
                relationshipProgress: true,
                plotProgress: true,
                sceneSummary: '一封信被送到桌边。',
              }),
            },
          },
        ],
      },
    })
  },
)
await page.goto('http://localhost:5173/#/world')
for (let i = 0; i < 3; i++)
  await page.getByRole('button', { name: '下一步' }).first().click()
await page.getByLabel('你的名字').fill('林夏')
await page.getByRole('button', { name: '我的恋人，请与我相爱' }).click()
await page.getByRole('button', { name: '停止', exact: true }).click()
await page.getByRole('alert').waitFor()
assert.ok((await page.getByRole('alert').innerText()).includes('停止'))
assert.equal(new URL(page.url()).hash, '#/reader')
assert.equal(await page.locator('.story-message').count(), 0)
await page.getByRole('button', { name: '重试', exact: true }).click()
await page.waitForFunction(() =>
  document.querySelector('[role=alert]')?.textContent.includes('没有完整返回'),
)
assert.equal(await page.locator('.story-message').count(), 0)
await page.getByRole('button', { name: '重试', exact: true }).click()
await page.locator('.story-message').waitFor()
assert.equal(await page.locator('.story-message').count(), 1)
assert.equal(count, 3)
await page.reload()
await page.locator('.story-message').waitFor()
assert.equal(await page.locator('.story-message').count(), 1)
console.log(
  'PASS: connected opening, cancellation, invalid JSON rejection, retry, exactly one saved chapter, stable reader route',
)
await browser.close()
