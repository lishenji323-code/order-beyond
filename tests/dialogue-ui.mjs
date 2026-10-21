import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
await mkdir('test-results', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
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
    const prompt = route
      .request()
      .postDataJSON()
      .messages.map((m) => m.content)
      .join('\n')
    assert.ok(prompt.includes('不写旁白提问、连续反问'))
    assert.ok(!prompt.includes('至少两个未解决问题'))
    const title = count === 3 ? '晨间来客' : '被划去的名字'
    const story =
      count === 1
        ? '他将名册转过来：“你的名字是我划掉的。昨夜是谁让你来取旧档的？”'
        : count === 2
          ? '“是我多事。”他没有收回名册，“但你先听我说，明早有人要查这份名单。”'
          : '第二天清早，他站在门边：“昨晚说的事，我已经查清了。现在方便说话吗？”'
    const narrative = {
      title,
      time: { day: count === 3 ? 2 : 1, period: count === 3 ? 'day' : 'night' },
    }
    await route.fulfill({
      json: {
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                story,
                narrative,
                plotProgress: false,
                relationshipProgress: false,
              }),
            },
          },
        ],
      },
    })
  },
)
await page.goto('http://localhost:5173/#/world')
for (const screen of ['world', 'trope', 'person']) {
  await page.locator(`.scene-${screen}`).waitFor()
  const button = page.getByRole('button', { name: '下一步' })
  assert.equal(await button.count(), 1)
  const initial = await button.boundingBox()
  assert.ok(initial.y + initial.height <= 844)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(100)
  const scrolled = await button.boundingBox()
  assert.equal(scrolled.y, initial.y)
  assert.equal(
    await button.evaluate((e) => getComputedStyle(e).position),
    'fixed',
  )
  const last =
    screen === 'person'
      ? page.locator('.tone-ends')
      : page.locator('.choice').last()
  const lastBox = await last.boundingBox()
  assert.ok(
    lastBox.y + lastBox.height < scrolled.y,
    `last content hidden under CTA on ${screen}`,
  )
  await page.screenshot({ path: `test-results/dialogue-${screen}.png` })
  await button.click()
}
await page.getByLabel('你的名字').fill('林夏')
await page.getByRole('button', { name: '我的恋人，请与我相爱' }).click()
await page.getByRole('heading', { name: '被划去的名字' }).waitFor()
assert.equal(await page.locator('.chapter-heading>span').innerText(), '第一夜')
assert.ok(!(await page.locator('main').innerText()).includes('第一章'))
await page.locator('textarea').fill('你为什么帮我？')
await page.getByRole('button', { name: '发送', exact: true }).click()
await page.waitForFunction(
  () => document.querySelectorAll('.story-message').length === 2,
)
assert.equal(await page.locator('.chapter-heading>span').innerText(), '第一夜')
assert.equal(await page.locator('.time-break').count(), 0)
await page.reload()
await page.getByRole('heading', { name: '被划去的名字' }).waitFor()
assert.equal(await page.locator('.chapter-heading>span').innerText(), '第一夜')
await page.locator('textarea').fill('好，明天早上再说。')
await page.getByRole('button', { name: '发送', exact: true }).click()
await page.getByRole('heading', { name: '晨间来客' }).waitFor()
assert.equal(await page.locator('.chapter-heading>span').innerText(), '第二天')
assert.equal(await page.locator('.time-break').innerText(), '第二天')
await page.reload()
await page.getByRole('heading', { name: '晨间来客' }).waitFor()
assert.equal(await page.locator('.story-message').count(), 3)
await page.screenshot({ path: 'test-results/dialogue-reader.png' })
await page.setViewportSize({ width: 320, height: 700 })
await page.getByRole('button', { name: '重新开始' }).click()
await page.getByRole('button', { name: '下一步' }).click()
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
const small = await page.getByRole('button', { name: '下一步' }).boundingBox()
assert.ok(
  small.x >= 0 && small.x + small.width <= 320 && small.y + small.height <= 700,
)
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
)
assert.deepEqual(errors, [])
await browser.close()
console.log(
  'PASS: one persistent CTA on each choice screen, no obscured last option/slider, model title, first night unchanged by reply/reload, second day transition persisted, 320px layout',
)
