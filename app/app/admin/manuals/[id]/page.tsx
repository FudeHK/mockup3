'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb, PHOTO_BUCKET } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { shrinkImage } from '@/lib/image';
import { useSignedUrls } from '@/lib/photos';
import { fmtDuration, fmtShort } from '@/lib/format';
import type { Manual, Revision, Step } from '@/lib/types';
import { useFeatures } from '@/lib/features';
import { VoiceButton } from '@/components/VoiceInput';
import { appendText, inputMethod, splitIntoSteps } from '@/lib/v2/voice';

export default function EditPage() {
  return (
    <Shell role="admin">
      <Editor />
    </Shell>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const { me } = useSession();
  const toast = useToast();
  const [manual, setManual] = useState<Manual | null>(null);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [revs, setRevs] = useState<Pick<Revision, 'version' | 'note' | 'published_at' | 'steps'>[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const urls = useSignedUrls(steps.map((s) => s.photo_path));
  // v2-A: 工程ごとの入力方法（音声／手入力）。フラグ OFF のときは記録しない
  const voiceOn = useFeatures().has('voice_input');
  const methods = useRef(new Map<string, { voice: boolean; typed: boolean }>());
  const mark = (sid: string, k: 'voice' | 'typed') => {
    if (!voiceOn) return;
    const m = methods.current.get(sid) ?? { voice: false, typed: false };
    m[k] = true;
    methods.current.set(sid, m);
  };

  const load = useCallback(async () => {
    const c = sb();
    const [m, s, r] = await Promise.all([
      c.from('manuals').select('*').eq('id', id).maybeSingle(),
      c.from('manual_steps').select('*').eq('manual_id', id).order('position'),
      c.from('manual_revisions').select('version,note,published_at,steps').eq('manual_id', id).order('version', { ascending: false }),
    ]);
    setManual(m.data as Manual);
    setTitle((m.data as Manual | null)?.title ?? '');
    setSteps((s.data as Step[]) ?? []);
    setRevs((r.data as Revision[]) ?? []);
    setRemoved([]);
    setDirty(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    void load();
  }, [load]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!manual || !me) return <p className="muted">読み込み中…</p>;

  const patch = (sid: string, v: Partial<Step>) => {
    setSteps((list) => list.map((s) => (s.id === sid ? { ...s, ...v } : s)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setSteps((list) => {
      const n = [...list];
      const j = i + d;
      if (j < 0 || j >= n.length) return list;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const add = () => {
    setSteps((list) => [...list, { id: crypto.randomUUID(), manual_id: id, store_id: me.storeId, position: list.length + 1, question: '', body: '', photo_path: null }]);
    setDirty(true);
  };
  const del = (sid: string) => {
    if (!confirm('この工程を削除しますか？')) return;
    setSteps((list) => list.filter((s) => s.id !== sid));
    setRemoved((r) => [...r, sid]);
    setDirty(true);
  };

  const onPhoto = async (sid: string, file: File | undefined) => {
    if (!file) return;
    setUploading(sid);
    setErr('');
    try {
      const blob = await shrinkImage(file); // 縮小 + EXIF（位置情報など）を削除
      const path = `${me.storeId}/${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      patch(sid, { photo_path: path });
      toast.show('写真を追加しました（位置情報は削除済み）');
    } catch (e) {
      setErr(`写真を追加できませんでした：${(e as Error).message}`);
    } finally {
      setUploading(null);
    }
  };

  const save = async (): Promise<boolean> => {
    setErr('');
    if (!title.trim()) {
      setErr('タイトルを入力してください');
      return false;
    }
    const c = sb();
    if (title !== manual.title) {
      const { error } = await c.from('manuals').update({ title: title.trim() }).eq('id', id);
      if (error) {
        setErr('タイトルを保存できませんでした');
        return false;
      }
    }
    if (removed.length) await c.from('manual_steps').delete().in('id', removed);
    if (steps.length) {
      const rows = steps.map((s, i) => ({ id: s.id, manual_id: id, store_id: me.storeId, position: i + 1, question: s.question, body: s.body.slice(0, 200), photo_path: s.photo_path }));
      const { error } = await c.from('manual_steps').upsert(rows, { onConflict: 'id' });
      if (error) {
        setErr('工程を保存できませんでした');
        return false;
      }
    }
    await logInputMethods();
    return true;
  };

  // v2-A: 入力方法を利用ログ（input_logs）に記録。失敗しても保存は止めない
  const logInputMethods = async () => {
    if (!voiceOn || methods.current.size === 0) return;
    const rows = steps
      .map((s, i) => {
        const m = methods.current.get(s.id);
        const method = m ? inputMethod(m.voice, m.typed) : null;
        return method ? { store_id: me.storeId, manual_id: id, manual_title: title.trim().slice(0, 60), step_no: i + 1, method, chars: s.body.length } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    methods.current.clear();
    if (rows.length === 0) return;
    try {
      await sb().from('input_logs').insert(rows);
    } catch {
      /* noop */
    }
  };

  // v2-A: まとめて話した内容を「次に」「それから」で区切り、空いている工程から順に入れる
  const onBulkVoice = (text: string) => {
    const parts = splitIntoSteps(text);
    if (parts.length === 0) return;
    setSteps((list) => {
      const n = [...list];
      let k = 0;
      for (let i = 0; i < n.length && k < parts.length; i++) {
        if (!n[i].body.trim()) {
          n[i] = { ...n[i], body: parts[k++] };
          mark(n[i].id, 'voice');
        }
      }
      while (k < parts.length) {
        const sid = crypto.randomUUID();
        n.push({ id: sid, manual_id: id, store_id: me.storeId, position: n.length + 1, question: '', body: parts[k++], photo_path: null });
        mark(sid, 'voice');
      }
      return n;
    });
    setDirty(true);
    toast.show(`音声から${parts.length}つの工程を入れました。内容を確認してください`);
  };

  const onSave = async () => {
    setBusy(true);
    if (await save()) {
      toast.show('下書きを保存しました');
      await load();
    }
    setBusy(false);
  };

  const onPublish = async () => {
    if (!steps.some((s) => s.body.trim())) return setErr('少なくとも1つの工程に「一言」を書いてください');
    setBusy(true);
    if (await save()) {
      const { data, error } = await sb().rpc('publish_manual', { p_manual_id: id, p_note: note });
      if (error || !data?.ok) setErr('公開できませんでした');
      else {
        toast.show(data.version > 1 ? `第${data.version}版を公開し、スタッフに再確認を依頼しました` : `公開しました（作成時間 ${fmtDuration(data.creation_seconds)}）`);
        setNote('');
        await load();
      }
    }
    setBusy(false);
  };

  const filled = steps.filter((s) => s.body.trim()).length;

  return (
    <>
      <div className="row between wrap">
        <h1>マニュアルを作る</h1>
        <span className={`tag ${manual.status === 'published' ? 'g' : 'y'}`}>
          {manual.status === 'published' ? `公開中 第${manual.version}版` : '下書き'}
        </span>
      </div>
      <p className="muted">
        作成開始 {fmtShort(manual.draft_started_at)}
        {manual.creation_seconds !== null && ` ・ 作成→初回公開 ${fmtDuration(manual.creation_seconds)}`}
      </p>
      <div className="card">
        <label htmlFor="title">タイトル</label>
        <input id="title" type="text" maxLength={60} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>

      {voiceOn && (
        <div className="card" data-testid="voice-bulk-card">
          <h3>🎤 まとめて音声で作る</h3>
          <p className="muted">作業を順番に話してください。「次に」「それから」「最後に」で工程を区切ります。話した内容は端末の音声認識で文字にし、空いている工程から順に入ります。</p>
          <VoiceButton label="🎤 まとめて話す" testId="voice-bulk" block onText={onBulkVoice} />
        </div>
      )}

      {steps.map((s, i) => (
        <div key={s.id} className="card step-edit" data-testid="step-edit">
          <div className="row between wrap">
            <h3>工程 {i + 1}</h3>
            <div className="row">
              <button className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`工程${i + 1}を上へ`}>↑</button>
              <button className="btn ghost small" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`工程${i + 1}を下へ`}>↓</button>
              <button className="btn ghost small" onClick={() => del(s.id)} aria-label={`工程${i + 1}を削除`}>削除</button>
            </div>
          </div>
          <label htmlFor={`q-${s.id}`}>質問</label>
          <input id={`q-${s.id}`} type="text" value={s.question} placeholder="（任意）例：最初に何をしますか？" onChange={(e) => patch(s.id, { question: e.target.value })} />
          <label htmlFor={`b-${s.id}`}>答え（一言） <span className="muted">{s.body.length}/200</span></label>
          <textarea id={`b-${s.id}`} maxLength={200} value={s.body} placeholder="例：裏口の鍵を開け、照明をつける" onChange={(e) => { mark(s.id, 'typed'); patch(s.id, { body: e.target.value }); }} />
          {voiceOn && (
            <div style={{ marginTop: 6 }}>
              <VoiceButton testId="voice-step" onText={(t) => { mark(s.id, 'voice'); setSteps((list) => list.map((x) => (x.id === s.id ? { ...x, body: appendText(x.body, t) } : x))); setDirty(true); }} />
            </div>
          )}
          <div className="row wrap" style={{ marginTop: 8 }}>
            {s.photo_path && urls[s.photo_path] && <img className="photo-thumb" src={urls[s.photo_path]} alt={`工程${i + 1}の写真`} />}
            <label className="btn ghost small file-btn" style={{ position: 'relative', margin: 0 }}>
              📷 {s.photo_path ? '写真を変える' : '写真を1枚つける'}
              <input type="file" accept="image/*" onChange={(e) => onPhoto(s.id, e.target.files?.[0])} data-testid="photo-input" />
            </label>
            {s.photo_path && <button className="btn ghost small" onClick={() => patch(s.id, { photo_path: null })}>写真を外す</button>}
            {uploading === s.id && <span className="muted" role="status">縮小してアップロード中…</span>}
          </div>
        </div>
      ))}
      <button className="btn ghost block" onClick={add}>＋ 工程を追加</button>

      <div className="card" style={{ marginTop: 14 }}>
        <p>書けた工程：{filled} / {steps.length}（空欄の工程は公開されません）</p>
        {manual.status === 'published' && (
          <>
            <label htmlFor="note">変更点のメモ（スタッフの再確認依頼に表示）</label>
            <input id="note" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：つり銭の数え方を変更" />
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="grid two" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={onSave} disabled={busy}>下書き保存</button>
          <button className="btn green" onClick={onPublish} disabled={busy} data-testid="publish">
            {manual.status === 'published' ? '更新して公開（再確認を依頼）' : '公開する'}
          </button>
        </div>
      </div>

      <h2>編集履歴</h2>
      {revs.length === 0 ? (
        <p className="muted">まだ公開していません。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>版</th><th>公開日時</th><th>工程数</th><th>変更点</th></tr></thead>
            <tbody>
              {revs.map((r) => (
                <tr key={r.version}><td>第{r.version}版</td><td>{fmtShort(r.published_at)}</td><td>{r.steps.length}</td><td>{r.note || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 14 }}><Link href={`/admin/manuals/${id}/quiz`}>→ このマニュアルのクイズを作る</Link></p>
      {toast.node}
    </>
  );
}
