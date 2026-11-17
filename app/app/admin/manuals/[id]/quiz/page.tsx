'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { fmtShort } from '@/lib/format';
import type { QuizQuestion, RevisionStep } from '@/lib/types';

type Attempt = { id: string; total: number; correct: number; rate: number; created_at: string; alias_id: string | null };

export default function QuizBuilderPage() {
  return (
    <Shell role="admin">
      <QuizBuilder />
    </Shell>
  );
}

function QuizBuilder() {
  const { id } = useParams<{ id: string }>();
  const { me } = useSession();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState<RevisionStep[]>([]);
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [stepNo, setStepNo] = useState<number>(0);
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '']);
  const [correct, setCorrect] = useState(0);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const c = sb();
    const { data: m } = await c.from('manuals').select('title,version').eq('id', id).maybeSingle();
    setTitle(m?.title ?? '');
    if (m && m.version > 0) {
      const { data: r } = await c.from('manual_revisions').select('steps').eq('manual_id', id).eq('version', m.version).maybeSingle();
      setSteps((r?.steps as RevisionStep[]) ?? []);
    }
    const [q, a, al] = await Promise.all([
      c.from('quiz_questions').select('*').eq('manual_id', id).order('created_at'),
      c.from('quiz_attempts').select('id,total,correct,rate,created_at,alias_id').eq('manual_id', id).order('created_at', { ascending: false }).limit(50),
      c.from('staff_aliases').select('id,name'),
    ]);
    setQs((q.data as QuizQuestion[]) ?? []);
    setAttempts((a.data as Attempt[]) ?? []);
    setAliases(Object.fromEntries(((al.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    void load();
  }, [load]);

  const pickStep = (no: number) => {
    setStepNo(no);
    const s = steps.find((x) => x.no === no);
    if (s) {
      setQuestion(s.question ? `${s.question}` : `工程${no}で正しいのはどれ？`);
      setChoices((c) => [s.body, c[1] ?? '', c[2] ?? '']);
      setCorrect(0);
    }
  };

  const add = async () => {
    setErr('');
    const list = choices.map((c) => c.trim()).filter(Boolean);
    if (!question.trim()) return setErr('問題文を入力してください');
    if (list.length < 2) return setErr('選択肢を2つ以上入力してください');
    if (!choices[correct]?.trim()) return setErr('正解の選択肢を入力してください');
    const correctIndex = list.indexOf(choices[correct].trim());
    const step = steps.find((s) => s.no === stepNo);
    const { error } = await sb().from('quiz_questions').insert({
      store_id: me!.storeId, manual_id: id, step_id: step?.id ?? null, step_no: step?.no ?? null,
      question: question.trim(), choices: list, correct_index: correctIndex,
    });
    if (error) return setErr('保存できませんでした');
    toast.show('問題を追加しました');
    setQuestion('');
    setChoices(['', '', '']);
    setCorrect(0);
    setStepNo(0);
    await load();
  };

  const remove = async (qid: string) => {
    if (!confirm('この問題を削除しますか？')) return;
    await sb().from('quiz_questions').delete().eq('id', qid);
    await load();
  };

  const avg = attempts.length ? Math.round((attempts.reduce((a, x) => a + Number(x.rate), 0) / attempts.length) * 10) / 10 : null;

  return (
    <>
      <p><Link href={`/admin/manuals/${id}`}>← マニュアル編集へ</Link></p>
      <h1>理解度クイズ</h1>
      <p className="lead">「{title}」の工程から選択式の問題を作ります。</p>
      {steps.length === 0 && <p className="card alert">先にマニュアルを公開してください（公開版の工程から問題を作ります）。</p>}

      <div className="card">
        <label htmlFor="step">もとにする工程</label>
        <select id="step" value={stepNo} onChange={(e) => pickStep(Number(e.target.value))}>
          <option value={0}>選んでください</option>
          {steps.map((s) => <option key={s.id} value={s.no}>工程{s.no}：{s.body.slice(0, 30)}</option>)}
        </select>
        <label htmlFor="qtext">問題文</label>
        <input id="qtext" type="text" maxLength={120} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, margin: '10px 0 4px' }}>選択肢（正解に ● を付ける）</legend>
          {choices.map((c, i) => (
            <div key={i} className="row" style={{ marginBottom: 6 }}>
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`選択肢${i + 1}を正解にする`} style={{ width: 24, height: 24 }} />
              <input type="text" value={c} maxLength={60} placeholder={`選択肢${i + 1}`} aria-label={`選択肢${i + 1}`} onChange={(e) => setChoices((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          {choices.length < 4 && <button className="btn ghost small" onClick={() => setChoices((l) => [...l, ''])}>＋ 選択肢</button>}
        </fieldset>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn block" style={{ marginTop: 10 }} onClick={add} disabled={steps.length === 0} data-testid="add-question">問題を追加</button>
      </div>

      <h2>問題一覧（{qs.length}問）</h2>
      {qs.map((q, i) => (
        <div key={q.id} className="card">
          <div className="row between">
            <strong>Q{i + 1}. {q.question}</strong>
            <button className="btn ghost small" onClick={() => remove(q.id)}>削除</button>
          </div>
          <ol style={{ margin: '6px 0 0' }}>
            {q.choices.map((c, ci) => <li key={ci}>{c} {ci === q.correct_index && <span className="tag g">正解</span>}</li>)}
          </ol>
        </div>
      ))}

      <h2>回答結果 {avg !== null && <span className="tag b">平均正答率 {avg}%</span>}</h2>
      {attempts.length === 0 ? <p className="muted">まだ回答はありません。</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>日時</th><th>スタッフ</th><th>正解</th><th>正答率</th></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}><td>{fmtShort(a.created_at)}</td><td>{a.alias_id ? aliases[a.alias_id] ?? '—' : '—'}</td><td>{a.correct}/{a.total}</td><td>{a.rate}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast.node}
    </>
  );
}
