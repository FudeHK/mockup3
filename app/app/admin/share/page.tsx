'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import { fmtShort } from '@/lib/format';
import { buildTemplate, parseTemplate, type SharedTemplate } from '@/lib/v2/template';
import { inviteUrl, randomToken, sha256Hex } from '@/lib/v2/invite';

export default function SharePage() {
  return (
    <Shell role="admin">
      <Share />
    </Shell>
  );
}

type Inv = { id: string; note: string; created_at: string; expires_at: string; used_at: string | null };

function Share() {
  const { me } = useSession();
  const { has, ready } = useFeatures();
  const router = useRouter();
  const toast = useToast();
  const [manuals, setManuals] = useState<{ id: string; title: string }[]>([]);
  const [preview, setPreview] = useState<SharedTemplate | null>(null);
  const [err, setErr] = useState('');
  const [invites, setInvites] = useState<Inv[]>([]);
  const [note, setNote] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(async () => {
    const c = sb();
    const [m, i] = await Promise.all([
      c.from('manuals').select('id,title').order('created_at'),
      c.from('store_invites').select('id,note,created_at,expires_at,used_at').order('created_at', { ascending: false }),
    ]);
    setManuals((m.data as { id: string; title: string }[]) ?? []);
    setInvites((i.data as Inv[]) ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    if (ready) void load();
  }, [ready, load]);

  if (!me) return null;
  if (ready && !has('template_share') && !has('invite')) return <p className="muted">この店舗では使えない機能です。</p>;

  const exportManual = async (id: string, title: string) => {
    const c = sb();
    const [s, a] = await Promise.all([
      c.from('manual_steps').select('question,body,photo_path').eq('manual_id', id).order('position'),
      c.from('staff_aliases').select('name'),
    ]);
    const names = [me.storeName, ...(((a.data as { name: string }[]) ?? []).map((x) => x.name))];
    const tpl = buildTemplate(title, (s.data as { question: string; body: string; photo_path: string | null }[]) ?? [], names);
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = `shopnavi-template_${tpl.title.replace(/[\\/:*?"<>|\s]/g, '_')}.json`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(el.href), 5000);
    toast.show('テンプレートを書き出しました（写真・個人情報は含みません）');
  };

  const onFile = async (file: File | undefined) => {
    setErr('');
    setPreview(null);
    if (!file) return;
    if (file.size > 200_000) return setErr('ファイルが大きすぎます');
    try {
      setPreview(parseTemplate(await file.text()));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const importTemplate = async () => {
    if (!preview) return;
    const c = sb();
    const id = crypto.randomUUID();
    const { error } = await c.from('manuals').insert({ id, store_id: me.storeId, title: preview.title });
    if (error) return setErr('取り込めませんでした');
    const steps = preview.steps.map((s, i) => ({ id: crypto.randomUUID(), manual_id: id, store_id: me.storeId, position: i + 1, question: s.question, body: s.body }));
    const r = await c.from('manual_steps').insert(steps);
    if (r.error) return setErr('工程を取り込めませんでした');
    router.push(`/admin/manuals/${id}`);
  };

  const createInvite = async () => {
    setErr('');
    const token = randomToken();
    const { error } = await sb().from('store_invites').insert({ store_id: me.storeId, token_hash: await sha256Hex(token), note: note.trim().slice(0, 40) });
    if (error) return setErr('招待リンクを作れませんでした');
    setNewUrl(inviteUrl(location.origin, token));
    setNote('');
    await load();
  };

  const revoke = async (id: string) => {
    await sb().from('store_invites').update({ expires_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const status = (i: Inv) => (i.used_at ? <span className="tag g">使用済み</span> : new Date(i.expires_at) <= new Date() ? <span className="tag">期限切れ・取消</span> : <span className="tag y">有効</span>);

  return (
    <>
      <h1>テンプレートの共有・招待</h1>
      {err && <p className="err" role="alert">{err}</p>}
      {has('template_share') && (
        <>
          <h2>テンプレートとして書き出す</h2>
          <div className="card">
            <p className="muted">質問と一言だけを書き出します。写真・店舗名・スタッフの呼び名・電話番号・メールアドレス・URL は含めません（見つかった場合は「（名前）」などに置き換えます）。書き出したファイルを、ほかのお店に渡してください。</p>
            {manuals.length === 0 && <p className="muted">マニュアルがありません。</p>}
            {manuals.map((m) => (
              <div key={m.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{m.title}</span>
                <button className="btn ghost small" onClick={() => exportManual(m.id, m.title)} data-testid="export-template">⬇ 書き出す</button>
              </div>
            ))}
          </div>
          <h2>テンプレートを取り込む</h2>
          <div className="card">
            <label className="btn ghost file-btn" style={{ position: 'relative' }}>
              📂 テンプレートのファイル（.json）を選ぶ
              <input type="file" accept="application/json,.json" data-testid="import-template" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {preview && (
              <div style={{ marginTop: 10 }} data-testid="import-preview">
                <h3>{preview.title}（工程 {preview.steps.length}）</h3>
                <ol>{preview.steps.map((s, i) => <li key={i}>{s.body || <span className="muted">（空欄）</span>}</li>)}</ol>
                <button className="btn green block" onClick={importTemplate} data-testid="import-confirm">下書きとして取り込む</button>
                <p className="muted">取り込んだあと、お店のやり方に合わせて直し、写真をつけて公開してください。</p>
              </div>
            )}
          </div>
        </>
      )}
      {has('invite') && (
        <>
          <h2 id="invite">招待リンク</h2>
          <div className="card">
            <p className="muted">ほかのお店を招待します。リンクを開いた人が、店舗コードと管理者PIN・スタッフPINを決めて新しい店舗を作れます。リンクは7日間・1回だけ有効です。</p>
            <label htmlFor="inv-note">メモ（任意・40文字。お店の名前などは書かないでください）</label>
            <input id="inv-note" type="text" maxLength={40} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：11月の説明会で配布" />
            <button className="btn block" style={{ marginTop: 10 }} onClick={createInvite} data-testid="create-invite">招待リンクを作る</button>
            {newUrl && (
              <div className="card alert" style={{ marginTop: 10 }}>
                <strong>招待リンク（この画面を離れると再表示できません）</strong>
                <input type="text" readOnly value={newUrl} data-testid="invite-url" onFocus={(e) => e.target.select()} />
                <button className="btn ghost small" style={{ marginTop: 6 }} onClick={() => navigator.clipboard?.writeText(newUrl).then(() => toast.show('コピーしました'))}>コピー</button>
              </div>
            )}
          </div>
          {invites.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>作成</th><th>期限</th><th>状態</th><th>メモ</th><th></th></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td className="nw">{fmtShort(i.created_at)}</td><td className="nw">{fmtShort(i.expires_at)}</td><td>{status(i)}</td><td>{i.note || '—'}</td>
                      <td>{!i.used_at && new Date(i.expires_at) > new Date() && <button className="btn ghost small" onClick={() => revoke(i.id)}>取り消す</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {toast.node}
    </>
  );
}
