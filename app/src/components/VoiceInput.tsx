'use client';
import { useEffect, useRef, useState } from 'react';
import { recognitionSupport } from '@/lib/v2/voice';

// A. Web Speech API の音声認識（ja-JP）。非対応の端末ではボタンを無効にして理由を表示する
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

let active: Rec | null = null;

export function useRecognitionSupport() {
  const [s, setS] = useState({ supported: false, reason: '', checked: false });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 端末の対応状況を初回に判定
    setS({ ...recognitionSupport(window as unknown as Parameters<typeof recognitionSupport>[0]), checked: true });
  }, []);
  return s;
}

const ERR: Record<string, string> = {
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください',
  'service-not-allowed': 'この端末では音声認識サービスを使えません',
  'no-speech': '声が聞き取れませんでした。もう一度お試しください',
  network: '音声認識に必要な通信ができませんでした',
  'audio-capture': 'マイクが見つかりません',
};

export function VoiceButton({ label = '🎤 音声で入力', onText, testId, block = false }: { label?: string; onText: (t: string) => void; testId?: string; block?: boolean }) {
  const sup = useRecognitionSupport();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [err, setErr] = useState('');
  const rec = useRef<Rec | null>(null);
  const finals = useRef('');

  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    setErr('');
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!C) return;
    active?.abort();
    const r = new C();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;
    finals.current = '';
    r.onresult = (e) => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current += res[0].transcript + ' ';
        else tmp += res[0].transcript;
      }
      setInterim(tmp);
    };
    r.onerror = (e) => setErr(ERR[e.error] ?? `音声認識でエラーが起きました（${e.error}）`);
    r.onend = () => {
      setListening(false);
      setInterim('');
      if (active === r) active = null;
      const text = finals.current.trim();
      if (text) onText(text);
    };
    rec.current = r;
    active = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setErr('音声認識を開始できませんでした');
    }
  };

  const stop = () => rec.current?.stop();

  return (
    <span className="voice" style={block ? { display: 'block' } : undefined}>
      <button
        type="button"
        className={`btn small ${listening ? 'red' : 'ghost'} ${block ? 'block' : ''}`}
        onClick={listening ? stop : start}
        disabled={!sup.supported}
        aria-pressed={listening}
        data-testid={testId}
        title={sup.supported ? '' : sup.reason}
      >
        {listening ? '■ 止めて反映' : label}
      </button>
      {listening && <span className="muted" role="status"> 聞き取り中… {interim}</span>}
      {sup.checked && !sup.supported && <span className="muted voice-note" data-testid="voice-unsupported"> 🔇 {sup.reason}</span>}
      {err && <span className="err" role="alert"> {err}</span>}
    </span>
  );
}
