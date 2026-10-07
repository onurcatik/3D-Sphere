import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';
const output = process.argv[2] || 'visual-baseline';
const full = process.argv.includes('--full');
const browser = await chromium.launch({channel:"chromium",headless:true});
const sizes = full ? [['desktop',{viewport:{width:1920,height:1080}}],['laptop',{viewport:{width:1440,height:900}}],['iphone',{...devices['iPhone 13'],defaultBrowserType:undefined}]] : [['desktop',{viewport:{width:1440,height:900}}]];
for (const [name,options] of sizes) {
 const context=await browser.newContext(options); const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(process.env.QA_URL || 'http://127.0.0.1:3000/?qa=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('canvas',{timeout:60000}); await page.waitForTimeout(2500);
 await fs.mkdir(`${output}/${name}`,{recursive:true});
 for(const p of full ? [0,.15,.32,.5,.63,.76,.94,1] : [0]) {
  await page.evaluate(p=>{window.scrollTo(0,p*(document.documentElement.scrollHeight-innerHeight))},p);
  await page.waitForTimeout(1300);
  await page.screenshot({path:`${output}/${name}/${p.toFixed(2)}.png`});
 }
 await fs.writeFile(`${output}/${name}/browser.json`,JSON.stringify({errors},null,2));
 if(errors.length)console.error(name,errors);
 await context.close();
}
await browser.close();
