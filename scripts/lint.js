// 使い方: node scripts/lint.js   依存なしの簡易リント
// 1) JS の構文チェック 2) 秘密情報らしき文字列の混入チェック 3) 電話番号らしき文字列の混入チェック
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\n').filter(f=>f&&!f.startsWith('.claude/skills/')&&fs.existsSync(path.join(root,f)));
const bad=[];
const SECRET=[/service_role/i,/SUPABASE_SERVICE_ROLE/i,/eyJhbGciOi[A-Za-z0-9_-]{20,}/,/sk_(live|test)_[A-Za-z0-9]{10,}/,/-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const PHONE=/(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])|(?<!\d)0[789]0\d{8}(?!\d)/;
for(const f of files){
 const p=path.join(root,f);
 if(/(^|\/)\.env(\.|$)/.test(f)&&!f.endsWith('.env.example'))bad.push(['env-file',f]);
 if(f.endsWith('.js')){try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'})}catch(e){bad.push(['syntax',f,String(e.stderr).split('\n')[0]])}}
 if(!/\.(js|ts|tsx|jsx|html|css|json|md|sql|py|txt|toml|ya?ml)$/.test(f)||f==='scripts/lint.js'||f==='package-lock.json')continue;
 const t=fs.readFileSync(p,'utf8');
 SECRET.forEach(r=>{if(r.test(t)&&!f.endsWith('.md'))bad.push(['secret',f,String(r)])});
 if(PHONE.test(t))bad.push(['phone',f,t.match(PHONE)[0]]);
}
console.log(bad.length?JSON.stringify(bad,null,1):'lint OK ('+files.length+' files)');process.exit(bad.length?1:0);
