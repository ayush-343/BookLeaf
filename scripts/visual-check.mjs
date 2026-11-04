import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const origin = process.env.SMOKE_ORIGIN;
const chrome = await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true});
try {
  await mkdir(".impeccable/review",{recursive:true});
  const pages = {};
  for(const [screen,email,path,heading] of [
    ["author","author1@bookleaf.example","/","My books"],
    ["admin","admin1@bookleaf.example","/?ticket=demo-royalty","Question about my royalty payout"],
  ]) {
    const context = await chrome.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({width:1440,height:900});
    await page.goto(origin);
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]',email);
    await page.type('input[name="password"]',process.env.DEMO_PASSWORD);
    await page.click("form button");
    await page.waitForFunction(()=>Boolean(document.querySelector("header")), {timeout:8000}).catch(async error=>{console.error(await page.evaluate(()=>document.body.innerText));throw error;});
    await page.goto(origin+path);
    await page.waitForFunction(expected=>document.querySelector("h1")?.textContent===expected,{timeout:8000},heading).catch(async error=>{console.error(await page.evaluate(()=>document.body.innerText));throw error;});
    await page.evaluate(()=>document.fonts.ready);
    for(const [width,height,size] of [[1440,900,"desktop"],[390,844,"mobile"]]){
      await page.setViewport({width,height});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:".impeccable/review/"+screen+"-"+size+".png",fullPage:true});
    }
    pages[screen]=page;
  }
  const {author,admin}=pages;
  let ticketUrl=origin+"/?ticket=demo-royalty";
  if(process.env.BOOKLEAF_LIVE_CHECK==="1"){
    await author.locator("button::-p-text(New support ticket)").click();
    await author.locator('input[name="subject"]').fill("Synthetic binding defect");
    await author.locator('textarea[name="description"]').fill("Pages fell out of my synthetic test copy. What proof do you need for a reprint?");
    await author.locator("button::-p-text(Submit ticket)").click();
    await author.waitForFunction(()=>new URLSearchParams(location.search).has("ticket"),{timeout:20000});
    ticketUrl=author.url();
    await admin.goto(ticketUrl);
    await admin.waitForFunction(()=>Array.from(document.querySelectorAll("select")).some(s=>s.value==="Printing & Quality"),{timeout:12000});
    await admin.locator("button::-p-text(Use draft)").setTimeout(25000).click();
    assert.ok(await admin.$eval(".composer textarea",element=>element.value.length>0));
  } else {
    await author.goto(ticketUrl);
  }
  const authorDocument = await author.evaluate(()=>performance.timeOrigin);
  const reply = "Browser verification: we’ll check the available next steps.";
  await admin.locator(".composer textarea").fill(reply);
  await admin.locator("button::-p-text(Send reply)").click();
  await author.waitForFunction(text=>document.body.innerText.includes(text),{timeout:18000},reply);
  assert.equal(await author.evaluate(()=>performance.timeOrigin),authorDocument);
  const signOut=await author.evaluate(async()=> (await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status);
  assert.equal(signOut,200);
  await author.waitForFunction(()=>document.querySelector("h1")?.textContent==="Sign in to support",{timeout:18000});
  assert.equal(await author.evaluate(text=>document.body.innerText.includes(text),reply),false);
  console.log("Reply arrived without reloading and the invalidated session returned to sign-in.");
  console.log("Browser passed: both role sign-ins, authenticated screens, and mobile overflow.");
} finally {
  await chrome.close();
}
