const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_URL || 'http://127.0.0.1:8080';
(async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ncmmsc2026.lottery.v1')));
 const click=async()=>{await page.waitForTimeout(700);await page.locator('#primary').click();};
 const set=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).blur();};
 try {
  await page.goto(BASE); await page.waitForSelector('#primary');
  await page.screenshot({path:'preview-desktop.png',fullPage:true});
  assert.equal(await page.locator('#remaining').innerText(),'660');
  await set('added',10);
  await page.locator('#primary').dblclick(); let s=await read(); assert.equal(s.current.phase,'rolling');
  const first=s.current.numbers; await page.reload(); assert.deepEqual((await read()).current.numbers,first);
  await click(); assert.equal((await read()).current.phase,'review');
  await page.locator('.number-card').nth(0).click(); await page.locator('.number-card').nth(1).click();
  await page.reload();assert.equal((await read()).current.absent.length,2);
  await page.locator('.number-card').nth(1).click();await page.locator('.number-card').nth(1).click();
  await page.waitForTimeout(3600); await page.screenshot({path:'preview-results.png',fullPage:true});
  await click(); s=await read();assert.equal(s.pending,2);assert.equal(await page.locator('#winner-count').innerText(),'8'); assert.equal(await page.locator('#absent-count').innerText(),'2');
  await page.reload();assert.equal((await read()).pending,2);
  await set('added',5); await click();s=await read();assert.equal(s.current.numbers.length,7);assert.ok(s.current.numbers.every(n=>!first.includes(n)));
  await click(); await page.locator('.number-card').first().click();await click();assert.equal((await read()).pending,1);
  await set('added',0);await click();assert.equal((await read()).current.numbers.length,1);await click();await click();assert.equal((await read()).pending,0);
  await set('added',660);await click();assert.equal((await read()).current,null);assert.match(await page.locator('#notice').innerText(),/仅剩/);
  await page.locator('#draw-all').click();assert.equal((await read()).current.numbers.length,642);await click();await click();assert.equal((await read()).pending,18);assert.equal(await page.locator('#primary').isDisabled(),true);
  await page.locator('#reset').click();await page.locator('#cancel-reset').click();assert.equal((await read()).pending,18);
  await page.locator('#reset').click();await page.locator('#confirm-reset').click();assert.equal((await read()).batches.length,0);
  await set('added',120);await click();await click();assert.equal(await page.locator('.number-card').count(),120);
  const dims=await page.locator('#numbers').evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight}));assert.ok(dims.scroll>dims.h);
  for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:390,height:844}]){
    await page.setViewportSize(viewport);if(viewport.width>900) assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight), 'projector fits vertically'); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.waitForTimeout(3600); await page.screenshot({path:'preview-mobile.png',fullPage:false});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.orbit-two').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#reset').click();await page.locator('#confirm-reset').click();
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('quota');};});await click();assert.equal((await read()).current,null);assert.match(await page.locator('#notice').innerText(),/保存失败/);
  await page.reload();
  const other=await context.newPage();await other.goto(BASE);await other.locator('#added').fill('8');await other.locator('#added').blur();await page.waitForTimeout(100);assert.ok(await page.locator('#primary').isDisabled());await other.close();
  assert.deepEqual(errors,[]);
  console.log('PASS browser: full flow, duplicate click, refresh in 3 phases, shortage, reset, 120 cards, desktop/mobile overflow, reduced motion, storage failure, multiple tabs; no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
