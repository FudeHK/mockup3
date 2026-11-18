// C. 招待リンク: 推測できないトークンを端末で作り、DB にはハッシュだけを保存する

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** トークンは URL の # 以降に置く（サーバーのアクセスログに残らない） */
export function inviteUrl(origin: string, token: string): string {
  return `${origin}/invite#t=${token}`;
}

export function tokenFromHash(hash: string): string {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{32,64})(?:&|$)/.exec(hash || '');
  return m ? m[1] : '';
}

/** 推測されやすいPIN（同じ数字・連番・繰り返し）を弾く */
export function weakPin(pin: string): boolean {
  if (!/^\d{6,8}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const diffs = new Set(d.slice(1).map((x, i) => x - d[i]));
  if (new Set(d).size <= 2) return true;
  if (diffs.size === 1 && [1, -1, 0].includes([...diffs][0])) return true;
  const half = pin.length / 2;
  if (pin.length % 2 === 0 && pin.slice(0, half) === pin.slice(half)) return true;
  return false;
}

export const STORE_CODE_RE = /^[a-z0-9-]{3,32}$/;
