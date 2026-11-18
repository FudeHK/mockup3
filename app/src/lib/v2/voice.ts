// A. 音声でマニュアル作成: 認識結果を工程の文章に整える（端末内で処理。外部に送らない）

export const MAX_STEP_CHARS = 200;

// 話し言葉によく入る言いよどみ（文頭・読点の後のみ除去する）
// 「あの棚」「その後」などを壊さないよう、伸ばす音のある言いよどみだけを対象にする
const FILLERS = ['えーっと', 'えーと', 'ええと', 'えっと', 'あのー', 'そのー', 'うーん', 'えー', 'まあ'];
const FILLER_RE = new RegExp(`(^|[、。\\s])(?:${FILLERS.join('|')})[、\\s]*`, 'g');

// 工程の区切りとみなす言葉
const SPLIT_RE = /(?:^|[、。\s])(?:次に|つぎに|それから|そのあと|その後|最後に|さいごに)[、\s]*/g;

/** 認識結果の1まとまりを、工程の一言（200文字以内・文末に句点）に整える */
export function toStepText(raw: string): string {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) s = s.replace(FILLER_RE, '$1');
  s = s.replace(/^[、。\s]+/, '').replace(/\s*、\s*/g, '、').replace(/\s+/g, '').replace(/、+/g, '、');
  s = s.replace(/[、\s]+$/, '');
  if (!s) return '';
  if (!/[。！？!?]$/.test(s)) s += '。';
  if (s.length > MAX_STEP_CHARS) s = s.slice(0, MAX_STEP_CHARS - 1) + '…';
  return s;
}

/** 「次に」「それから」などで区切って、複数の工程に分ける */
export function splitIntoSteps(raw: string): string[] {
  const marked = String(raw ?? '').replace(SPLIT_RE, '\u0000');
  return marked.split('\u0000').map(toStepText).filter(Boolean);
}

/** 既存の本文に音声の結果を足す */
export function appendText(current: string, addition: string): string {
  const a = toStepText(addition);
  if (!a) return current;
  const joined = current.trim() ? `${current.trim()}${/[。！？!?]$/.test(current.trim()) ? '' : '。'}${a}` : a;
  return joined.length > MAX_STEP_CHARS ? joined.slice(0, MAX_STEP_CHARS) : joined;
}

export type InputMethod = 'voice' | 'typed' | 'mixed';
export function inputMethod(usedVoice: boolean, usedTyping: boolean): InputMethod | null {
  if (usedVoice && usedTyping) return 'mixed';
  if (usedVoice) return 'voice';
  if (usedTyping) return 'typed';
  return null;
}
export const METHOD_LABEL: Record<InputMethod, string> = { voice: '音声', typed: '手入力', mixed: '音声＋手入力' };

type SpeechWindow = { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown; isSecureContext?: boolean };

/** 端末が音声認識に対応しているか（非対応なら理由を返す） */
export function recognitionSupport(w: SpeechWindow | undefined): { supported: boolean; reason: string } {
  if (!w) return { supported: false, reason: 'この画面では音声入力を使えません' };
  if (w.isSecureContext === false) return { supported: false, reason: '安全な接続（https）でないため音声入力を使えません' };
  if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
    return { supported: false, reason: 'この端末・ブラウザは音声入力（音声認識）に対応していません。Chrome または Safari の最新版でお試しください' };
  }
  return { supported: true, reason: '' };
}
