// 端末ID（PINロックの単位）。個人を特定する情報は含まない乱数。
export function deviceId(): string {
  const k = 'shopnavi-device-id';
  let v = localStorage.getItem(k);
  if (!v || !/^[A-Za-z0-9-]{8,64}$/.test(v)) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}
