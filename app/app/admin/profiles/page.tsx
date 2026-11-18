'use client';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useFeatures } from '@/lib/features';
import { CATEGORIES, PROFILE_NOTICE, type Category } from '@/lib/v2/profile';

export default function ProfilesPage() {
  return (
    <Shell role="admin">
      <Profiles />
    </Shell>
  );
}

type Row = { alias_id: string; category: Category; value: string };

function Profiles() {
  const { has, ready } = useFeatures();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!ready || !has('staff_profile')) return;
    const c = sb();
    // RLS により「本人が公開に同意した項目」だけが返る
    void Promise.all([c.from('staff_profile_items').select('alias_id,category,value'), c.from('staff_aliases').select('id,name')]).then(([p, a]) => {
      setRows((p.data as Row[]) ?? []);
      setNames(Object.fromEntries(((a.data as { id: string; name: string }[]) ?? []).map((x) => [x.id, x.name])));
    });
  }, [ready, has]);

  if (ready && !has('staff_profile')) return <p className="muted">この店舗では使えない機能です。</p>;
  const byAlias = new Map<string, Row[]>();
  for (const r of rows ?? []) byAlias.set(r.alias_id, [...(byAlias.get(r.alias_id) ?? []), r]);

  return (
    <>
      <h1>スタッフの希望（自己申告）</h1>
      <div className="card alert" role="note" data-testid="profile-notice"><strong>{PROFILE_NOTICE}</strong></div>
      <p className="lead">スタッフ本人が「管理者に公開する」を選んだ項目だけを表示しています。仕事の割り振りの相談などに使い、評価・人事判断には使わないでください。</p>
      {rows === null && <p className="muted">読み込み中…</p>}
      {rows?.length === 0 && <p className="muted">公開されているプロフィールはまだありません。</p>}
      <div className="grid two">
        {[...byAlias.entries()].map(([aid, list]) => (
          <div key={aid} className="card" data-testid="profile-card">
            <h3>{names[aid] ?? 'スタッフ'}</h3>
            {CATEGORIES.map((c) => {
              const v = list.filter((r) => r.category === c.key).map((r) => r.value);
              return v.length ? <p key={c.key}><span className="muted">{c.label}：</span>{v.join('、')}</p> : null;
            })}
          </div>
        ))}
      </div>
    </>
  );
}
