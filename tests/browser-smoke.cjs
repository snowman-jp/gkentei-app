// Optional integration check: requires Playwright and a Chromium executable.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'../index.html')))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/`;assert.equal((await page.goto(url)).status(),200);
  await page.evaluate(()=>localStorage.setItem(KEY,JSON.stringify({history:[{id:1,ok:true,at:'2026-01-01T00:00:00Z'}],wrong:[9],sets:3})));
  await page.reload();assert.equal(await page.textContent('#attempts'),'1');
  const ids=Array.from({length:100},(_,i)=>i+1);
  for(const id of ids){
   await page.evaluate(id=>start('review',[id]),id);
   const correct=await page.evaluate(()=>queue[i].o[queue[i].a]);
   const wrongIndex=await page.evaluate(()=>displayedChoices.findIndex(c=>c.originalIndex!==queue[i].a));
   await page.locator('#choices button').nth(wrongIndex).click();
   assert.equal(await page.locator('.choice.right span').nth(1).textContent(),correct);
   assert.equal(await page.locator('.choice.wrong').count(),1);assert.match(await page.textContent('.feedback-title'),/不正解/);
   const structured=await page.evaluate(()=>!!queue[i].lesson);
   assert.equal(await page.locator('.lesson-section').count(),structured?5:0);
   if(structured){
    assert.equal(await page.locator('.lesson-section[open]').count(),0);
    await page.locator('.lesson-section summary').nth(3).focus();await page.keyboard.press('Space');
    assert.equal(await page.locator('.lesson-section[open]').count(),1);assert.equal(await page.locator('.lesson-section li').count(),3);
    for(const section of await page.locator('.lesson-section').all()){if(!await section.evaluate(el=>el.open))await section.locator('summary').click()}
    assert.equal(await page.locator('.lesson-section[open]').count(),5);
    if(await page.evaluate(()=>!!queue[i].legal)){assert.equal(await page.locator('.legal-note').isVisible(),true);assert.match(await page.textContent('.legal-note'),/未確認/)}
    for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at Q${id}, ${width}px`)}
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.lesson-intuition').count(),1);
    assert.equal(await page.locator('.lesson-section summary').allTextContents().then(xs=>xs.join('|')),'② 結論|③ 基礎知識|④ 具体例|⑤ 他の選択肢が違う理由|⑥ G検定の重要ポイント');
    const reasons=await page.evaluate(()=>Array.from(document.querySelectorAll('.lesson-section li')).map(li=>li.textContent));
    assert.equal(reasons.length,3);
    const correctLabel=await page.evaluate(()=>'選択肢'+'ABCD'[displayedChoices.findIndex(c=>c.originalIndex===queue[i].a)]+'：');assert.equal(reasons.every(text=>!text.startsWith(correctLabel)),true);
    if(id%20===0)console.log('Checked questions 1–'+id);
   }
   await page.click('#next');assert.match(await page.textContent('#resultScore'),/0 \/ 1/);
   await page.click('#retryWrong');
   await page.locator('#choices button').nth(await page.evaluate(()=>displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))).click();
   assert.match(await page.textContent('.feedback-title'),/正解！/);
   assert.equal(await page.evaluate(id=>data.wrong.includes(id),id),false);
   await page.click('#next');assert.match(await page.textContent('#resultScore'),/1 \/ 1/);
  }
  await page.click('#returnHome');const count=await page.textContent('#attempts');await page.reload();assert.equal(await page.textContent('#attempts'),count);assert.equal(await page.textContent('#sets'),'3');
  await page.click('#start');assert.equal(await page.evaluate(()=>queue.every(q=>q.lesson)),true);
  for(let n=0;n<5;n++){await page.locator('#choices button').nth(await page.evaluate(()=>displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))).click();if(n===0){await page.locator('.lesson-section summary').nth(0).click();await page.screenshot({path:'/tmp/gkentei-stage1-mobile.png',fullPage:true})}await page.click('#next')}
  assert.match(await page.textContent('#resultScore'),/5 \/ 5/);await page.click('#returnHome');assert.equal(await page.textContent('#sets'),'4');
  await page.click('#statsBtn');assert.equal(await page.locator('#statsContent .labelrow').count(),10);await page.click('#statsHome');await page.click('#smartStart');assert.equal(await page.locator('#choices button').count(),4);
  assert.deepEqual(errors,[]);console.log('PASS: all 100 questions, correct/wrong scoring, retry, legacy history/reload, native details keyboard, 320/390/1280px, random 5, stats, smart mode; no JS errors');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
