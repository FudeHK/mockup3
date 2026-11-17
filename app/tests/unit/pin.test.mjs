// 単体テスト: PIN 照合とロック（サーバー側 RPC public.join_store をローカル Postgres で検証）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setup, newUser, as, join, DEMO } from '../local/db.mjs';

let pool;
before(async () => { pool = await setup(); });
after(async () => { await pool.end(); });

test('PIN はハッシュで保存され、平文は残らない', async () => {
  const r = await pool.query('select admin_pin_hash, staff_pin_hash from public.store_secrets where store_id=$1', [DEMO.storeId]);
  const { admin_pin_hash, staff_pin_hash } = r.rows[0];
  assert.match(admin_pin_hash, /^\$2[aby]\$/);
  assert.ok(!admin_pin_hash.includes(DEMO.admin));
  assert.ok(!staff_pin_hash.includes(DEMO.staff));
});

test('管理者PINで admin、スタッフPINで staff として入室できる', async () => {
  const a = await newUser(pool);
  const s = await newUser(pool);
  const ra = await join(pool, a, DEMO.admin);
  const rs = await join(pool, s, DEMO.staff);
  assert.equal(ra.ok, true); assert.equal(ra.role, 'admin');
  assert.equal(rs.ok, true); assert.equal(rs.role, 'staff');
  const m = await pool.query('select role from public.store_members where user_id=$1', [s]);
  assert.equal(m.rows[0].role, 'staff');
});

test('誤ったPIN・存在しない店舗・形式不正は失敗し、残り回数が減る', async () => {
  const u = await newUser(pool);
  const dev = crypto.randomUUID();
  const r1 = await join(pool, u, '000000', DEMO.code, dev);
  assert.equal(r1.ok, false); assert.equal(r1.reason, 'invalid'); assert.equal(r1.remaining, 4);
  const r2 = await join(pool, u, '135790', 'nope-store', dev);
  assert.equal(r2.reason, 'invalid'); assert.equal(r2.remaining, 3);
  const r3 = await join(pool, u, "1' or '1'='1", DEMO.code, dev);
  assert.equal(r3.reason, 'invalid'); assert.equal(r3.remaining, 2);
  const m = await pool.query('select 1 from public.store_members where user_id=$1', [u]);
  assert.equal(m.rowCount, 0);
});

test('同じ端末で5回失敗すると15分ロックされ、正しいPINでも入れない', async () => {
  const u = await newUser(pool);
  const dev = crypto.randomUUID();
  let last;
  for (let i = 0; i < 5; i++) last = await join(pool, u, '111111', DEMO.code, dev);
  assert.equal(last.ok, false); assert.equal(last.reason, 'locked');
  const until = new Date(last.locked_until).getTime();
  const mins = (until - Date.now()) / 60000;
  assert.ok(mins > 14.5 && mins <= 15.1, `lock minutes = ${mins}`);
  const r = await join(pool, u, DEMO.admin, DEMO.code, dev);
  assert.equal(r.ok, false); assert.equal(r.reason, 'locked');
  // 別の端末は影響を受けない
  const r2 = await join(pool, u, DEMO.admin, DEMO.code, crypto.randomUUID());
  assert.equal(r2.ok, true);
});

test('ロックの期限が過ぎれば再び入室でき、失敗回数もリセットされる', async () => {
  const u = await newUser(pool);
  const dev = crypto.randomUUID();
  for (let i = 0; i < 5; i++) await join(pool, u, '111111', DEMO.code, dev);
  // 時間経過を再現（ロックと失敗履歴を16分前に移動）
  await pool.query("update public.pin_locks set locked_until = now() - interval '1 minute' where device_id=$1", [dev]);
  await pool.query("update public.pin_attempts set created_at = created_at - interval '16 minutes' where device_id=$1", [dev]);
  const r1 = await join(pool, u, '111111', DEMO.code, dev);
  assert.equal(r1.reason, 'invalid'); assert.equal(r1.remaining, 4);
  const r2 = await join(pool, u, DEMO.staff, DEMO.code, dev);
  assert.equal(r2.ok, true);
});

test('成功すると失敗回数がリセットされる', async () => {
  const u = await newUser(pool);
  const dev = crypto.randomUUID();
  for (let i = 0; i < 4; i++) await join(pool, u, '111111', DEMO.code, dev);
  assert.equal((await join(pool, u, DEMO.staff, DEMO.code, dev)).ok, true);
  const r = await join(pool, u, '111111', DEMO.code, dev);
  assert.equal(r.remaining, 4);
});

test('未ログイン（anon）は PIN 照合 RPC を実行できない', async () => {
  await assert.rejects(as(pool, null, "select public.join_store('demo','135790','abcdefgh1234')"), /permission denied/);
});

test('PIN 変更は管理者のみ・6〜8桁・もう一方と同じPINは不可', async () => {
  const a = await newUser(pool); await join(pool, a, DEMO.admin);
  const s = await newUser(pool); await join(pool, s, DEMO.staff);
  await assert.rejects(as(pool, s, "select public.set_store_pin('admin','999999')"), /admin only/);
  assert.equal((await as(pool, a, "select public.set_store_pin('staff','12') j")).rows[0].j.reason, 'format');
  assert.equal((await as(pool, a, `select public.set_store_pin('staff','${DEMO.admin}') j`)).rows[0].j.reason, 'same_as_other');
  assert.equal((await as(pool, a, "select public.set_store_pin('staff','555555') j")).rows[0].j.ok, true);
  const u = await newUser(pool);
  assert.equal((await join(pool, u, '555555')).role, 'staff');
  assert.equal((await join(pool, u, DEMO.staff)).ok, false);
  await as(pool, a, `select public.set_store_pin('staff','${DEMO.staff}')`);
});
