const TZ = 'Asia/Tokyo';

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(iso)).replace(/\//g, '-');
}

export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

export function fmtDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}分${sec % 60 ? `${sec % 60}秒` : ''}`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}

/** 日本時間の YYYY-MM-DD */
export function jstDate(d = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
}

/** 日本時間の日付（YYYY-MM-DD）の 0:00 を ISO 文字列に */
export function jstStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+09:00`).toISOString();
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return jstDate(d);
}
