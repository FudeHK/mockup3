'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { logView } from '@/lib/log';
import { useSpeech } from '@/lib/speech';
import { useSignedUrls } from '@/lib/photos';
import type { Revision } from '@/lib/types';

export default function ViewerPage() {
  return (
    <Shell role="staff" wide>
      <Viewer />
    </Shell>
  );
}

function Viewer() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const toast = useToast();
  const speech = useSpeech();
  const [rev, setRev] = useState<Revision | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [sentAt, setSentAt] = useState<Record<string, number>>({});
  const session = useRef<string>('');
  const startedAt = useRef<number>(0);
  const ended = useRef(false);

  const steps = rev?.steps ?? [];
  const step = steps[idx];
  const urls = useSignedUrls(steps.map((s) => s.photo_path));

  useEffect(() => {
    if (!me) return;
    const c = sb();
    void (async () => {
      const { data: m } = await c.from('manuals').select('id,version').eq('id', id).eq('status', 'published').maybeSingle();
      if (!m) return setNotFound(true);
      const { data: r } = await c.from('manual_revisions').select('*').eq('manual_id', id).eq('version', m.version).maybeSingle();
      if (!r) return setNotFound(true);
      setRev(r as Revision);
      const q = await c.rpc('get_quiz', { p_manual_id: id });
      setHasQuiz(Array.isArray(q.data) && q.data.length > 0);
      session.current = crypto.randomUUID();
      startedAt.current = Date.now();
      ended.current = false;
      void logView(me.storeId, 'view_start', { manual_id: id, session_id: session.current }, me.userId);
    })();
  }, [id, me]);

  const endView = useCallback(
    (detail: string) => {
      if (!me || !session.current || ended.current) return;
      ended.current = true;
      const sec = Math.round((Date.now() - startedAt.current) / 1000);
      void logView(me.storeId, 'view_end', { manual_id: id, session_id: session.current, value: sec, detail }, me.userId);
    },
    [id, me],
  );

  // 工程ごとの閲覧ログ
  useEffect(() => {
    if (!me || !step || !session.current) return;
    void logView(me.storeId, 'step_view', { manual_id: id, session_id: session.current, step_id: step.id, step_no: step.no }, me.userId);
  }, [id, me, step]);

  // 画面を離れたら終了を記録
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') endView('途中で離脱');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      endView('途中で離脱');
    };
  }, [endView]);

  const { stop } = speech;
  useEffect(() => {
    stop();
  }, [idx, stop]);

  if (notFound) return <p className="card">このマニュアルは見つかりません。<Link href="/staff">一覧へ戻る</Link></p>;
  if (!rev || !step) return <p className="center-msg">読み込み中…</p>;

  const finish = async () => {
    if (me?.aliasId) {
      await sb().from('manual_acks').upsert(
        { manual_id: id, alias_id: me.aliasId, version: rev.version, store_id: me.storeId },
        { onConflict: 'manual_id,alias_id,version', ignoreDuplicates: true },
      );
    }
    endView('最後まで確認');
    setDone(true);
  };

  const unknown = async () => {
    if (!me) return;
    const last = sentAt[step.id] ?? 0;
    if (Date.now() - last < 10000) return toast.show('さきほど伝えました。管理者が確認します');
    setSentAt((s) => ({ ...s, [step.id]: Date.now() }));
    const { error } = await sb().from('confusions').insert({
      store_id: me.storeId,
      manual_id: id,
      step_id: step.id,
      step_no: step.no,
      step_text: step.body.slice(0, 200),
      user_id: me.userId,
    });
    toast.show(error ? '送信できませんでした。もう一度押してください' : '「わからない」を管理者に伝えました');
    if (error) setSentAt((s) => ({ ...s, [step.id]: 0 }));
  };

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 720, margin: '20px auto', textAlign: 'center' }}>
        <h1>✅ 最後まで確認しました</h1>
        <p className="lead">「{rev.title}」第{rev.version}版</p>
        <div className="grid two" style={{ marginTop: 16 }}>
          {hasQuiz && <Link className="btn big" href={`/staff/manuals/${id}/quiz`}>理解度クイズに答える</Link>}
          <button className="btn big ghost" onClick={() => router.push('/staff')}>一覧へ戻る</button>
        </div>
      </div>
    );
  }

  const last = idx === steps.length - 1;
  const photo = step.photo_path ? urls[step.photo_path] : null;

  return (
    <div className="viewer">
      <div className="viewer-head">
        <div className="row grow">
          <Link href="/staff" className="btn ghost small" onClick={() => endView('一覧へ戻った')}>← 一覧</Link>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }} className="grow">{rev.title}</h1>
        </div>
        <span className="step-no" aria-live="polite">工程 {idx + 1} / {steps.length}</span>
      </div>
      <div className="progress" aria-hidden><i style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
      <section className="step-card" aria-label={`工程${idx + 1}`}>
        <div className="step-photo">
          {step.photo_path ? (photo ? <img src={photo} alt={`工程${idx + 1}の写真`} /> : <span className="muted">写真を読み込み中…</span>) : <span className="muted" style={{ fontSize: '3rem' }} aria-hidden>📋</span>}
        </div>
        <div>
          {step.question && <p className="step-q">{step.question}</p>}
          <p className="step-text" data-testid="step-text">{step.body}</p>
        </div>
      </section>
      <div className="viewer-actions">
        <button className="btn ghost va-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>← 前へ</button>
        <button className="btn unknown va-unknown" onClick={unknown} data-testid="unknown">🙋 わからない</button>
        <button
          className="btn ghost va-speak"
          onClick={() => (speech.speaking ? speech.stop() : speech.speak(`工程${idx + 1}。${step.body}`))}
          disabled={!speech.supported}
          aria-describedby="speech-note"
        >
          {speech.speaking ? '■ 停止' : '🔊 読み上げ'}
        </button>
        {last ? (
          <button className="btn green va-next" onClick={finish}>確認しました ✓</button>
        ) : (
          <button className="btn va-next" onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>次へ →</button>
        )}
      </div>
      {!speech.supported && !speech.checking && <p id="speech-note" className="speech-note">🔇 読み上げを使えません：{speech.reason}</p>}
      {toast.node}
    </div>
  );
}
