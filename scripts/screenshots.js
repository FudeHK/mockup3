// 使い方: node scripts/screenshots.js [出力先=./screenshots]   → 全画面を 375px / 1280px で保存
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const R=require('./routes');
const out=path.resolve(process.argv[2]||'screenshots');
(async()=>{const b=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());let n=0;
 for(const mode of ['full','simple']){for(const w of [375,1280]){const p=await b.newPage({viewport:{width:w,height:800}});
  for(const r of (mode=='full'?R.FULL:R.SIMPLE)){await p.goto(R.root+'/'+mode+'/index.html#/'+r);await p.waitForTimeout(80);
   const f=path.join(out,mode,w+'px',r.replace(/\//g,'_')+'.png');fs.mkdirSync(path.dirname(f),{recursive:true});await p.screenshot({path:f,fullPage:true});n++}
  const ex=async(name,r,fn)=>{await p.goto(R.root+'/'+mode+'/index.html#/'+r);await fn();await p.waitForTimeout(60);const f=path.join(out,mode,w+'px',name+'.png');await p.screenshot({path:f,fullPage:true});n++};
  await ex('promo_3_warn','promo/3',async()=>{await p.fill('[data-f="copy"]','日本一おいしい')});
  await ex('promo_4_story','promo/3',async()=>{await p.click('[data-k="size"][data-v="st"]');await p.goto(R.root+'/'+mode+'/index.html#/promo/4')});
  await ex('promo_4_map','promo/3',async()=>{await p.click('[data-k="size"][data-v="mp"]');await p.goto(R.root+'/'+mode+'/index.html#/promo/4')});
  await p.close()}}
 console.log(n+' 枚を '+out+' に保存しました');await b.close()})();
