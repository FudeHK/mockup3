// B. 広報画像: テンプレートに文字を流し込む（AI生成なし。フォントは端末の標準書体のみ）

export const BANNED = ['日本一', '世界一', '絶対', '最安', '最高', 'No.1', 'ナンバーワン', '業界初', '必ず', '完全', '地域一番', '一番'];

/** 景品表示法に触れるおそれのある言い切り表現を探す */
export function expressionWarnings(text: string): string[] {
  const t = String(text ?? '');
  return BANNED.filter((w) => t.includes(w));
}

export type PromoText = { shop: string; menu: string; copy: string };
export type Size = { key: string; label: string; w: number; h: number };
export const SIZES: Size[] = [
  { key: 'square', label: '正方形（SNS投稿）1080×1080', w: 1080, h: 1080 },
  { key: 'story', label: '縦長（ストーリーズ）1080×1920', w: 1080, h: 1920 },
  { key: 'wide', label: '横長（地図・Web）1200×675', w: 1200, h: 675 },
];

export type TemplateKey = 'frame' | 'band' | 'card';
export const TEMPLATES: { key: TemplateKey; name: string; bg: string; accent: string; ink: string }[] = [
  { key: 'frame', name: '案A 枠どり', bg: '#fff8f0', accent: '#b9501f', ink: '#3b2a1d' },
  { key: 'band', name: '案B 帯', bg: '#1f2d4a', accent: '#1f2d4a', ink: '#ffffff' },
  { key: 'card', name: '案C カード', bg: '#f3e7d3', accent: '#4f8f60', ink: '#ffffff' },
];

export type Rect = { x: number; y: number; w: number; h: number };

/** テンプレートごとの写真の枠と文字の枠 */
export function layout(t: TemplateKey, W: number, H: number): { photo: Rect; text: Rect; panel: Rect | null } {
  const wide = W > H * 1.2;
  const m = Math.round(Math.min(W, H) * 0.05);
  if (t === 'frame') {
    if (wide) return { photo: { x: m, y: m, w: W * 0.55 - m, h: H - 2 * m }, text: { x: W * 0.55 + m, y: m, w: W * 0.45 - 2 * m, h: H - 2 * m }, panel: null };
    const ph = H * (H > W * 1.5 ? 0.6 : 0.62);
    return { photo: { x: m, y: m, w: W - 2 * m, h: ph }, text: { x: m, y: m + ph + m / 2, w: W - 2 * m, h: H - ph - m * 2.5 }, panel: null };
  }
  if (t === 'band') {
    if (wide) return { photo: { x: 0, y: 0, w: W * 0.58, h: H }, panel: { x: W * 0.58, y: 0, w: W * 0.42, h: H }, text: { x: W * 0.58 + m, y: m, w: W * 0.42 - 2 * m, h: H - 2 * m } };
    const ph = H * 0.66;
    return { photo: { x: 0, y: 0, w: W, h: ph }, panel: { x: 0, y: ph, w: W, h: H - ph }, text: { x: m, y: ph + m / 2, w: W - 2 * m, h: H - ph - m } };
  }
  // card: 写真を全面に敷き、下部に角丸のカード
  const ch = wide ? H * 0.42 : H * 0.34;
  const panel = { x: m, y: H - ch - m, w: W - 2 * m, h: ch };
  return { photo: { x: 0, y: 0, w: W, h: H }, panel, text: { x: panel.x + m / 2, y: panel.y + m / 3, w: panel.w - m, h: panel.h - (m * 2) / 3 } };
}

/** 写真を枠いっぱいに切り抜くための元画像側の範囲（cover） */
export function coverCrop(iw: number, ih: number, box: Rect): Rect {
  const s = Math.max(box.w / iw, box.h / ih);
  const w = box.w / s;
  const h = box.h / s;
  return { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
}

/** 幅に収まるよう文字列を行に分ける（measure は1行の幅を返す関数） */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const chars = [...String(text ?? '').trim()];
  const lines: string[] = [];
  let cur = '';
  for (const c of chars) {
    if (measure(cur + c) > maxWidth && cur) {
      lines.push(cur);
      cur = c;
      if (lines.length === maxLines) break;
    } else cur += c;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  else if (lines.length === maxLines && cur && lines.join('').length < chars.length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  return lines;
}

export const FONT_STACK = '"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,system-ui,sans-serif';
