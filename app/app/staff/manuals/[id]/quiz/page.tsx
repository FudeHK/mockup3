'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';

type Q = { id: string; step_no: number | null; question: string; choices: string[] };
type Result = { ok: boolean; total: number; correct: number; rate: number; correct_map: Record<string, number> };

export default function StaffQuizPage() {
  return (
    <Shell role="staff">
      <Quiz />
    </Shell>
  );
}

function Quiz() {
  const { id } = useParams<{ id: string }>();
  const [qs, setQs] = useState<Q[] | null>(null);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    void sb().rpc('get_quiz', { p_manual_id: id }).then(({ data }) => setQs((data as Q[]) ?? []));
  }, [id]);

  const submit = async () => {
    setErr('');
    const { data, error } = await sb().rpc('submit_quiz', { p_manual_id: id, p_answers: ans });
    if (error || !data?.ok) return setErr('送信できませんでした。もう一度お試しください。');
    setRes(data as Result);
  };

  if (!qs) return <p className="muted">読み込み中…</p>;
  if (qs.length === 0) return <p className="card">このマニュアルにはクイズがありません。<Link href="/staff">一覧へ</Link></p>;
  const all = qs.every((q) => ans[q.id] !== undefined);

  return (
    <>
      <h1>理解度クイズ</h1>
      {res && (
        <div className="card" role="status" style={{ textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }} data-testid="quiz-score">{res.correct} / {res.total} 問正解（{res.rate}%）</h2>
          <Link className="btn" href="/staff">一覧へ戻る</Link>
        </div>
      )}
      {qs.map((q, i) => (
        <fieldset key={q.id} className="card" style={{ border: 0 }}>
          <legend style={{ fontWeight: 800, fontSize: '1.1rem', padding: 0 }}>
            Q{i + 1}. {q.question} {q.step_no ? <span className="tag">工程{q.step_no}</span> : null}
          </legend>
          {q.choices.map((c, ci) => {
            const cls = res ? (res.correct_map[q.id] === ci ? 'correct' : ans[q.id] === ci ? 'wrong' : '') : '';
            return (
              <label key={ci} className={`choice ${cls}`}>
                <input type="radio" name={q.id} checked={ans[q.id] === ci} disabled={!!res} onChange={() => setAns((a) => ({ ...a, [q.id]: ci }))} />
                {c}
                {res && res.correct_map[q.id] === ci && <span className="tag g">正解</span>}
              </label>
            );
          })}
        </fieldset>
      ))}
      {!res && <button className="btn big block" disabled={!all} onClick={submit}>答え合わせ</button>}
      {err && <p className="err">{err}</p>}
    </>
  );
}
