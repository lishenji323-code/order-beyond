import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844}})
await page.addInitScript(()=>localStorage.setItem('order-beyond:model',JSON.stringify({apiKey:'fixture',model:'fixture'})))
let calls=0
await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
 calls++
 const prompt=route.request().postDataJSON().messages.map(m=>m.content).join('\n')
 if(calls>1)assert.ok(prompt.includes('本轮有礼貌收尾信号'))
 if(calls===3)assert.ok(prompt.includes('【本轮重写】'))
 const story=calls===1?'他把水桶放在墙边：“先用这一桶。有事敲门就行，hally。”':calls===2?'他走到楼梯口，回头说：“有事就敲门。”':'他点了下头，转身上楼。'
 await route.fulfill({json:{choices:[{message:{content:JSON.stringify({story,narrative:{title:'停水的楼道',time:{day:1,period:'night'}},plotProgress:false,relationshipProgress:false})}}]}})
})
await page.goto('http://localhost:5173/#/world')
for(let i=0;i<3;i++)await page.getByRole('button',{name:'下一步'}).click()
await page.getByLabel('你的名字').fill('hally')
await page.getByRole('button',{name:'我的恋人，请与我相爱'}).click()
await page.locator('.story-message').waitFor()
await page.locator('textarea').fill('嗯，谢谢')
await page.getByRole('button',{name:'发送',exact:true}).click()
await page.waitForFunction(()=>document.querySelectorAll('.story-message').length===2)
assert.equal(calls,3)
assert.equal(await page.locator('.story-message').last().innerText(),'他点了下头，转身上楼。')
assert.equal(await page.locator('.player-message').count(),1)
await page.reload()
await page.locator('.story-message').first().waitFor()
assert.equal(await page.locator('.story-message').last().innerText(),'他点了下头，转身上楼。')
assert.equal(await page.locator('.story-message').count(),2)
await browser.close()
console.log('PASS: courtesy closure repaired once, one short ending saved, player input not duplicated, reload preserves ending')
