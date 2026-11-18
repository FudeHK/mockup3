'use client';
import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { toCsv, type CsvValue } from '@/lib/csv';
import { addDays, fmtDateTime, jstDate, jstStartIso } from '@/lib/format';
import { useFeatures } from '@/lib/features';
import { METHOD_LABEL, type InputMethod } from '@/lib/v2/voice';

const TYPE_LABEL: Record<string, string> = {
  manual_published: 'マニュアル公開',
  view_start: '閲覧開始',
  view_end: '閲覧終了',
  step_view: '工程閲覧',
  confusion: 'わからない',
  quiz_result: 'クイズ結果',
};
// v2-A: 入力方法（音声／手入力）。フラグ ON の店舗だけ CSV に含める
const INPUT_LABEL = '入力方法';
const UNIT: Record<string, string> = { manual_published: '作成時間(秒)', view_end: '閲覧時間(秒)', quiz_result: '正答率(%)' };

type Ev = {
  created_at: string; event_type: string; manual_title: string; manual_version: number | null; step_no: number | null;
  alias_name: string; value: number | null; detail: string; session_id: string | null;
};

export default function LogsPage() {
  return (
    <Shell role="admin">
      <Logs />
    </Shell>
  );
}

function Logs() {
  const { me } = useSession();
  const voiceOn = useFeatures().has('voice_input');
  const today = jstDate();
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [msg, setMsg] = useState('');

  const fetchAll = async (): Promise<Ev[]> => {
    const out: Ev[] = [];
    const PAGE = 1000;
    for (let off = 0; off < 100000; off += PAGE) {
      const { data, error } = await sb()
        .from('usage_events')
        .select('created_at,event_type,manual_title,manual_version,step_no,alias_name,value,detail,session_id')
        .eq('store_id', me!.storeId)
        .gte('created_at', jstStartIso(from))
        .lt('created_at', jstStartIso(addDays(to, 1)))
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(off, off + PAGE - 1);
      if (error) throw error;
      out.push(...((data as Ev[]) ?? []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  };

  const fetchInputLogs = async (): Promise<Ev[]> => {
    if (!voiceOn) return [];
    const out: Ev[] = [];
    const PAGE = 1000;
    for (let off = 0; off < 100000; off += PAGE) {
      const { data, error } = await sb()
        .from('input_logs')
        .select('created_at,manual_title,step_no,method,chars')
        .eq('store_id', me!.storeId)
        .gte('created_at', jstStartIso(from))
        .lt('created_at', jstStartIso(addDays(to, 1)))
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(off, off + PAGE - 1);
      if (error) return out;
      const rows = (data ?? []) as { created_at: string; manual_title: string; step_no: number | null; method: InputMethod; chars: number }[];
      out.push(...rows.map((r) => ({ created_at: r.created_at, event_type: 'input_method', manual_title: r.manual_title, manual_version: null,
        step_no: r.step_no, alias_name: '管理者', value: r.chars, detail: METHOD_LABEL[r.method] ?? r.method, session_id: null })));
      if (rows.length < PAGE) break;
    }
    return out;
  };

  const exportCsv = async () => {
    if (from > to) return setMsg('期間の開始日が終了日より後になっています');
    setBusy(true);
    setMsg('');
    try {
      const base = await fetchAll();
      const extra = await fetchInputLogs();
      const rows = extra.length ? [...base, ...extra].sort((a, b) => a.created_at.localeCompare(b.created_at)) : base;
      const counts: Record<string, number> = {};
      rows.forEach((r) => (counts[r.event_type] = (counts[r.event_type] ?? 0) + 1));
      setSummary(counts);
      const csv = toCsv(
        ['日時（日本時間）', '種別', 'マニュアル', '版', '工程', 'スタッフ（仮名）', '値', '値の単位', '詳細', '閲覧セッションID'],
        rows.map((r): CsvValue[] => [
          fmtDateTime(r.created_at), r.event_type === 'input_method' ? INPUT_LABEL : TYPE_LABEL[r.event_type] ?? r.event_type, r.manual_title, r.manual_version,
          r.step_no, r.alias_name, r.value === null ? null : Number(r.value), r.event_type === 'input_method' ? '文字数' : UNIT[r.event_type] ?? '', r.detail, r.session_id,
        ]),
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shopnavi_log_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setMsg(`${rows.length}件を出力しました`);
    } catch {
      setMsg('出力できませんでした。通信状態を確認してください');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>利用ログ・CSV出力</h1>
      <p className="lead">期間を選んで CSV を出力します（Excel でそのまま開けます）。</p>
      <div className="card">
        <div className="grid two">
          <div><label htmlFor="from">開始日</label><input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label htmlFor="to">終了日</label><input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <button className="btn big block" style={{ marginTop: 14 }} onClick={exportCsv} disabled={busy} data-testid="export-csv">
          {busy ? '出力中…' : '⬇ CSVを出力'}
        </button>
        {msg && <p role="status" className="ok">{msg}</p>}
      </div>
      {summary && (
        <div className="card">
          <h3>期間内の件数</h3>
          <div className="table-wrap"><table><tbody>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <tr key={k}><th>{v}</th><td>{summary[k] ?? 0}件</td></tr>)}
            {voiceOn && <tr><th>{INPUT_LABEL}</th><td>{summary.input_method ?? 0}件</td></tr>}
          </tbody></table></div>
        </div>
      )}
      <div className="card">
        <h3>CSV に含まれる記録</h3>
        <ul style={{ margin: 0 }}>
          <li>マニュアル公開：初回は「作成開始→公開」の秒数</li>
          <li>閲覧開始・閲覧終了（閲覧時間の秒数）・工程ごとの閲覧</li>
          <li>「わからない」の押下（マニュアル・工程・スタッフの仮名）</li>
          <li>クイズ結果（正答率）</li>
          {voiceOn && <li>入力方法（工程ごとに「音声」「手入力」「音声＋手入力」と文字数）</li>}
        </ul>
        <p className="muted">数式として実行されないよう、先頭が = + - @ の値には &apos; を付けています。</p>
      </div>
    </>
  );
}
