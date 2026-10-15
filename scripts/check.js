// 使い方: node scripts/check.js   （playwright が必要）
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const R=require('./routes');
const EMOJI=/[\p{Extended_Pictographic}️⃣]/u;
(async()=>{
 const errs=[],bad=[];
 // ソース内の絵文字・noindex・制作者表記
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 for(const f of walk(path.join(__dirname,'../shopnavi-mock'))){const t=fs.readFileSync(f,'utf8');if(EMOJI.test(t))bad.push(['emoji-src',f]);
  if(f.endsWith('.html')){if(!/noindex/.test(t))bad.push(['noindex',f]);if(!t.includes('山下修司が制作'))bad.push(['credit',f])}}
 const b=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
 for(const mode of ['full','simple']){
  const routes=mode=='full'?R.FULL:R.SIMPLE,base=R.root+'/'+mode+'/index.html';
  for(const w of [375,1280]){
   const p=await b.newPage({viewport:{width:w,height:800}});
   p.on('console',m=>m.type()=='error'&&errs.push(m.text()));p.on('pageerror',e=>errs.push(String(e)));
   const links=new Set();
   for(const r of routes){
    await p.goto(base+'#/'+r);await p.waitForTimeout(40);
    const o=await p.evaluate(()=>{const bn=document.querySelector('.mock-banner');return {ban:!!bn&&bn.getBoundingClientRect().top===0&&bn.textContent.includes('モックアップ'),
     ov:document.documentElement.scrollWidth>innerWidth,k:document.querySelector('#view').dataset.k,txt:document.body.innerText,html:document.body.innerHTML,
     foot:document.querySelector('.foot').innerText,tabs:document.querySelectorAll('#tabs a').length,hs:[...document.querySelectorAll('a[href^="#/"]')].map(a=>a.getAttribute('href'))}});
    if(!o.ban||o.ov||o.k=='fallback'||!o.foot.includes('山下修司が制作')||!o.foot.includes('モックアップです'))bad.push([mode,w,r,'ban/ov/k/foot',o.ban,o.ov,o.k]);
    if(EMOJI.test(o.txt)||EMOJI.test(o.html))bad.push([mode,w,r,'emoji']);
    if(mode=='simple'&&o.tabs!==4)bad.push([mode,r,'tabs',o.tabs]);
    if(mode=='full'&&o.tabs!==5)bad.push([mode,r,'tabs',o.tabs]);
    if(r.startsWith('promo')&&!(o.txt.includes('料理そのものはAIで生成しません。実際の写真を加工します')&&o.txt.includes('AIの出力は参考案です。必ず内容を確認してから使用してください')))bad.push([mode,r,'promo-notes']);
    o.hs.forEach(h=>links.add(h));
   }
   for(const l of links){await p.goto(base+l);await p.waitForTimeout(30);const k=await p.evaluate(()=>document.querySelector('#view').dataset.k);if(k=='fallback')bad.push([mode,w,'deadlink',l])}
   // ダミーボタン（全画面で data-dummy を1つ押す）
   let n=0;
   for(const r of routes){await p.goto(base+'#/'+r);const d=await p.$('[data-dummy]');if(!d)continue;await d.scrollIntoViewIfNeeded();await d.click();n++;
    const t=await p.evaluate(()=>({c:document.querySelector('#toast').className,t:document.querySelector('#toast').textContent}));
    if(!t.c.includes('show')||t.t!=='モックアップのため操作できません')bad.push([mode,w,r,'toast',t])}
   if(n<5)bad.push([mode,'few-dummy',n]);
   // 広報フロー（リンクで1→4）
   await p.goto(base+'#/promo/1');for(let i=1;i<4;i++){await p.click('a.btn.block.big');await p.waitForTimeout(30)}
   if(!p.url().endsWith('promo/4'))bad.push([mode,w,'promo-flow',p.url()]);
   await p.close();
  }
 }
 // simple ホームの広報カード、full に広報タブ
 const q=await b.newPage({viewport:{width:1280,height:800}});
 await q.goto(R.root+'/simple/index.html#/home');if(!(await q.$('#view a[href="#/promo"]')))bad.push('simple-home-promo-card');
 await q.goto(R.root+'/full/index.html#/home');if(!(await q.$('#side a[href="#/promo"]')))bad.push('full-side-promo');
 await q.setViewportSize({width:375,height:800});await q.goto(R.root+'/full/index.html#/more');if(!(await q.$('#view a[href="#/promo"]')))bad.push('full-more-promo');
 await q.goto(R.root+'/index.html');if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))bad.push('landing-overflow');
 console.log(JSON.stringify({consoleErrors:errs,problems:bad},null,1));await b.close();process.exit(errs.length||bad.length?1:0)})();
