// C. マニュアルをテンプレートとして書き出す／取り込む（写真・個人情報は含めない）

export const TEMPLATE_FORMAT = 'shopnavi-template';
export const TEMPLATE_VERSION = 1;
export const MAX_STEPS = 30;

export type SharedTemplate = {
  format: typeof TEMPLATE_FORMAT;
  version: number;
  title: string;
  steps: { question: string; body: string }[];
  note: string;
};

const PHONE = /(?:\+?81[-\s]?|0)\d{1,4}[-\s(]?\d{1,4}[-\s)]?\d{3,4}/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /https?:\/\/\S+/g;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 電話番号・メール・URL・店舗名・スタッフの呼び名を伏せる */
export function scrubText(text: string, names: string[] = []): string {
  let s = String(text ?? '');
  s = s.replace(EMAIL, '（メール）').replace(URL_RE, '（URL）').replace(PHONE, '（電話番号）');
  for (const n of names.filter((x) => x && x.trim().length >= 2).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(escapeRe(n.trim()), 'g'), '（名前）');
  }
  return s;
}

/** 書き出し用のテンプレートを作る（写真のパス・ID・店舗IDは含めない） */
export function buildTemplate(
  title: string,
  steps: { question: string; body: string; photo_path?: string | null }[],
  names: string[] = [],
): SharedTemplate {
  return {
    format: TEMPLATE_FORMAT,
    version: TEMPLATE_VERSION,
    title: scrubText(title, names).slice(0, 60),
    steps: steps
      .filter((s) => s.body.trim() || s.question.trim())
      .slice(0, MAX_STEPS)
      .map((s) => ({ question: scrubText(s.question, names).slice(0, 200), body: scrubText(s.body, names).slice(0, 200) })),
    note: '写真・店舗名・スタッフの呼び名・連絡先は含まれていません',
  };
}

/** 取り込むファイルを検証する。不正なら例外 */
export function parseTemplate(json: string): SharedTemplate {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error('ファイルの形式が正しくありません');
  }
  const o = v as Partial<SharedTemplate>;
  if (!o || o.format !== TEMPLATE_FORMAT || o.version !== TEMPLATE_VERSION) throw new Error('ShopNavi のテンプレートではありません');
  if (typeof o.title !== 'string' || !o.title.trim()) throw new Error('タイトルがありません');
  if (!Array.isArray(o.steps) || o.steps.length === 0 || o.steps.length > MAX_STEPS) throw new Error(`工程は1〜${MAX_STEPS}個にしてください`);
  const steps = o.steps.map((s) => {
    const q = (s as { question?: unknown }).question;
    const b = (s as { body?: unknown }).body;
    if (typeof q !== 'string' || typeof b !== 'string') throw new Error('工程の形式が正しくありません');
    return { question: q.slice(0, 200), body: b.slice(0, 200) };
  });
  return { format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, title: o.title.trim().slice(0, 60), steps, note: String(o.note ?? '').slice(0, 200) };
}
