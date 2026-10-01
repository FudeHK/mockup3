(function(){
'use strict';
/* ===== ダミーデータ（すべて架空） ===== */
var SHOP={name:'居酒屋 みなと亭',addr:'〇〇県△△市みなと町1-2-3（架空）',tel:'000-0000-0000',hours:'17:00〜24:00（L.O. 23:30）'};
var TYPES={
 careful:{n:'じっくり確認型',e:'🔍',d:'手順を理解してから動くタイプ。ミスが少なく、正確さが強み。',m:'図中心＋チェックリスト型',md:'工程ごとに図解された手順書と、確認用チェックリストが合います。',a:['作業の「理由」まで説明する','急かさず、考える時間を渡す','正確さを具体的に褒める']},
 call:{n:'声かけ歓迎型',e:'💬',d:'対話の中で学び、安心して力を出すタイプ。',m:'動画中心＋対話型',md:'先輩の実演動画を見て、あとで質問できる形が合います。',a:['こまめに声をかけ、小さな成功を伝える','困っていないか、定期的に聞く','1on1の時間を月1回はとる']},
 solo:{n:'ひとりで集中型',e:'🎧',d:'任されると力を発揮する、マイペースな集中タイプ。',m:'文章中心＋要点メモ型',md:'必要なときに自分で読み返せる、簡潔な文章手順が合います。',a:['役割を任せ、結果で認める','忙しい時間帯は声かけを最小限に','質問しやすい合図を決めておく']},
 speed:{n:'まず動く型',e:'⚡',d:'やりながら覚える行動派。スピード感が強み。',m:'短い動画＋写真つきカード型',md:'30秒の動画と写真つきの要点カードが合います。',a:['まず任せて、あとで一緒に振り返る','抜けやすい点だけ事前に伝える','スピードを認めつつ確認を習慣に']},
 team:{n:'みんなで進める型',e:'🤝',d:'周りと協力すると力が出る、場を和ませるタイプ。',m:'図中心＋ペア練習型',md:'ペアで練習できる図解マニュアルが合います。',a:['ペア・チームで取り組む機会を作る','感謝の言葉をチームの前で伝える','後輩指導の役割を任せる']}
};
var STAFF=[
 {id:1,name:'港 ひなた',role:'ホールリーダー',e:'🧑‍🍳',t:'call',lv:85,mot:[60,65,62,75,80,84],since:'3年目'},
 {id:2,name:'浜田 けんと',role:'調理',e:'👨‍🍳',t:'careful',lv:78,mot:[70,72,68,70,74,76],since:'5年目'},
 {id:3,name:'岬 みお',role:'ホール',e:'👩',t:'team',lv:60,mot:[50,58,60,55,62,70],since:'1年目'},
 {id:4,name:'波止 りく',role:'調理補助',e:'🧑',t:'speed',lv:45,mot:[80,76,70,64,58,52],since:'3ヶ月'},
 {id:5,name:'ミン（留学生）',role:'ホール',e:'🧑‍🎓',t:'solo',lv:35,mot:[55,60,66,68,72,78],since:'1ヶ月',lang:'ベトナム語'},
 {id:6,name:'潮見 あおい',role:'ホール・レジ',e:'👧',t:'careful',lv:70,mot:[65,66,70,72,71,73],since:'2年目'}
];
var MANUALS=[
 {id:1,t:'開店準備の手順',e:'🌅',f:'チェックリスト型',read:5,date:'9/28',steps:['看板とのれんを出す','おしぼり・箸を補充','冷蔵庫の温度確認（5℃以下）','レジの釣り銭を確認','全員で「今日のひとこと」を確認']},
 {id:2,t:'生ビールの注ぎ方',e:'🍺',f:'動画中心',read:3,date:'9/25',steps:['ジョッキを傾けて注ぐ','七分目で立てて泡をのせる','泡は指2本分','すぐに提供する']},
 {id:3,t:'刺身盛り合わせの盛付',e:'🍣',f:'図中心',read:4,date:'9/20',steps:['大根のけんを敷く','奥から手前へ盛る','わさびと醤油皿を添える']},
 {id:4,t:'閉店・清掃チェック',e:'🧹',f:'チェックリスト型',read:6,date:'9/18',steps:['火元・ガス栓の確認','床とトイレの清掃','売上の締め作業','施錠']},
 {id:5,t:'お会計とレジ操作',e:'🧾',f:'文章中心',read:2,date:'9/12',steps:['伝票を確認','合計を声に出す','お預かり金額を復唱','レシートと釣り銭を渡す']},
 {id:6,t:'アレルギー対応の声かけ',e:'⚠️',f:'図中心',read:4,date:'9/10',steps:['注文時に「苦手な食材」を確認','厨房へ必ず口頭で共有','提供時に再確認']}
];
var MENU=[
 {id:1,n:'刺身盛り合わせ',e:'🍣',p:1480,al:['えび','さば'],sold:false,steps:['盛付けカードを確認','けんを敷く','奥から盛る']},
 {id:2,n:'鶏の唐揚げ',e:'🍗',p:680,al:['小麦','卵','大豆'],sold:false,steps:['下味済みを揚げる','170℃で5分','油を切って盛る']},
 {id:3,n:'焼き鳥盛り合わせ',e:'🍢',p:880,al:[],sold:false,steps:['串を網に並べる','タレを塗る']},
 {id:4,n:'だし巻き玉子',e:'🥚',p:580,al:['卵'],sold:false,steps:['卵液を作る','3回に分けて巻く']},
 {id:5,n:'枝豆',e:'🌱',p:380,al:['大豆'],sold:false,steps:['塩ゆで','塩をふる']},
 {id:6,n:'ポテトサラダ',e:'🥔',p:480,al:['卵','乳'],sold:true,steps:['仕込み済みを盛る']},
 {id:7,n:'海鮮サラダ',e:'🥗',p:780,al:['えび','かに'],sold:false,steps:['野菜を盛る','刺身をのせる','ドレッシング']},
 {id:8,n:'〆の鯛茶漬け',e:'🍚',p:780,al:['小麦','ごま'],sold:false,steps:['ご飯をよそう','鯛をのせる','だしをかける']}
];
var RECIPES=[
 {n:'だし巻き玉子',e:'🥚',ing:[['🥚','卵','3個'],['🍶','だし','60ml'],['🧂','塩','ひとつまみ'],['🍬','砂糖','小さじ1']],
  steps:[['卵を割りほぐす','白身を切るように混ぜる',0],['だしと調味料を混ぜる','泡立てないように',0],['卵液を1/3流す','中火。表面が半熟で巻く',60],['2回目を流し入れる','巻いた卵の下にも流す',60],['形を整えて盛り付け','大根おろしを添える',0]],
  warn:'卵は必ず加熱。アレルゲン「卵」を提供時に確認'},
 {n:'鶏の唐揚げ',e:'🍗',ing:[['🍗','鶏もも','200g'],['🧄','下味','大さじ2'],['🌾','粉','適量'],['🛢','油','170℃']],
  steps:[['下味の鶏肉に粉をまぶす','余分な粉は払う',0],['170℃の油で揚げる','入れすぎ注意',300],['一度取り出して休ませる','余熱で火を通す',60],['仕上げ揚げ','きつね色になるまで',60],['油を切って盛り付け','レモンを添える',0]],
  warn:'油はね注意！アレルゲン「小麦・卵・大豆」'}
];
var REQS=[
 {t:'マニュアルに動画を貼りたい',c:'マニュアル',u:'普通',s:'開発中',d:'9/20'},
 {t:'予約状況と連携してほしい',c:'その他',u:'急ぎ',s:'検討中',d:'9/27'},
 {t:'文字をもっと大きくしたい',c:'見やすさ',u:'普通',s:'完了',d:'9/05'}
];
var QUIZ=[
 {q:'生ビールの泡の量は？',o:['指2本分','なくていい','グラスの半分'],a:0},
 {q:'冷蔵庫の温度の目安は？',o:['5℃以下','10℃','15℃'],a:0},
 {q:'アレルギーの確認はいつ？',o:['注文時と提供時','提供時のみ','聞かない'],a:0}
];
var WORDS=['「ありがとう」は、最初に伝えるお客様への魔法の言葉です。','お皿を置く前に、ひと呼吸。笑顔で目を合わせましょう。','迷ったら、すぐ先輩へ。聞くのは「成長」です。'];
var LANGS=['やさしい日本語','English','Tiếng Việt','中文','한국어','Bahasa Indonesia'];
var NAV=[['home','ホーム','🏠'],['manual','マニュアル','📖'],['menu','メニュー設定','🍽'],['kitchen','厨房ビュー','👨‍🍳'],['diag','スタッフ診断','🧭'],['staff','スタッフ','👥'],['request','運営への要望','💌'],['settings','設定','⚙️']];
var EXTRA=[['onboarding','新人オンボーディング','🌱'],['checklist','開店・閉店チェック','✅'],['lang','多言語切替','🌏'],['quiz','今日のひとこと・クイズ','💡'],['praise','褒める','👏']];
var TAB=[['home','ホーム','🏠'],['manual','マニュアル','📖'],['menu','メニュー','🍽'],['kitchen','厨房','👨‍🍳'],['more','その他','☰']];
var DQ=[
 {q:'忙しいとき、声をかけられると…',o:[['ありがたい、助かる','call'],['手を止めて内容をしっかり聞く','careful'],['集中が切れて少しつらい','solo'],['動きながら一緒に考える','team']]},
 {q:'ミスをしたとき、まず…',o:[['すぐ誰かに話して相談する','call'],['原因をじっくり振り返る','careful'],['自分で直して次に生かす','solo'],['とにかくすぐ取り返しに動く','speed']]},
 {q:'新しい作業を覚えるときは…',o:[['手順書を読んでから始める','careful'],['やりながら体で覚える','speed'],['先輩と一緒にやりたい','team'],['一人で試してみたい','solo']]},
 {q:'仕事でいちばん嬉しいのは…',o:[['「ありがとう」と声をかけられた','call'],['ミスなく完璧にできた','careful'],['チーム全体がうまくいった','team'],['難しい仕事をやりきった','speed']]},
 {q:'休憩時間は…',o:[['みんなでおしゃべり','team'],['静かに一人で過ごす','solo'],['軽く声をかけ合う','call'],['次の仕事の準備をする','careful']]}
];
var CHECK={open:['看板・のれんを出す','手洗い・消毒','冷蔵庫の温度確認','おしぼり・箸の補充','レジ釣り銭の確認'],close:['火元・ガス栓の確認','床・トイレ清掃','まな板・包丁の消毒','売上の締め','施錠']};
var ONB=['制服・身だしなみを確認','店内案内と動線を覚える','お客様への挨拶を練習','オーダーの取り方を覚える','配膳の基本を覚える','レジ操作の見学','アレルギー対応の説明を受ける'];

/* ===== util ===== */
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var state={wiz:{step:1,tpl:0},dq:{i:0,ans:[]},fs:'m'};
var toastT;
function toast(){var t=$('#toast');t.textContent='モックアップのため操作できません';t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2200)}
var D=function(label,cls,extra){return '<button class="btn '+(cls||'')+'" data-dummy>'+label+'</button>'};
function back(h,l){return '<a class="back" href="#/'+h+'">← '+l+'</a>'}
function head(t,l){return '<h1>'+t+'</h1>'+(l?'<p class="lead">'+l+'</p>':'')}
function graph(a){var w=300,h=110,p=14,xs=(w-2*p)/(a.length-1),pts=a.map(function(v,i){return (p+i*xs).toFixed(1)+','+(h-p-(v/100)*(h-2*p)).toFixed(1)});
 return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="モチベーション推移（ダミー）"><rect width="'+w+'" height="'+h+'" rx="12" fill="#fff8f0"/><polyline fill="none" stroke="#e8743b" stroke-width="3" points="'+pts.join(' ')+'"/>'+pts.map(function(q){var c=q.split(',');return '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="4.5" fill="#e8743b"/>'}).join('')+'</svg><div class="row between" style="font-size:.75rem;color:#8a7260"><span>5ヶ月前</span><span>今月</span></div>'}
function st(id){return STAFF.filter(function(s){return s.id==id})[0]}
function pill(s){return '<span class="tag">'+TYPES[s.t].e+' '+TYPES[s.t].n+'</span>'}

/* ===== views ===== */
var V={};
V.home=function(){
 return head('おはようございます ☀️',SHOP.name+' ／ 今日は10月1日（木）')+
 '<div class="card"><h3>🔔 今日の通知</h3><p style="margin:4px 0">・ミンさんが「生ビールの注ぎ方」を読みました</p><p style="margin:4px 0">・「アレルギー対応」の更新が1件あります</p><p style="margin:4px 0">・りくさんの元気度が下がり気味です</p></div>'+
 '<div class="grid c2"><a class="card link-card" href="#/manual"><div class="ico">📖</div><div><b>未確認マニュアル</b><br><span class="tag r">3本</span> が未読です</div></a>'+
 '<a class="card link-card" href="#/staff"><div class="ico">👥</div><div><b>スタッフの様子</b><br><span class="tag g">元気 4名</span> <span class="tag y">要声かけ 2名</span></div></a></div>'+
 '<div class="card"><h3>💡 今日のひとこと</h3><p>'+WORDS[0]+'</p><a class="btn ghost block" href="#/quiz">ミニクイズに挑戦</a></div>'+
 '<h2>よく使う機能</h2><div class="grid c2">'+EXTRA.map(function(x){return '<a class="card link-card" href="#/'+x[0]+'"><div class="ico">'+x[2]+'</div><b>'+x[1]+'</b></a>'}).join('')+'</div>'+
 '<a class="btn block big" href="#/request" style="margin-top:8px">💌 運営への要望を送る</a>'};
V.more=function(){return head('その他の機能','')+'<div class="grid c2">'+NAV.slice(4).concat(EXTRA).map(function(x){return '<a class="card link-card" href="#/'+x[0]+'"><div class="ico">'+x[2]+'</div><b>'+x[1]+'</b></a>'}).join('')+'</div>'};
V.manual=function(){
 return head('マニュアル','店のやり方を、写真と一言で残せます')+'<a class="btn block big" href="#/manual/new" style="margin-bottom:14px">＋ 新しいマニュアルをつくる</a>'+
 MANUALS.map(function(m){return '<a class="card link-card" href="#/manual/'+m.id+'"><div class="ico">'+m.e+'</div><div class="grow"><b>'+m.t+'</b><br><span class="tag">'+m.f+'</span> <span class="tag '+(m.read<6?'y':'g')+'">既読 '+m.read+'/6</span></div></a>'}).join('')};
V.manualNew=function(){
 var w=state.wiz,tp=['📋 手順書','🍽 盛付け図解','✅ チェックリスト','🎥 動画つき'],body='';
 if(w.step==1)body='<h2>① テンプレートを選ぶ</h2>'+tp.map(function(x,i){return '<button class="opt '+(w.tpl==i?'on':'')+'" data-act="tpl" data-v="'+i+'">'+x+'</button>'}).join('');
 if(w.step==2)body='<h2>② 写真を撮る</h2><div class="thumb">📷</div><div class="row" style="margin-top:12px">'+D('📷 カメラで撮る','grow')+D('🖼 写真を選ぶ','grow ghost')+'</div>';
 if(w.step==3)body='<h2>③ 一言説明を書く</h2><textarea placeholder="例：泡は指2本分まで入れる"></textarea><div style="margin-top:10px">'+D('🎤 音声で入力','block ghost')+'</div><p class="lead" style="margin-top:12px">あとはAIが整えて、手順書にします（想定）</p>';
 if(w.step==4)body='<h2>④ 完成イメージ</h2><div class="card"><div class="thumb">📷</div><h3 style="margin-top:10px">新しいマニュアル（サンプル）</h3><p>一言説明から自動で整形されたイメージです。</p></div>'+D('✔ この内容で公開','block big green');
 return back('manual','マニュアル一覧')+head('マニュアルをつくる','3ステップで完成')+'<div class="steps">'+[1,2,3,4].map(function(i){return '<i class="'+(i<=w.step?'on':'')+'"></i>'}).join('')+'</div>'+body+
 '<div class="row" style="margin-top:16px">'+(w.step>1?'<button class="btn ghost grow" data-act="wiz" data-v="-1">戻る</button>':'')+(w.step<4?'<button class="btn grow" data-act="wiz" data-v="1">次へ</button>':'')+'</div>'};
V.manualView=function(id){var m=MANUALS[id-1];if(!m)return V.manual();
 return back('manual','マニュアル一覧')+head(m.e+' '+m.t,'<span class="tag">'+m.f+'</span> 更新 '+m.date)+
 '<div class="card"><div class="thumb">'+m.e+'</div></div>'+m.steps.map(function(s,i){return '<div class="card row"><div class="n ico" style="font-weight:800;color:var(--pri-d)">'+(i+1)+'</div><div class="grow"><b>'+s+'</b></div></div>'}).join('')+
 '<div class="card"><h3>読みましたか？理解度は？</h3><div class="row wrap">'+D('😕 まだ不安','ghost grow')+D('🙂 だいたいOK','ghost grow')+D('😄 バッチリ','grow')+'</div></div>'+
 '<a class="btn ghost block" href="#/manual/'+m.id+'/read">👥 スタッフ別の既読状況を見る</a>'};
V.manualRead=function(id){var m=MANUALS[id-1];if(!m)return V.manual();
 var lv=['★★★','★★☆','★☆☆','—'];
 return back('manual/'+id,'マニュアルに戻る')+head('既読・理解度',m.t)+'<div class="card"><table class="table"><tr><th>スタッフ</th><th>状況</th><th>理解度</th></tr>'+STAFF.map(function(s,i){var r=i<m.read;return '<tr><td>'+s.e+' '+s.name.split(' ')[0]+'</td><td><span class="tag '+(r?'g':'r')+'">'+(r?'既読':'未読')+'</span></td><td>'+(r?lv[i%3]:lv[3])+'</td></tr>'}).join('')+'</table></div>'+D('📣 未読の人に通知する','block')};
V.menu=function(){return head('メニュー設定','8品 ／ 売切れはスイッチで切替（表示のみ）')+'<div style="margin-bottom:14px">'+D('＋ メニューを追加','block')+'</div>'+
 '<div class="grid c2">'+MENU.map(function(m){return '<a class="card link-card" href="#/menu/'+m.id+'"><div class="ico">'+m.e+'</div><div class="grow"><b>'+m.n+'</b><br>¥'+m.p.toLocaleString()+' '+(m.sold?'<span class="tag r">売切れ</span>':'<span class="tag g">提供中</span>')+'</div></a>'}).join('')+'</div>'};
V.menuEdit=function(id){var m=MENU[id-1];if(!m)return V.menu();
 return back('menu','メニュー一覧')+head(m.e+' '+m.n+' の編集','')+'<div class="card"><div class="thumb">'+m.e+'</div><div style="margin-top:10px">'+D('📷 写真を変える','ghost block')+'</div>'+
 '<label class="f">料理名</label><input type="text" value="'+esc(m.n)+'" readonly><label class="f">価格（税込）</label><input type="text" value="¥'+m.p+'" readonly>'+
 '<label class="f">アレルゲン</label><div class="chips">'+['卵','乳','小麦','えび','かに','そば','落花生','大豆','ごま','さば'].map(function(a){return '<span class="opt '+(m.al.indexOf(a)>=0?'on':'')+'" data-toggle>'+a+'</span>'}).join('')+'</div>'+
 '<label class="f">提供手順</label>'+m.steps.map(function(s,i){return '<div class="row" style="margin-bottom:6px"><span class="tag">'+(i+1)+'</span> '+s+'</div>'}).join('')+
 '<div class="row between" style="margin-top:16px"><b>売切れにする</b><button class="sw '+(m.sold?'on':'')+'" data-toggle aria-label="売切れ切替"></button></div></div>'+D('保存する','block big')+'<div style="margin-top:8px">'+D('削除する','block ghost')+'</div>'};
V.kitchen=function(id){var r=RECIPES[id||0]||RECIPES[0];
 return '<div class="kit">'+head(r.e+' '+r.n+'（厨房ビュー）','')+'<div class="row wrap" style="margin-bottom:14px">'+RECIPES.map(function(x,i){return '<a class="btn '+(x==r?'':'ghost')+' grow" href="#/kitchen/'+i+'">'+x.e+' '+x.n+'</a>'}).join('')+'</div>'+
 '<div class="card"><h3>材料と分量</h3><div class="ing">'+r.ing.map(function(i){return '<div><span style="font-size:2rem">'+i[0]+'</span><b>'+i[2]+'</b>'+i[1]+'</div>'}).join('')+'</div></div>'+
 '<div class="mark-red">🔴 注意：'+r.warn+'</div><h2>工程</h2>'+
 r.steps.map(function(s,i){return '<div class="card"><div class="kstep"><div class="row"><div class="n">'+(i+1)+'</div><div><b style="font-size:1.25rem">'+s[0]+'</b><br>'+s[1]+'</div></div>'+
  '<div class="row between">'+(s[2]?'<span class="timer">⏱ '+String(Math.floor(s[2]/60)).padStart(2,'0')+':'+String(s[2]%60).padStart(2,'0')+'</span>'+D('スタート','big'):'<span class="tag">タイマーなし</span>')+'</div></div></div>'}).join('')+
 '<div class="card"><h3>盛り付け完成図</h3><div class="plate">（ここに完成写真・図が入ります）</div></div>'+
 '<div class="grid c2">'+D('◀ 前の工程','big ghost')+D('次の工程 ▶','big')+'</div></div>'};
V.diag=function(){var d=state.dq;
 var q=DQ[d.i];
 return head('スタッフ診断','全5問・1分で終わります')+'<div class="steps">'+DQ.map(function(_,i){return '<i class="'+(i<=d.i?'on':'')+'"></i>'}).join('')+'</div><div class="card"><span class="tag">Q'+(d.i+1)+' / '+DQ.length+'</span><div class="big-q">'+q.q+'</div>'+
 q.o.map(function(o){return '<button class="opt" data-act="ans" data-v="'+o[1]+'">'+o[0]+'</button>'}).join('')+'</div>'+(d.i>0?'<button class="btn ghost" data-act="dback">← 前の質問へ</button>':'')};
V.diagResult=function(k){var t=TYPES[k];if(!t)return V.diag();
 return head('診断結果','')+'<div class="card" style="text-align:center"><div style="font-size:4rem">'+t.e+'</div><h1>'+t.n+'</h1><p>'+t.d+'</p></div>'+
 '<div class="card"><h3>📖 合う「マニュアルの形」</h3><p><b>'+t.m+'</b></p><p>'+t.md+'</p></div>'+
 '<div class="card"><h3>🧑‍🏫 先輩・上司へのおすすめ</h3><ul style="padding-left:1.2em;margin:0">'+t.a.map(function(a){return '<li>'+a+'</li>'}).join('')+'</ul></div>'+
 '<div class="alert">⚠️ 診断は参考情報であり、本人の同意のもとで活用します。</div><div class="row wrap" style="margin-top:14px"><a class="btn grow" href="#/diag" data-act="dreset">もう一度診断する</a><a class="btn ghost grow" href="#/staff">スタッフ一覧へ</a></div>'};
V.staff=function(){return head('スタッフ一覧','6名')+STAFF.map(function(s){return '<a class="card link-card" href="#/staff/'+s.id+'"><div class="avatar">'+s.e+'</div><div class="grow"><b>'+s.name+'</b> <small>'+s.role+'</small><br>'+pill(s)+'<div class="bar" style="margin-top:6px"><i style="width:'+s.lv+'%"></i></div><small>習熟度 '+s.lv+'%</small></div></a>'}).join('')};
V.staffDetail=function(id){var s=st(id);if(!s)return V.staff();var t=TYPES[s.t];
 return back('staff','スタッフ一覧')+'<div class="card row"><div class="avatar">'+s.e+'</div><div><h1 style="margin:0">'+s.name+'</h1>'+s.role+' ／ '+s.since+'<br>'+pill(s)+'</div></div>'+
 '<div class="card"><h3>推奨マニュアル形式</h3><b>'+t.m+'</b><h3 style="margin-top:14px">習熟度 '+s.lv+'%</h3><div class="bar"><i style="width:'+s.lv+'%"></i></div></div>'+
 '<div class="card"><h3>モチベーションの推移（ダミー）</h3>'+graph(s.mot)+'</div>'+
 '<div class="card"><h3>📝 1on1メモ</h3><textarea placeholder="例：来月からレジを任せたい。本人も前向き。"></textarea><div style="margin-top:8px">'+D('メモを保存','block')+'</div></div>'+
 '<div class="card"><h3>👀 観察メモ</h3><p class="lead" style="margin:0 0 8px">口癖・目線・動きなどを記録する想定です</p><p style="margin:4px 0">・口癖：「大丈夫です！」が多い</p><p style="margin:4px 0">・目線：レジ周りをよく見ている</p><p style="margin:4px 0">・動き：混雑時に先に動いてくれる</p><textarea placeholder="気づいたことを記録"></textarea><div style="margin-top:8px">'+D('観察メモを追加','block ghost')+'</div></div>'+
 '<a class="btn block big" href="#/praise/'+s.id+'">👏 '+s.name.split(' ')[0]+'さんを褒める</a>'};
V.praise=function(id){var s=st(id)||STAFF[0];
 return back('staff/'+s.id,'スタッフ詳細')+head('👏 褒める','感謝やフィードバックを届けます')+'<div class="card"><label class="f" style="margin-top:0">送る相手</label><div class="chips">'+STAFF.map(function(x){return '<a class="opt '+(x==s?'on':'')+'" href="#/praise/'+x.id+'">'+x.e+' '+x.name.split(' ')[0]+'</a>'}).join('')+'</div>'+
 '<label class="f">スタンプ</label><div class="chips">'+['👏 ナイス！','🙏 ありがとう','🌟 成長したね','💪 頼りになる'].map(function(x){return '<span class="opt" data-toggle>'+x+'</span>'}).join('')+'</div><label class="f">ひとこと</label><textarea placeholder="例：昨日の混雑時、すごく助かった！"></textarea></div>'+D('👏 送る','block big')};
V.request=function(){return head('運営への要望','3タップで送れます')+'<div class="card"><label class="f" style="margin-top:0">① カテゴリ</label><div class="chips" data-single>'+['マニュアル','メニュー','スタッフ','見やすさ','その他'].map(function(x){return '<span class="opt" data-pick>'+x+'</span>'}).join('')+'</div>'+
 '<label class="f">② ひとこと</label><input type="text" placeholder="こんな機能がほしい"><label class="f">③ 緊急度</label><div class="chips" data-single>'+['いつでも','普通','急ぎ'].map(function(x){return '<span class="opt" data-pick>'+x+'</span>'}).join('')+'</div><div style="margin-top:14px">'+D('送信する','block big')+'</div></div>'+
 '<h2>送信済みの要望</h2>'+REQS.map(function(r){return '<div class="card"><b>'+r.t+'</b><br><span class="tag b">'+r.c+'</span> <span class="tag '+(r.s=='完了'?'g':r.s=='開発中'?'y':'')+'">'+r.s+'</span> <small>'+r.d+'</small></div>'}).join('')};
V.settings=function(){var f=state.fs;
 var qr='<svg viewBox="0 0 21 21" width="160" height="160" shape-rendering="crispEdges"><rect width="21" height="21" fill="#fff"/>'+(function(){var o='',i,j;for(i=0;i<21;i++)for(j=0;j<21;j++){var fin=(i<7&&j<7)||(i<7&&j>13)||(i>13&&j<7);var on=fin?(i%6==0||j%6==0||(i%6>=2&&i%6<=4&&j%6>=2&&j%6<=4)):((i*7+j*13+i*j)%3==0);if(on)o+='<rect x="'+j+'" y="'+i+'" width="1" height="1" fill="#4a3322"/>'}return o})()+'</svg>';
 return head('設定','')+'<div class="card"><h3>🏪 店舗情報</h3><p style="margin:2px 0"><b>'+SHOP.name+'</b></p><p style="margin:2px 0">'+SHOP.addr+'</p><p style="margin:2px 0">営業 '+SHOP.hours+'</p>'+D('変更する','ghost block')+'</div>'+
 '<div class="card" style="text-align:center"><h3>📲 スタッフ招待（QR）</h3>'+qr+'<p class="lead">ダミーのQRです。読み取れません</p>'+D('招待リンクをコピー','ghost block')+'</div>'+
 '<div class="card"><h3>💳 プラン</h3><p><span class="tag g">スタンダード（例）</span> 月額 ¥0,000（仮）</p>'+D('プランを変更','ghost block')+'</div>'+
 '<div class="card"><h3>🔠 文字サイズ <span class="tag y">実際に動きます</span></h3><div class="chips" data-fs>'+[['s','小'],['m','中'],['l','大']].map(function(x){return '<button class="opt '+(f==x[0]?'on':'')+'" data-act="fs" data-v="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div></div>'};
V.onboarding=function(){var n=3;return back('home','ホーム')+head('🌱 新人オンボーディング','ミンさん（1ヶ月目）')+'<div class="card"><b>進捗 '+n+' / '+ONB.length+'</b><div class="bar" style="margin:8px 0"><i style="width:'+Math.round(n/ONB.length*100)+'%"></i></div></div>'+ONB.map(function(x,i){return '<button class="chk '+(i<n?'done':'')+'" data-toggle><span class="box"></span><span class="t">'+x+'</span></button>'}).join('')};
V.checklist=function(){function l(a){return a.map(function(x){return '<button class="chk" data-toggle><span class="box"></span><span class="t">'+x+'</span></button>'}).join('')}
 return back('home','ホーム')+head('✅ 衛生・開店閉店チェック','タップで完了表示（保存されません）')+'<h2>🌅 開店前</h2>'+l(CHECK.open)+'<h2>🌙 閉店後</h2>'+l(CHECK.close)};
V.lang=function(){return back('home','ホーム')+head('🌏 多言語切替','外国人スタッフ向け（表示のみ）')+'<div class="card"><div class="chips" data-single>'+LANGS.map(function(x,i){return '<span class="opt '+(i==0?'on':'')+'" data-pick>'+x+'</span>'}).join('')+'</div></div><div class="card"><h3>表示サンプル</h3><p>開店準備：<b>おしぼりを　ならべます</b></p><p class="lead">※実際の翻訳は動きません</p></div>'+D('この言語で表示','block')};
V.quiz=function(){return back('home','ホーム')+head('💡 今日のひとこと','')+'<div class="card"><p style="font-size:1.1rem">'+WORDS[1]+'</p></div><h2>ミニクイズ</h2>'+QUIZ.map(function(q,qi){return '<div class="card"><b>Q'+(qi+1)+'. '+q.q+'</b><div style="margin-top:10px">'+q.o.map(function(o,i){return '<button class="opt" data-act="quiz" data-ok="'+(i==q.a?1:0)+'">'+o+'</button>'}).join('')+'</div></div>'}).join('')};

/* ===== router ===== */
function route(){
 var h=(location.hash||'#/home').replace(/^#\/?/,''),p=h.split('/'),k=p[0]||'home',html;
 try{
  if(k=='manual'&&p[1]=='new')html=V.manualNew();
  else if(k=='manual'&&p[1]&&p[2]=='read')html=V.manualRead(p[1]);
  else if(k=='manual'&&p[1])html=V.manualView(p[1]);
  else if(k=='menu'&&p[1])html=V.menuEdit(p[1]);
  else if(k=='diag'&&p[1]=='result')html=V.diagResult(p[2]);
  else if(k=='staff'&&p[1])html=V.staffDetail(p[1]);
  else if(k=='kitchen')html=V.kitchen(p[1]);
  else if(k=='praise')html=V.praise(p[1]);
  else if(V[k]&&k!='diagResult')html=V[k]();
  else{k='home';html=V.home()}
 }catch(e){html='<div class="card">表示エラー</div>'}
 $('#view').innerHTML=html;
 var cur=({home:'home',more:'more',onboarding:'more',checklist:'more',lang:'more',quiz:'more',praise:'more',diag:'more',staff:'more',request:'more',settings:'more'})[k]||k;
 var navKey=k=='praise'?'staff':k;
 $('#side').innerHTML='<div class="logo">🧭 ShopNavi</div>'+NAV.map(function(n){return '<a href="#/'+n[0]+'" class="'+(n[0]==navKey?'on':'')+'">'+n[2]+' '+n[1]+'</a>'}).join('')+'<hr>'+EXTRA.map(function(n){return '<a href="#/'+n[0]+'" class="'+(n[0]==k?'on':'')+'">'+n[2]+' '+n[1]+'</a>'}).join('');
 $('#tabs').innerHTML=TAB.map(function(n){return '<a href="#/'+n[0]+'" class="'+(n[0]==cur?'on':'')+'"><span>'+n[2]+'</span>'+n[1]+'</a>'}).join('');
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);

/* ===== events ===== */
document.addEventListener('click',function(e){
 var el=e.target.closest('[data-dummy],[data-act],[data-toggle],[data-pick]');if(!el)return;
 if(el.hasAttribute('data-dummy')){e.preventDefault();toast();return}
 if(el.hasAttribute('data-toggle')){el.classList.toggle(el.classList.contains('sw')||el.classList.contains('opt')?(el.classList.contains('sw')?'on':'on'):'done');return}
 if(el.hasAttribute('data-pick')){var g=el.parentNode;[].forEach.call(g.children,function(c){c.classList.remove('on')});el.classList.add('on');return}
 var a=el.getAttribute('data-act'),v=el.getAttribute('data-v');
 if(a=='tpl'){state.wiz.tpl=+v;route()}
 else if(a=='wiz'){state.wiz.step=Math.max(1,Math.min(4,state.wiz.step+ +v));route()}
 else if(a=='ans'){state.dq.ans.push(v);state.dq.i++;
  if(state.dq.i>=DQ.length){var c={};state.dq.ans.forEach(function(k){c[k]=(c[k]||0)+1});var best=Object.keys(c).sort(function(x,y){return c[y]-c[x]})[0];state.dq={i:0,ans:[]};location.hash='#/diag/result/'+best}else route()}
 else if(a=='dback'){state.dq.i--;state.dq.ans.pop();route()}
 else if(a=='dreset'){state.dq={i:0,ans:[]}}
 else if(a=='fs'){state.fs=v;document.documentElement.setAttribute('data-fs',v);route()}
 else if(a=='quiz'){var ok=el.getAttribute('data-ok')=='1';el.classList.add(ok?'ok':'ng');el.textContent=(ok?'⭕ 正解！ ':'❌ 残念… ')+el.textContent}
});
route();
})();
