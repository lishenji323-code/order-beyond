import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844}})
page.setDefaultTimeout(15000)
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>localStorage.setItem('order-beyond:model',JSON.stringify({apiKey:'fixture',model:'fixture'})))
let calls=0
await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
 calls++
 const messages=route.request().postDataJSON().messages
 assert.equal(messages[0].role,'system')
 const prompt=messages.map(m=>m.content).join('\n')
 assert.ok(!prompt.includes('在维多利亚港的雾气下，他说...'))
 assert.ok(prompt.includes('香港本地豪门与港资家族网络'))
 if(calls===3||calls===5)assert.ok(prompt.includes('【本轮重写】'))
 const stories={
  1:'管家称他大少，提醒二叔还在等着谈董事席位。他把客厅的椅子拉开：“坐我隔篱，其他嘢我会处理。”',
  2:'他翻开末页：“要我把需要注意的地方圈出来吗？”',
  3:'他看完，把一处违约条款划去：“呢条唔签。我让律师改。你不用再为这份东西跑一趟。”',
  4:'他放下文件——“你把我看得太轻了。”',
  5:'他追到走廊，隔着几步停下：“头先我讲得唔好。合同我会处理，不用你再回来。”',
  6:'三个月后，他出差回来。管家还没接过行李，他先走到你面前：“好耐冇见。给你带了点东西。”',
  7:'他打开行李，将一盒茶放到桌边：“你上次说喝不惯咖啡，我记着。”',
  8:'第二天早上，他已经在厨房：“食过早餐未？我多煮了一份。”',
 }
 const time=calls<6?{day:1,period:'night'}:calls===6?{day:91,period:'night',label:'三个月后'}:calls===7?{day:91,period:'night'}:{day:92,period:'day'}
 await route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({story:stories[calls],narrative:{title:calls<6?'老宅留座':'归来的行李',time},relationshipProgress:true,plotProgress:true})}}]}})
})
await page.goto('http://localhost:5173/#/world')
await page.getByRole('button',{name:'港圈豪门 在维多利亚港的雾气下，他说...'}).click()
for(let i=0;i<3;i++)await page.getByRole('button',{name:'下一步'}).click()
await page.getByLabel('你的名字').fill('心')
await page.getByRole('button',{name:'我的恋人，请与我相爱'}).click()
await page.locator('.story-message').waitFor()
async function send(input,total){
 await page.locator('textarea').fill(input)
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await page.waitForFunction(n=>document.querySelectorAll('.story-message').length===n,total)
}
await send('阿sir，你先过目啦',2)
assert.equal(calls,3)
assert.ok(!(await page.locator('.story-feed').innerText()).includes('要我把需要注意'))
await send('不用了，我已经知道了，然后负气离开',3)
assert.equal(calls,5)
assert.ok(!/[—―]|看得太轻/.test(await page.locator('.story-feed').innerText()))
await send('这段出差跳过去吧，三个月后再见。',4)
assert.equal(await page.locator('.chapter-heading>span').innerText(),'三个月后')
assert.equal(await page.locator('.time-break').last().innerText(),'三个月后')
await send('给我带了什么？',5)
assert.equal(await page.locator('.chapter-heading>span').innerText(),'三个月后')
await page.reload()
await page.locator('.story-message').first().waitFor()
assert.equal(await page.locator('.chapter-heading>span').innerText(),'三个月后')
assert.equal(await page.locator('.player-message').count(),4)
await page.screenshot({path:'test-results/story-time-jump.png'})
await send('今天先休息，明天再说吧。',6)
assert.equal(await page.locator('.chapter-heading>span').innerText(),'第九十二天')
assert.equal(calls,8)
assert.deepEqual(errors,[])
await browser.close()
console.log('PASS: system instructions, UI subtitle isolation, bounded repair, discarded drafts invisible, single committed reply per input, jump label and reload, next-day reset')
