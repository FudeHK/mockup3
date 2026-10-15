(function(){
'use strict';
var MODE=window.SN_MODE==='simple'?'simple':'full',FULL=MODE==='full';
/* ===== アイコン（インラインSVG） ===== */
var P={manual:'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM6 19h12',home:'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',book:'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM6 19h12',menu:'M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10',kitchen:'M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM2 10h20M9 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4',diag:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',staff:'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',request:'M3 5h18v14H3zM3 6l9 7 9-7',settings:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',promo:'M3 10v4h4l8 5V5L7 10zM18 9a4 4 0 0 1 0 6',more:'M4 6h16M4 12h16M4 18h16',onboarding:'M12 21V11M12 11C12 7 9 5 5 5c0 4 3 6 7 6M12 13c0-3 2-5 6-5 0 4-2 6-6 6',checklist:'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',lang:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',quiz:'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z',praise:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',left:'M15 5l-7 7 7 7',camera:'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',mic:'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4',image:'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 5'};
function ic(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="'+P[n]+'"/></svg>'}
/* ===== ダミーデータ（すべて架空） ===== */
var SHOP={name:'居酒屋 みなと亭',addr:'〇〇県△△市みなと町1-2-3（架空）',hours:'17:00〜24:00（L.O. 23:30）'};
var TYPES={
 careful:{n:'じっくり確認型',d:'手順を理解してから動くタイプ。ミスが少なく、正確さが強み。',m:'図中心とチェックリスト型',md:'工程ごとに図解された手順書と、確認用チェックリストが合います。',a:['作業の理由まで説明する','急かさず、考える時間を渡す','正確さを具体的に褒める']},
 call:{n:'声かけ歓迎型',d:'対話の中で学び、安心して力を出すタイプ。',m:'動画中心と対話型',md:'先輩の実演動画を見て、あとで質問できる形が合います。',a:['こまめに声をかけ、小さな成功を伝える','困っていないか、定期的に聞く','1on1の時間を月1回はとる']},
 solo:{n:'ひとりで集中型',d:'任されると力を発揮する、マイペースな集中タイプ。',m:'文章中心と要点メモ型',md:'必要なときに自分で読み返せる、簡潔な文章手順が合います。',a:['役割を任せ、結果で認める','忙しい時間帯は声かけを最小限に','質問しやすい合図を決めておく']},
 speed:{n:'まず動く型',d:'やりながら覚える行動派。スピード感が強み。',m:'短い動画と写真つきカード型',md:'30秒の動画と写真つきの要点カードが合います。',a:['まず任せて、あとで一緒に振り返る','抜けやすい点だけ事前に伝える','スピードを認めつつ確認を習慣に']},
 team:{n:'みんなで進める型',d:'周りと協力すると力が出る、場を和ませるタイプ。',m:'図中心とペア練習型',md:'ペアで練習できる図解マニュアルが合います。',a:['ペア・チームで取り組む機会を作る','感謝の言葉をチームの前で伝える','後輩指導の役割を任せる']}
};
var STAFF=[
 {id:1,name:'港 ひなた',role:'ホールリーダー',t:'call',lv:85,mot:[60,65,62,75,80,84],since:'3年目'},
 {id:2,name:'浜田 けんと',role:'調理',t:'careful',lv:78,mot:[70,72,68,70,74,76],since:'5年目'},
 {id:3,name:'岬 みお',role:'ホール',t:'team',lv:60,mot:[50,58,60,55,62,70],since:'1年目'},
 {id:4,name:'波止 りく',role:'調理補助',t:'speed',lv:45,mot:[80,76,70,64,58,52],since:'3ヶ月'},
 {id:5,name:'ミン（留学生）',role:'ホール',t:'solo',lv:35,mot:[55,60,66,68,72,78],since:'1ヶ月'},
 {id:6,name:'潮見 あおい',role:'ホール・レジ',t:'careful',lv:70,mot:[65,66,70,72,71,73],since:'2年目'}
];
var MANUALS=[
 {id:1,t:'開店準備の手順',f:'チェックリスト型',read:5,date:'9/28',steps:['看板とのれんを出す','おしぼり・箸を補充','冷蔵庫の温度確認（5℃以下）','レジの釣り銭を確認','全員で今日のひとことを確認']},
 {id:2,t:'生ビールの注ぎ方',f:'動画中心',read:3,date:'9/25',steps:['ジョッキを傾けて注ぐ','七分目で立てて泡をのせる','泡は指2本分','すぐに提供する']},
 {id:3,t:'刺身盛り合わせの盛付',f:'図中心',read:4,date:'9/20',steps:['大根のけんを敷く','奥から手前へ盛る','わさびと醤油皿を添える']},
 {id:4,t:'閉店・清掃チェック',f:'チェックリスト型',read:6,date:'9/18',steps:['火元・ガス栓の確認','床とトイレの清掃','売上の締め作業','施錠']},
 {id:5,t:'お会計とレジ操作',f:'文章中心',read:2,date:'9/12',steps:['伝票を確認','合計を声に出す','お預かり金額を復唱','レシートと釣り銭を渡す']},
 {id:6,t:'アレルギー対応の声かけ',f:'図中心',read:4,date:'9/10',steps:['注文時に苦手な食材を確認','厨房へ必ず口頭で共有','提供時に再確認']}
];
var MENU=[
 {id:1,n:'刺身盛り合わせ',p:1480,al:['えび','さば'],sold:false,steps:['盛付けカードを確認','けんを敷く','奥から盛る']},
 {id:2,n:'鶏の唐揚げ',p:680,al:['小麦','卵','大豆'],sold:false,steps:['下味済みを揚げる','170℃で5分','油を切って盛る']},
 {id:3,n:'焼き鳥盛り合わせ',p:880,al:[],sold:false,steps:['串を網に並べる','タレを塗る']},
 {id:4,n:'だし巻き玉子',p:580,al:['卵'],sold:false,steps:['卵液を作る','3回に分けて巻く']},
 {id:5,n:'枝豆',p:380,al:['大豆'],sold:false,steps:['塩ゆで','塩をふる']},
 {id:6,n:'ポテトサラダ',p:480,al:['卵','乳'],sold:true,steps:['仕込み済みを盛る']},
 {id:7,n:'海鮮サラダ',p:780,al:['えび','かに'],sold:false,steps:['野菜を盛る','刺身をのせる','ドレッシング']},
 {id:8,n:'〆の鯛茶漬け',p:780,al:['小麦','ごま'],sold:false,steps:['ご飯をよそう','鯛をのせる','だしをかける']}
];
var RECIPES=[
 {n:'だし巻き玉子',ing:[['卵','卵','3個'],['だ','だし','60ml'],['塩','塩','ひとつまみ'],['砂','砂糖','小さじ1']],
  steps:[['卵を割りほぐす','白身を切るように混ぜる',0],['だしと調味料を混ぜる','泡立てないように',0],['卵液を1/3流す','中火。表面が半熟で巻く',60],['2回目を流し入れる','巻いた卵の下にも流す',60],['形を整えて盛り付け','大根おろしを添える',0]],
  warn:'卵は必ず加熱。アレルゲン「卵」を提供時に確認'},
 {n:'鶏の唐揚げ',ing:[['鶏','鶏もも','200g'],['下','下味','大さじ2'],['粉','粉','適量'],['油','油','170℃']],
  steps:[['下味の鶏肉に粉をまぶす','余分な粉は払う',0],['170℃の油で揚げる','入れすぎ注意',300],['一度取り出して休ませる','余熱で火を通す',60],['仕上げ揚げ','きつね色になるまで',60],['油を切って盛り付け','レモンを添える',0]],
  warn:'油はね注意。アレルゲン「小麦・卵・大豆」'}
];
var REQS=[
 {t:'マニュアルに動画を貼りたい',c:'マニュアル',s:'開発中',d:'9/20'},
 {t:'予約状況と連携してほしい',c:'その他',s:'検討中',d:'9/27'},
 {t:'文字をもっと大きくしたい',c:'見やすさ',s:'完了',d:'9/05'}
];
var QUIZ=[{q:'生ビールの泡の量は？',o:['指2本分','なくていい','グラスの半分'],a:0},{q:'冷蔵庫の温度の目安は？',o:['5℃以下','10℃','15℃'],a:0},{q:'アレルギーの確認はいつ？',o:['注文時と提供時','提供時のみ','聞かない'],a:0}];
var WORDS=['「ありがとう」は、お客様への魔法の言葉です。','お皿を置く前に、ひと呼吸。笑顔で目を合わせましょう。'];
var LANGS=['やさしい日本語','English','Tiếng Việt','中文','한국어','Bahasa Indonesia'];
var DQ=[
 {q:'忙しいとき、声をかけられると…',o:[['ありがたい、助かる','call'],['手を止めて内容をしっかり聞く','careful'],['集中が切れて少しつらい','solo'],['動きながら一緒に考える','team']]},
 {q:'ミスをしたとき、まず…',o:[['すぐ誰かに話して相談する','call'],['原因をじっくり振り返る','careful'],['自分で直して次に生かす','solo'],['とにかくすぐ取り返しに動く','speed']]},
 {q:'新しい作業を覚えるときは…',o:[['手順書を読んでから始める','careful'],['やりながら体で覚える','speed'],['先輩と一緒にやりたい','team'],['一人で試してみたい','solo']]},
 {q:'仕事でいちばん嬉しいのは…',o:[['「ありがとう」と声をかけられた','call'],['ミスなく完璧にできた','careful'],['チーム全体がうまくいった','team'],['難しい仕事をやりきった','speed']]},
 {q:'休憩時間は…',o:[['みんなでおしゃべり','team'],['静かに一人で過ごす','solo'],['軽く声をかけ合う','call'],['次の仕事の準備をする','careful']]}
];
var CHECK={open:['看板・のれんを出す','手洗い・消毒','冷蔵庫の温度確認','おしぼり・箸の補充','レジ釣り銭の確認'],close:['火元・ガス栓の確認','床・トイレ清掃','まな板・包丁の消毒','売上の締め','施錠']};
var ONB=['制服・身だしなみを確認','店内案内と動線を覚える','お客様への挨拶を練習','オーダーの取り方を覚える','配膳の基本を覚える','レジ操作の見学','アレルギー対応の説明を受ける'];
var PO={type:['定食屋','居酒屋','レストラン','カフェ'],mood:['和風','洋風','シンプル','にぎやか'],use:['新メニュー','お知らせ','日替わり']};
var PAL={'和風':['#f3e7d3','#8c2f2b','#3b2a1d'],'洋風':['#1f2d4a','#c9a24b','#ffffff'],'シンプル':['#ffffff','#555555','#222222'],'にぎやか':['#ffe08a','#e8743b','#4a2a10']};
var PT={'新メニュー':'新メニュー登場','お知らせ':'お知らせ','日替わり':'本日の日替わり'};
/* ===== ナビ構成 ===== */
var NAV=FULL?[['home','ホーム'],['manual','マニュアル'],['menu','メニュー設定'],['kitchen','厨房ビュー'],['diag','スタッフ診断'],['staff','スタッフ'],['promo','広報'],['request','運営への要望'],['settings','設定']]
 :[['home','ホーム'],['manual','マニュアル'],['kitchen','厨房ビュー'],['staff','スタッフ']];
var EXTRA=FULL?[['onboarding','新人オンボーディング'],['checklist','開店・閉店チェック'],['lang','多言語切替'],['quiz','今日のひとこと・クイズ'],['praise','褒める']]:[];
var TAB=FULL?[['home','ホーム'],['manual','マニュアル'],['menu','メニュー'],['kitchen','厨房'],['more','その他']]:NAV;
var TABOF={};NAV.forEach(function(n){TABOF[n[0]]=n[0]});
if(FULL){['diag','staff','promo','request','settings','onboarding','checklist','lang','quiz','praise'].forEach(function(k){TABOF[k]='more'})}
/* ===== util ===== */
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var state={wiz:{step:1,tpl:0},dq:{i:0,ans:[]},fs:'m',promo:{type:'居酒屋',mood:'和風',use:'新メニュー',pick:0}};
var toastT;
function toast(){var t=$('#toast');t.textContent='モックアップのため操作できません';t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2200)}
var D=function(label,cls){return '<button class="btn '+(cls||'')+'" data-dummy>'+label+'</button>'};
function back(h,l){return '<a class="back" href="#/'+h+'">'+ic('left')+l+'</a>'}
function head(t,l){return '<h1>'+t+'</h1>'+(l?'<p class="lead">'+l+'</p>':'')}
function tile(c){return '<div class="ico">'+esc(c.charAt(0))+'</div>'}
function graph(a){var w=300,h=110,p=14,xs=(w-2*p)/(a.length-1),pts=a.map(function(v,i){return (p+i*xs).toFixed(1)+','+(h-p-(v/100)*(h-2*p)).toFixed(1)});
 return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="モチベーション推移（ダミー）"><rect width="'+w+'" height="'+h+'" rx="12" fill="#fff8f0"/><polyline fill="none" stroke="#b9501f" stroke-width="3" points="'+pts.join(' ')+'"/>'+pts.map(function(q){var c=q.split(',');return '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="4.5" fill="#b9501f"/>'}).join('')+'</svg><div class="row between" style="font-size:.75rem;color:#7f6857"><span>5ヶ月前</span><span>今月</span></div>'}
function st(id){return STAFF.filter(function(s){return s.id==id})[0]}
function pill(s){return '<span class="tag">'+TYPES[s.t].n+'</span>'}
function lcard(h,i,t,sub){return '<a class="card link-card" href="#/'+h+'"><div class="ico">'+ic(i)+'</div><div class="grow"><b>'+t+'</b>'+(sub?'<br>'+sub:'')+'</div></a>'}
/* ===== 広報画像（SVGプレースホルダー） ===== */
function cand(i,p){var c=PAL[p.mood],bg=c[0],mc=c[1],ink=c[2],title=PT[p.use],shop=SHOP.name,s='<svg viewBox="0 0 200 200" role="img" aria-label="広報画像のサンプル表示 案'+'ABC'.charAt(i)+'"><defs><pattern id="h'+i+'" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="'+mc+'" stroke-opacity=".25" stroke-width="3"/></pattern></defs>';
 var T='font-family="Hiragino Sans,Noto Sans JP,Yu Gothic,Meiryo,sans-serif" font-weight="700" text-anchor="middle"';
 if(i==0){s+='<rect width="200" height="200" fill="'+bg+'"/><rect x="20" y="20" width="160" height="110" rx="6" fill="url(#h'+i+')" stroke="'+mc+'" stroke-width="2"/><text x="100" y="80" '+T+' font-size="12" fill="'+mc+'">料理写真の枠</text><text x="100" y="162" '+T+' font-size="20" fill="'+ink+'">'+title+'</text><text x="100" y="184" '+T+' font-size="11" fill="'+ink+'">'+shop+'</text>'}
 if(i==1){s+='<rect width="200" height="200" fill="'+bg+'"/><rect width="200" height="124" fill="url(#h'+i+')"/><text x="100" y="66" '+T+' font-size="12" fill="'+mc+'">料理写真の枠</text><rect y="124" width="200" height="76" fill="'+mc+'"/><text x="100" y="158" '+T+' font-size="20" fill="'+bg+'">'+title+'</text><text x="100" y="180" '+T+' font-size="11" fill="'+bg+'">'+shop+'</text>'}
 if(i==2){s+='<rect width="200" height="200" fill="'+mc+'"/><rect x="10" y="10" width="180" height="180" rx="8" fill="none" stroke="'+bg+'" stroke-width="2"/><rect x="24" y="24" width="152" height="120" rx="60" fill="url(#h'+i+')" stroke="'+bg+'" stroke-width="2"/><text x="100" y="88" '+T+' font-size="12" fill="'+bg+'">料理写真の枠</text><text x="100" y="166" '+T+' font-size="19" fill="'+bg+'">'+title+'</text><text x="100" y="184" '+T+' font-size="10" fill="'+bg+'">'+shop+'</text>'}
 return s+'<text x="190" y="14" text-anchor="end" font-size="9" font-family="sans-serif" fill="#999">SAMPLE</text></svg>'}
/* ===== views ===== */
var V={};
V.home=function(){
 var h=head('おはようございます',SHOP.name+' ／ 今日は10月1日（木）')+
 '<div class="card"><h3>今日の通知</h3><p style="margin:4px 0">・ミンさんが「生ビールの注ぎ方」を読みました</p><p style="margin:4px 0">・「アレルギー対応」の更新が1件あります</p><p style="margin:4px 0">・りくさんの元気度が下がり気味です</p></div>'+
 '<div class="grid c2">'+lcard('manual','book','未確認マニュアル','<span class="tag r">3本</span> が未読です')+lcard('staff','staff','スタッフの様子','<span class="tag g">元気 4名</span> <span class="tag y">要声かけ 2名</span>')+'</div>'+
 '<div class="card"><h3>今日のひとこと</h3><p>'+WORDS[0]+'</p>'+(FULL?'<a class="btn ghost block" href="#/quiz">ミニクイズに挑戦</a>':'')+'</div>'+
 lcard('promo','promo','広報画像をつくる','料理写真から、投稿用の画像案を作ります');
 if(FULL){h+='<h2>よく使う機能</h2><div class="grid c2">'+EXTRA.map(function(x){return lcard(x[0]=='praise'?'praise/1':x[0],x[0],x[1])}).join('')+'</div><a class="btn block big" href="#/request" style="margin-top:8px">運営への要望を送る</a><p style="text-align:center"><a class="back" href="../simple/index.html">シンプル版を見る</a></p>'}
 else h+='<p style="text-align:center"><a class="back" href="../full/index.html">詳細版を見る</a></p>';
 return h};
V.more=function(){return head('その他の機能','')+'<div class="grid c2">'+NAV.slice(4).concat(EXTRA).map(function(x){return lcard(x[0]=='praise'?'praise/1':x[0],x[0],x[1])}).join('')+'</div>'};
V.manual=function(){
 return head('マニュアル','店のやり方を、写真と一言で残せます')+'<a class="btn block big" href="#/manual/new" style="margin-bottom:14px">新しいマニュアルをつくる</a>'+
 MANUALS.map(function(m){return '<a class="card link-card" href="#/manual/'+m.id+'">'+tile(m.t)+'<div class="grow"><b>'+m.t+'</b><br><span class="tag">'+m.f+'</span> <span class="tag '+(m.read<6?'y':'g')+'">既読 '+m.read+'/6</span></div></a>'}).join('')};
V.manualNew=function(){
 var w=state.wiz,tp=['手順書','盛付け図解','チェックリスト','動画つき'],body='';
 if(w.step==1)body='<h2>1. テンプレートを選ぶ</h2>'+tp.map(function(x,i){return '<button class="opt '+(w.tpl==i?'on':'')+'" data-act="tpl" data-v="'+i+'">'+x+'</button>'}).join('');
 if(w.step==2)body='<h2>2. 写真を撮る</h2><div class="thumb">'+ic('camera')+'写真が入ります</div><div class="row" style="margin-top:12px">'+D('カメラで撮る','grow')+D('写真を選ぶ','grow ghost')+'</div>';
 if(w.step==3)body='<h2>3. 一言説明を書く</h2><textarea placeholder="例：泡は指2本分まで入れる"></textarea><div style="margin-top:10px">'+D('音声で入力','block ghost')+'</div><p class="lead" style="margin-top:12px">あとはAIが整えて、手順書にします（想定）</p>';
 if(w.step==4)body='<h2>4. 完成イメージ</h2><div class="card"><div class="thumb">'+ic('image')+'写真が入ります</div><h3 style="margin-top:10px">新しいマニュアル（サンプル）</h3><p>一言説明から自動で整形されたイメージです。</p></div>'+D('この内容で公開','block big green');
 return back('manual','マニュアル一覧')+head('マニュアルをつくる','3ステップで完成')+'<div class="steps">'+[1,2,3,4].map(function(i){return '<i class="'+(i<=w.step?'on':'')+'"></i>'}).join('')+'</div>'+body+
 '<div class="row" style="margin-top:16px">'+(w.step>1?'<button class="btn ghost grow" data-act="wiz" data-v="-1">戻る</button>':'')+(w.step<4?'<button class="btn grow" data-act="wiz" data-v="1">次へ</button>':'')+'</div>'};
V.manualView=function(id){var m=MANUALS[id-1];if(!m)return null;
 return back('manual','マニュアル一覧')+head(m.t,'<span class="tag">'+m.f+'</span> 更新 '+m.date)+
 '<div class="card"><div class="thumb">'+ic('image')+'写真・図が入ります</div></div>'+m.steps.map(function(s,i){return '<div class="card row"><div class="n">'+(i+1)+'</div><div class="grow"><b>'+s+'</b></div></div>'}).join('')+
 '<div class="card"><h3>読みましたか？理解度は？</h3><div class="row wrap">'+D('まだ不安','ghost grow')+D('だいたいOK','ghost grow')+D('バッチリ','grow')+'</div></div>'+
 (FULL?'<a class="btn ghost block" href="#/manual/'+m.id+'/read">スタッフ別の既読状況を見る</a>':'')};
V.manualRead=function(id){var m=MANUALS[id-1];if(!m)return null;
 var lv=['高','中','低','—'];
 return back('manual/'+id,'マニュアルに戻る')+head('既読・理解度',m.t)+'<div class="card"><table class="table"><tr><th>スタッフ</th><th>状況</th><th>理解度</th></tr>'+STAFF.map(function(s,i){var r=i<m.read;return '<tr><td>'+s.name.split(' ')[0]+'</td><td><span class="tag '+(r?'g':'r')+'">'+(r?'既読':'未読')+'</span></td><td>'+(r?lv[i%3]:lv[3])+'</td></tr>'}).join('')+'</table></div>'+D('未読の人に通知する','block')};
V.menu=function(){return head('メニュー設定','8品 ／ 売切れはスイッチで切替（表示のみ）')+'<div style="margin-bottom:14px">'+D('メニューを追加','block')+'</div>'+
 '<div class="grid c2">'+MENU.map(function(m){return '<a class="card link-card" href="#/menu/'+m.id+'">'+tile(m.n)+'<div class="grow"><b>'+m.n+'</b><br>¥'+m.p.toLocaleString()+' '+(m.sold?'<span class="tag r">売切れ</span>':'<span class="tag g">提供中</span>')+'</div></a>'}).join('')+'</div>'};
V.menuEdit=function(id){var m=MENU[id-1];if(!m)return null;
 return back('menu','メニュー一覧')+head(m.n+' の編集','')+'<div class="card"><div class="thumb">'+ic('image')+'料理写真</div><div style="margin-top:10px">'+D('写真を変える','ghost block')+'</div>'+
 '<label class="f">料理名</label><input type="text" value="'+esc(m.n)+'" readonly><label class="f">価格（税込）</label><input type="text" value="¥'+m.p+'" readonly>'+
 '<label class="f">アレルゲン</label><div class="chips">'+['卵','乳','小麦','えび','かに','そば','落花生','大豆','ごま','さば'].map(function(a){return '<span class="opt '+(m.al.indexOf(a)>=0?'on':'')+'" data-toggle>'+a+'</span>'}).join('')+'</div>'+
 '<label class="f">提供手順</label>'+m.steps.map(function(s,i){return '<div class="row" style="margin-bottom:6px"><span class="tag">'+(i+1)+'</span> '+s+'</div>'}).join('')+
 '<div class="row between" style="margin-top:16px"><b>売切れにする</b><button class="sw '+(m.sold?'on':'')+'" data-toggle aria-label="売切れ切替"></button></div></div>'+D('保存する','block big')+'<div style="margin-top:8px">'+D('削除する','block ghost')+'</div>'};
V.kitchen=function(id){var r=RECIPES[id||0];if(!r)return null;
 return '<div class="kit">'+head(r.n+'（厨房ビュー）','')+'<div class="row wrap" style="margin-bottom:14px">'+RECIPES.map(function(x,i){return '<a class="btn '+(x==r?'':'ghost')+' grow" href="#/kitchen/'+i+'">'+x.n+'</a>'}).join('')+'</div>'+
 '<div class="card"><h3>材料と分量</h3><div class="ing">'+r.ing.map(function(i){return '<div><div class="ico">'+i[0]+'</div><b>'+i[2]+'</b>'+i[1]+'</div>'}).join('')+'</div></div>'+
 '<div class="mark-red">注意：'+r.warn+'</div><h2>工程</h2>'+
 r.steps.map(function(s,i){return '<div class="card"><div class="kstep"><div class="row"><div class="n">'+(i+1)+'</div><div><b style="font-size:1.25rem">'+s[0]+'</b><br>'+s[1]+'</div></div>'+
  '<div class="row between">'+(s[2]?'<span class="timer">'+String(Math.floor(s[2]/60)).padStart(2,'0')+':'+String(s[2]%60).padStart(2,'0')+'</span>'+D('スタート','big'):'<span class="tag">タイマーなし</span>')+'</div></div></div>'}).join('')+
 '<div class="card"><h3>盛り付け完成図</h3><div class="plate">ここに完成写真・図が入ります</div></div>'+
 '<div class="grid c2">'+D('前の工程','big ghost')+D('次の工程','big')+'</div></div>'};
V.diag=function(){var d=state.dq,q=DQ[d.i];
 return head('スタッフ診断','全5問・1分で終わります')+'<div class="steps">'+DQ.map(function(_,i){return '<i class="'+(i<=d.i?'on':'')+'"></i>'}).join('')+'</div><div class="card"><span class="tag">Q'+(d.i+1)+' / '+DQ.length+'</span><div class="big-q">'+q.q+'</div>'+
 q.o.map(function(o){return '<button class="opt" data-act="ans" data-v="'+o[1]+'">'+o[0]+'</button>'}).join('')+'</div>'+(d.i>0?'<button class="btn ghost" data-act="dback">前の質問へ戻る</button>':'')};
V.diagResult=function(k){var t=TYPES[k];if(!t)return null;
 return head('診断結果','')+'<div class="card" style="text-align:center"><div class="ico" style="margin:0 auto 8px;width:72px;height:72px;font-size:2rem;border-radius:50%">'+esc(t.n.charAt(0))+'</div><h1>'+t.n+'</h1><p>'+t.d+'</p></div>'+
 '<div class="card"><h3>合うマニュアルの形</h3><p><b>'+t.m+'</b></p><p>'+t.md+'</p></div>'+
 '<div class="card"><h3>先輩・上司へのおすすめ</h3><ul style="padding-left:1.2em;margin:0">'+t.a.map(function(a){return '<li>'+a+'</li>'}).join('')+'</ul></div>'+
 '<div class="alert">診断は参考情報であり、本人の同意のもとで活用します。</div><div class="row wrap" style="margin-top:14px"><a class="btn grow" href="#/diag">もう一度診断する</a><a class="btn ghost grow" href="#/staff">スタッフ一覧へ</a></div>'};
V.staff=function(){return head('スタッフ一覧','6名')+STAFF.map(function(s){return '<a class="card link-card" href="#/staff/'+s.id+'"><div class="avatar">'+s.name.charAt(0)+'</div><div class="grow"><b>'+s.name+'</b> <small>'+s.role+'</small><br>'+pill(s)+'<div class="bar" style="margin-top:6px"><i style="width:'+s.lv+'%"></i></div><small>習熟度 '+s.lv+'%</small></div></a>'}).join('')};
V.staffDetail=function(id){var s=st(id);if(!s)return null;var t=TYPES[s.t];
 return back('staff','スタッフ一覧')+'<div class="card row"><div class="avatar">'+s.name.charAt(0)+'</div><div><h1 style="margin:0">'+s.name+'</h1>'+s.role+' ／ '+s.since+'<br>'+pill(s)+'</div></div>'+
 '<div class="card"><h3>推奨マニュアル形式</h3><b>'+t.m+'</b><h3 style="margin-top:14px">習熟度 '+s.lv+'%</h3><div class="bar"><i style="width:'+s.lv+'%"></i></div></div>'+
 '<div class="card"><h3>モチベーションの推移（ダミー）</h3>'+graph(s.mot)+'</div>'+
 '<div class="card"><h3>1on1メモ</h3><textarea placeholder="例：来月からレジを任せたい。本人も前向き。"></textarea><div style="margin-top:8px">'+D('メモを保存','block')+'</div></div>'+
 '<div class="card"><h3>観察メモ</h3><p class="lead" style="margin:0 0 8px">口癖・目線・動きなどを記録する想定です</p><p style="margin:4px 0">・口癖：「大丈夫です！」が多い</p><p style="margin:4px 0">・目線：レジ周りをよく見ている</p><p style="margin:4px 0">・動き：混雑時に先に動いてくれる</p><textarea placeholder="気づいたことを記録"></textarea><div style="margin-top:8px">'+D('観察メモを追加','block ghost')+'</div></div>'+
 (FULL?'<a class="btn block big" href="#/praise/'+s.id+'">'+s.name.split(' ')[0]+'さんを褒める</a>':'')};
V.praise=function(id){var s=st(id);if(!s)return null;
 return back('staff/'+s.id,'スタッフ詳細')+head('褒める','感謝やフィードバックを届けます')+'<div class="card"><label class="f" style="margin-top:0">送る相手</label><div class="chips">'+STAFF.map(function(x){return '<a class="opt '+(x==s?'on':'')+'" href="#/praise/'+x.id+'">'+x.name.split(' ')[0]+'</a>'}).join('')+'</div>'+
 '<label class="f">スタンプ</label><div class="chips">'+['ナイス！','ありがとう','成長したね','頼りになる'].map(function(x){return '<span class="opt" data-toggle>'+x+'</span>'}).join('')+'</div><label class="f">ひとこと</label><textarea placeholder="例：昨日の混雑時、すごく助かった！"></textarea></div>'+D('送る','block big')};
V.request=function(){return head('運営への要望','3タップで送れます')+'<div class="card"><label class="f" style="margin-top:0">1. カテゴリ</label><div class="chips">'+['マニュアル','メニュー','スタッフ','見やすさ','その他'].map(function(x){return '<span class="opt" data-pick>'+x+'</span>'}).join('')+'</div>'+
 '<label class="f">2. ひとこと</label><input type="text" placeholder="こんな機能がほしい"><label class="f">3. 緊急度</label><div class="chips">'+['いつでも','普通','急ぎ'].map(function(x){return '<span class="opt" data-pick>'+x+'</span>'}).join('')+'</div><div style="margin-top:14px">'+D('送信する','block big')+'</div></div>'+
 '<h2>送信済みの要望</h2>'+REQS.map(function(r){return '<div class="card"><b>'+r.t+'</b><br><span class="tag b">'+r.c+'</span> <span class="tag '+(r.s=='完了'?'g':r.s=='開発中'?'y':'')+'">'+r.s+'</span> <small>'+r.d+'</small></div>'}).join('')};
V.settings=function(){var f=state.fs;
 var qr='<svg viewBox="0 0 21 21" width="160" height="160" shape-rendering="crispEdges" role="img" aria-label="ダミーのQRコード"><rect width="21" height="21" fill="#fff"/>'+(function(){var o='',i,j;for(i=0;i<21;i++)for(j=0;j<21;j++){var fin=(i<7&&j<7)||(i<7&&j>13)||(i>13&&j<7);var on=fin?(i%6==0||j%6==0||(i%6>=2&&i%6<=4&&j%6>=2&&j%6<=4)):((i*7+j*13+i*j)%3==0);if(on)o+='<rect x="'+j+'" y="'+i+'" width="1" height="1" fill="#4a3322"/>'}return o})()+'</svg>';
 return head('設定','')+'<div class="card"><h3>店舗情報</h3><p style="margin:2px 0"><b>'+SHOP.name+'</b></p><p style="margin:2px 0">'+SHOP.addr+'</p><p style="margin:2px 0">営業 '+SHOP.hours+'</p><div style="margin-top:8px">'+D('変更する','ghost block')+'</div></div>'+
 '<div class="card" style="text-align:center"><h3>スタッフ招待（QR）</h3>'+qr+'<p class="lead">ダミーのQRです。読み取れません</p>'+D('招待リンクをコピー','ghost block')+'</div>'+
 '<div class="card"><h3>プラン</h3><p><span class="tag g">スタンダード（例）</span> 月額 0,000円（仮）</p>'+D('プランを変更','ghost block')+'</div>'+
 '<div class="card"><h3>文字サイズ <span class="tag y">実際に動きます</span></h3><div class="chips">'+[['s','小'],['m','中'],['l','大']].map(function(x){return '<button class="opt '+(f==x[0]?'on':'')+'" data-act="fs" data-v="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div></div>'};
V.onboarding=function(){var n=3;return back('home','ホーム')+head('新人オンボーディング','ミンさん（1ヶ月目）')+'<div class="card"><b>進捗 '+n+' / '+ONB.length+'</b><div class="bar" style="margin:8px 0"><i style="width:'+Math.round(n/ONB.length*100)+'%"></i></div></div>'+ONB.map(function(x,i){return '<button class="chk '+(i<n?'done':'')+'" data-toggle><span class="box"></span><span class="t">'+x+'</span></button>'}).join('')};
V.checklist=function(){function l(a){return a.map(function(x){return '<button class="chk" data-toggle><span class="box"></span><span class="t">'+x+'</span></button>'}).join('')}
 return back('home','ホーム')+head('衛生・開店閉店チェック','タップで完了表示（保存されません）')+'<h2>開店前</h2>'+l(CHECK.open)+'<h2>閉店後</h2>'+l(CHECK.close)};
V.lang=function(){return back('home','ホーム')+head('多言語切替','外国人スタッフ向け（表示のみ）')+'<div class="card"><div class="chips">'+LANGS.map(function(x,i){return '<span class="opt '+(i==0?'on':'')+'" data-pick>'+x+'</span>'}).join('')+'</div></div><div class="card"><h3>表示サンプル</h3><p>開店準備：<b>おしぼりを　ならべます</b></p><p class="lead">※実際の翻訳は動きません</p></div>'+D('この言語で表示','block')};
V.quiz=function(){return back('home','ホーム')+head('今日のひとこと','')+'<div class="card"><p style="font-size:1.1rem">'+WORDS[1]+'</p></div><h2>ミニクイズ</h2>'+QUIZ.map(function(q,qi){return '<div class="card"><b>Q'+(qi+1)+'. '+q.q+'</b><div style="margin-top:10px">'+q.o.map(function(o,i){return '<button class="opt" data-act="quiz" data-ok="'+(i==q.a?1:0)+'">'+o+'</button>'}).join('')+'</div></div>'}).join('')};
/* 広報画像づくり（4ステップ） */
V.promo=function(n){n=+n||1;if(n<1||n>4)return null;var p=state.promo,body='';
 var notes='<div class="alert">料理そのものはAIで生成しません。実際の写真を加工します。</div><div class="alert">AIの出力は参考案です。必ず内容を確認してから使用してください。</div>';
 if(n==1)body='<h2>写真を選ぶ</h2><div class="thumb" style="aspect-ratio:16/10">'+ic('image')+'料理写真の枠（ダミー）</div><p class="lead" style="margin-top:10px">実物の料理写真を使います。</p><div class="row" style="margin-bottom:6px">'+D('写真を撮る','grow')+D('写真を選ぶ','grow ghost')+'</div>';
 if(n==2){function grp(k,l){return '<label class="f">'+l+'</label><div class="chips">'+PO[k].map(function(x){return '<button class="opt '+(p[k]==x?'on':'')+'" data-act="pset" data-k="'+k+'" data-v="'+x+'">'+x+'</button>'}).join('')+'</div>'}
  body='<h2>テイストを選ぶ</h2>'+grp('type','店のタイプ')+grp('mood','雰囲気')+grp('use','用途')}
 if(n==3)body='<h2>候補から選ぶ</h2><div class="alert">サンプル表示です。実際の画像ではなく、色と枠だけの見本です。文字はアプリ側で重ねる想定です。</div><div class="grid c3">'+[0,1,2].map(function(i){return '<button class="cand '+(p.pick==i?'on':'')+'" data-act="ppick" data-v="'+i+'">'+cand(i,p)+'<div class="cap"><b>案'+'ABC'.charAt(i)+'</b><span class="tag">サンプル表示</span></div></button>'}).join('')+'</div>';
 if(n==4)body='<h2>保存・書き出し</h2><div class="card" style="max-width:340px;margin-left:auto;margin-right:auto;padding:8px">'+cand(p.pick,p)+'<div class="cap" style="padding:8px"><b>案'+'ABC'.charAt(p.pick)+'</b> <span class="tag">サンプル表示</span></div></div><p class="lead" style="text-align:center">'+p.type+' ／ '+p.mood+' ／ '+p.use+'</p><div class="grid c2">'+D('保存','big')+D('投稿用に書き出す','big ghost')+'</div>';
 return back(n>1?'promo/'+(n-1):'home',n>1?'前のステップ':'ホーム')+head('広報画像をつくる','ステップ '+n+' / 4')+'<div class="steps">'+[1,2,3,4].map(function(i){return '<i class="'+(i<=n?'on':'')+'"></i>'}).join('')+'</div>'+notes+body+
 (n<4?'<a class="btn block big" style="margin-top:16px" href="#/promo/'+(n+1)+'">次へ</a>':'')};
/* ===== router ===== */
function route(){
 var h=(location.hash||'#/home').replace(/^#\/?/,''),p=h.split('/'),k=p[0]||'home',html=null,key=k;
 var ok=NAV.some(function(n){return n[0]==k})||(FULL?EXTRA.some(function(n){return n[0]==k})||k=='more':false)||k=='promo'||(k=='manual')||k=='kitchen';
 if(ok){
  if(k=='manual'&&p[1]=='new')html=V.manualNew();
  else if(k=='manual'&&p[1]&&p[2]=='read'&&FULL)html=V.manualRead(p[1]);
  else if(k=='manual'&&p[1])html=V.manualView(p[1]);
  else if(k=='menu'&&p[1])html=V.menuEdit(p[1]);
  else if(k=='diag'&&p[1]=='result')html=V.diagResult(p[2]);
  else if(k=='staff'&&p[1])html=V.staffDetail(p[1]);
  else if(k=='kitchen')html=V.kitchen(p[1]);
  else if(k=='praise')html=V.praise(p[1]||1);
  else if(k=='promo')html=V.promo(p[1]);
  else if(!p[1]&&V[k])html=V[k]();
 }
 if(html===null){key='fallback';html=V.home()}
 $('#view').innerHTML=html;$('#view').setAttribute('data-k',key);
 var cur=TABOF[k]||'';
 $('#side').innerHTML='<div class="logo">ShopNavi'+(FULL?'':'（シンプル版）')+'</div>'+NAV.map(function(n){return '<a href="#/'+n[0]+'" class="'+(n[0]==k?'on':'')+'">'+ic(n[0])+n[1]+'</a>'}).join('')+(EXTRA.length?'<hr>':'')+EXTRA.map(function(n){return '<a href="#/'+(n[0]=='praise'?'praise/1':n[0])+'" class="'+(n[0]==k?'on':'')+'">'+ic(n[0])+n[1]+'</a>'}).join('');
 $('#tabs').innerHTML=TAB.map(function(n){return '<a href="#/'+n[0]+'" class="'+(n[0]==cur?'on':'')+'">'+ic(n[0])+n[1]+'</a>'}).join('');
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
/* ===== events ===== */
document.addEventListener('click',function(e){
 var el=e.target.closest('[data-dummy],[data-act],[data-toggle],[data-pick]');if(!el)return;
 if(el.hasAttribute('data-dummy')){e.preventDefault();toast();return}
 if(el.hasAttribute('data-toggle')){el.classList.toggle(el.classList.contains('chk')?'done':'on');return}
 if(el.hasAttribute('data-pick')){var g=el.parentNode;[].forEach.call(g.children,function(c){c.classList.remove('on')});el.classList.add('on');return}
 var a=el.getAttribute('data-act'),v=el.getAttribute('data-v');
 if(a=='tpl'){state.wiz.tpl=+v;route()}
 else if(a=='wiz'){state.wiz.step=Math.max(1,Math.min(4,state.wiz.step+ +v));route()}
 else if(a=='pset'){state.promo[el.getAttribute('data-k')]=v;route()}
 else if(a=='ppick'){state.promo.pick=+v;route()}
 else if(a=='ans'){state.dq.ans.push(v);state.dq.i++;
  if(state.dq.i>=DQ.length){var c={};state.dq.ans.forEach(function(k){c[k]=(c[k]||0)+1});var best=Object.keys(c).sort(function(x,y){return c[y]-c[x]})[0];state.dq={i:0,ans:[]};location.hash='#/diag/result/'+best}else route()}
 else if(a=='dback'){state.dq.i--;state.dq.ans.pop();route()}
 else if(a=='fs'){state.fs=v;document.documentElement.setAttribute('data-fs',v);route()}
 else if(a=='quiz'){var okk=el.getAttribute('data-ok')=='1';el.classList.add(okk?'ok':'ng');el.textContent=(okk?'正解！ ':'残念… ')+el.textContent}
});
route();
})();
