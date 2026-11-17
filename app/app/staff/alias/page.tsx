'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Alias } from '@/lib/types';

export default function AliasPage() {
  return (
    <Shell role="staff">
      <AliasPicker />
    </Shell>
  );
}

function AliasPicker() {
  const { me, refresh } = useSession();
  const router = useRouter();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!me) return;
    void sb()
      .from('staff_aliases')
      .select('id,name,active')
      .eq('store_id', me.storeId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setAliases((data as Alias[]) ?? []));
  }, [me]);

  const pick = async (a: Alias) => {
    const { error } = await sb().rpc('select_alias', { p_alias_id: a.id });
    if (error) return setErr('選択できませんでした。もう一度お試しください。');
    await refresh();
    router.replace('/staff');
  };

  return (
    <>
      <h1>あなたはどなたですか？</h1>
      <p className="lead">自分の呼び名を選んでください（本名は使いません）。</p>
      <div className="grid three">
        {aliases.map((a) => (
          <button key={a.id} className="btn big ghost block" onClick={() => pick(a)}>
            {a.name}
          </button>
        ))}
      </div>
      {aliases.length === 0 && <p className="muted">呼び名がまだ登録されていません。管理者に追加を依頼してください。</p>}
      {err && <p className="err">{err}</p>}
    </>
  );
}
