'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Alias } from '@/lib/types';

export default function SettingsPage() {
  return (
    <Shell role="admin">
      <Settings />
    </Shell>
  );
}

const REASON: Record<string, string> = { format: 'PINは6〜8桁の数字にしてください', same_as_other: '管理者PINとスタッフPINは別の番号にしてください' };

function Settings() {
  const { me, refresh } = useSession();
  const toast = useToast();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [storeName, setStoreName] = useState(me?.storeName ?? '');
  const [pins, setPins] = useState({ admin: '', admin2: '', staff: '', staff2: '' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await sb().from('staff_aliases').select('id,name,active').order('created_at');
    setAliases((data as Alias[]) ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    void load();
  }, [load]);

  const changePin = async (kind: 'admin' | 'staff') => {
    setErr('');
    const a = pins[kind];
    const b = pins[`${kind}2` as 'admin2' | 'staff2'];
    if (a !== b) return setErr('確認用のPINが一致しません');
    const { data, error } = await sb().rpc('set_store_pin', { p_kind: kind, p_new_pin: a });
    if (error || !data?.ok) return setErr(REASON[data?.reason] ?? '変更できませんでした');
    setPins((p) => ({ ...p, [kind]: '', [`${kind}2`]: '' }));
    toast.show(`${kind === 'admin' ? '管理者' : 'スタッフ'}PINを変更しました`);
  };

  const addAlias = async () => {
    setErr('');
    const name = newAlias.trim();
    if (!name) return;
    const { error } = await sb().from('staff_aliases').insert({ store_id: me!.storeId, name });
    if (error) return setErr(error.code === '23505' ? '同じ呼び名がすでにあります' : '追加できませんでした（20文字以内）');
    setNewAlias('');
    toast.show(`「${name}」を追加しました`);
    await load();
  };

  const toggle = async (a: Alias) => {
    await sb().from('staff_aliases').update({ active: !a.active }).eq('id', a.id);
    await load();
  };

  const saveName = async () => {
    const { error } = await sb().from('stores').update({ name: storeName.trim() }).eq('id', me!.storeId);
    if (error) return setErr('店舗名を保存できませんでした（40文字以内）');
    await refresh();
    toast.show('店舗名を保存しました');
  };

  const pinInput = (k: keyof typeof pins, label: string) => (
    <div>
      <label htmlFor={k}>{label}</label>
      <input id={k} type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pins[k]} onChange={(e) => setPins((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, '') }))} />
    </div>
  );

  return (
    <>
      <h1>設定</h1>
      {err && <p className="err" role="alert">{err}</p>}
      <h2>PINの変更</h2>
      <div className="grid two">
        <div className="card">
          <h3>管理者PIN</h3>
          {pinInput('admin', '新しいPIN（6〜8桁）')}
          {pinInput('admin2', 'もう一度')}
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => changePin('admin')}>管理者PINを変更</button>
        </div>
        <div className="card">
          <h3>スタッフPIN</h3>
          {pinInput('staff', '新しいPIN（6〜8桁）')}
          {pinInput('staff2', 'もう一度')}
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => changePin('staff')}>スタッフPINを変更</button>
        </div>
      </div>
      <p className="muted">PINは暗号化（ハッシュ化）して保存され、管理者にも元の番号は表示されません。忘れた場合は運用メモを参照してください。</p>

      <h2>スタッフの呼び名（仮名）</h2>
      <div className="card">
        <p className="muted">本名ではなく「スタッフD」などの呼び名を登録します。使わなくなった呼び名は「休止」にできます。</p>
        <div className="row">
          <input type="text" aria-label="新しい呼び名" maxLength={20} value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="例：スタッフD" />
          <button className="btn" onClick={addAlias}>追加</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {aliases.map((a) => (
            <li key={a.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{a.name} {!a.active && <span className="tag y">休止中</span>}</span>
              <button className="btn ghost small" onClick={() => toggle(a)}>{a.active ? '休止' : '再開'}</button>
            </li>
          ))}
        </ul>
      </div>

      <h2>店舗名</h2>
      <div className="card row">
        <input type="text" aria-label="店舗名" maxLength={40} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        <button className="btn" onClick={saveName}>保存</button>
      </div>
      {toast.node}
    </>
  );
}
