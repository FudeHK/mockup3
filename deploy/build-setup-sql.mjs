// 使い方: リポジトリ直下で node deploy/build-setup-sql.mjs . → deploy/setup.sql を再生成
import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2];
const migDir = path.join(root, 'app/supabase/migrations');
const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
function idem(sql) {
  return sql
    .replace(/^create table (public\.\w+)/gim, 'create table if not exists $1')
    .replace(/^create (unique )?index (\w+)/gim, 'create $1index if not exists $2')
    .replace(/^create policy (\w+) on ([\w.]+)/gim, 'drop policy if exists $1 on $2;\ncreate policy $1 on $2')
    .replace(/^create trigger /gim, 'create or replace trigger ')
    .replace(/^alter publication supabase_realtime add table (public\.\w+);/gim, (m, t) => {
      const [s, n] = t.split('.');
      return `do $$ begin\n  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = '${s}' and tablename = '${n}') then\n    alter publication supabase_realtime add table ${t};\n  end if;\nend $$;`;
    });
}
let out = `-- ShopNavi 本番セットアップ（自動生成：app/supabase/migrations/*.sql を番号順に結合 + seed.sql）\n-- Supabase の SQL Editor に全文を貼り付けて実行してください。何度実行しても壊れないようにしています。\n-- 生成元を変更した場合は再生成してください。\n\n`;
for (const f of files) out += `-- ==================== migrations/${f} ====================\n\n` + idem(fs.readFileSync(path.join(migDir, f), 'utf8')) + '\n\n';
out += `-- ==================== seed.sql ====================\n\n` + fs.readFileSync(path.join(root, 'app/supabase/seed.sql'), 'utf8');
fs.mkdirSync(path.join(root, 'deploy'), { recursive: true });
fs.writeFileSync(path.join(root, 'deploy/setup.sql'), out);
