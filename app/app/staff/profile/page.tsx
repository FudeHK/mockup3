'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import { CATEGORIES, PROFILE_NOTICE, applyShare, diffProfile, type Category, type ProfileItem } from '@/lib/v2/profile';

export default function StaffProfilePage() {
  return (
    <Shell role="staff">
      <Profile />
    </Shell>
  );
}

function Profile() {
  const { me } = useSession();
  const { has, ready } = useFeatures();
  const toast = useToast();
  const [saved, setSaved] = useState<ProfileItem[]>([]);
  const [sel, setSel] = useState<Record<Category, string[]>>({ skill: [], experience: [], wish: [] });
  const [share, setShare] = useState<Record<Category, boolean>>({ skill: false, experience: false, wish: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb().from('staff_profile_items').select('category,value,shared');
    const items = (data as ProfileItem[]) ?? [];
    setSaved(items);
    const s: Record<Category, string[]> = { skill: [], experience: [], wish: [] };
    const sh: Record<Category, boolean> = { skill: false, experience: false, wish: false };
    for (const i of items) {
      s[i.category].push(i.value);
      if (i.shared) sh[i.category] = true;
    }
    setSel(s);
    setShare(sh);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    if (ready && has('staff_profile')) void load();
  }, [ready, has, load]);

  if (!me) return null;
  if (ready && !has('staff_profile')) return <p className="muted">この店舗では使えない機能です。</p>;

  const pick = (c: Category, value: string, multi: boolean) =>
    setSel((s) => ({ ...s, [c]: multi ? (s[c].includes(value) ? s[c].filter((x) => x !== value) : [...s[c], value]) : s[c][0] === value ? [] : [value] }));

  const save = async () => {
    setErr('');
    setBusy(true);
    const after = applyShare(CATEGORIES.flatMap((c) => sel[c.key].map((value) => ({ category: c.key, value, shared: false }))), share);
    const d = diffProfile(saved, after);
    const c = sb();
    try {
      for (const i of d.remove) {
        const r = await c.from('staff_profile_items').delete().eq('category', i.category).eq('value', i.value);
        if (r.error) throw r.error;
      }
      for (const i of d.update) {
        const r = await c.from('staff_profile_items').update({ shared: i.shared, updated_at: new Date().toISOString() }).eq('category', i.category).eq('value', i.value);
        if (r.error) throw r.error;
      }
      if (d.add.length) {
        const r = await c.from('staff_profile_items').insert(d.add.map((i) => ({ ...i, store_id: me.storeId, alias_id: me.aliasId })));
        if (r.error) throw r.error;
      }
      toast.show('保存しました');
      await load();
    } catch {
      setErr('保存できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p><Link href="/staff">← マニュアル一覧へ</Link></p>
      <h1>わたしのプロフィール（自己申告）</h1>
      <div className="card alert" role="note" data-testid="profile-notice"><strong>{PROFILE_NOTICE}</strong></div>
      <p className="lead">{me.aliasName}さんの得意なこと・経験・希望を、選べる範囲で教えてください。答えなくてもかまいません。管理者に見えるのは「管理者に公開する」をオンにした項目だけです。</p>
      {CATEGORIES.map((c) => (
        <div key={c.key} className="card">
          <div className="row between wrap">
            <h3>{c.label}{c.multi ? '（いくつでも）' : '（1つ）'}</h3>
            <label className={`chip ${share[c.key] ? 'on' : ''}`} style={{ margin: 0 }}>
              <input type="checkbox" checked={share[c.key]} onChange={(e) => setShare((s) => ({ ...s, [c.key]: e.target.checked }))} data-testid={`share-${c.key}`} />
              管理者に公開する
            </label>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {c.options.map((o) => (
              <label key={o} className={`chip ${sel[c.key].includes(o) ? 'on' : ''}`} style={{ margin: 0 }}>
                <input type={c.multi ? 'checkbox' : 'radio'} name={c.key} checked={sel[c.key].includes(o)} onChange={() => pick(c.key, o, c.multi)} onClick={() => !c.multi && sel[c.key][0] === o && pick(c.key, o, false)} />
                {o}
              </label>
            ))}
          </div>
          <p className="muted">{share[c.key] ? '🔓 管理者に公開します' : '🔒 自分だけが見られます'}</p>
        </div>
      ))}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn big block" onClick={save} disabled={busy} data-testid="profile-save">保存する</button>
      {toast.node}
    </>
  );
}
