// RLS テスト: auth.uid() と役割による行レベルの制御をローカル Postgres で検証
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, newUser, as, join, DEMO } from '../local/db.mjs';

let pool, admin, staff, otherAdmin, outsider;
const OTHER = '00000000-0000-4000-8000-0000000000ff';
const OTHER_MANUAL = '00000000-0000-4000-8000-0000000001ff';

before(async () => {
  pool = await setup();
  // 他店舗を用意
  await pool.query(`insert into public.stores (id, code, name) values ($1, 'other', '他店舗')`, [OTHER]);
  await pool.query(`insert into public.store_secrets values ($1, extensions.crypt('111222', extensions.gen_salt('bf')), extensions.crypt('333444', extensions.gen_salt('bf')))`, [OTHER]);
  await pool.query(`insert into public.staff_aliases (store_id, name) values ($1, '他店スタッフ')`, [OTHER]);
  await pool.query(`insert into public.manuals (id, store_id, title, status, version) values ($1, $2, '他店の秘密マニュアル', 'published', 1)`, [OTHER_MANUAL, OTHER]);
  await pool.query(`insert into public.manual_revisions (manual_id, store_id, version, title, steps) values ($1, $2, 1, '他店', '[]')`, [OTHER_MANUAL, OTHER]);
  await pool.query(`insert into public.confusions (store_id, manual_id, step_no) values ($1, $2, 1)`, [OTHER, OTHER_MANUAL]);
  await pool.query(`insert into storage.objects (bucket_id, name) values ('manual-photos', $1)`, [`${OTHER}/x/secret.jpg`]);
  await pool.query(`insert into storage.objects (bucket_id, name) values ('manual-photos', $1)`, [`${DEMO.storeId}/x/demo.jpg`]);

  admin = await newUser(pool); assert.equal((await join(pool, admin, DEMO.admin)).role, 'admin');
  staff = await newUser(pool); assert.equal((await join(pool, staff, DEMO.staff)).role, 'staff');
  otherAdmin = await newUser(pool); assert.equal((await join(pool, otherAdmin, '111222', 'other')).role, 'admin');
  outsider = await newUser(pool); // ログイン済みだが店舗未参加
});
after(async () => { await pool.end(); });

const TABLES = ['stores', 'store_members', 'staff_aliases', 'manuals', 'manual_steps', 'manual_revisions',
  'reconfirm_requests', 'manual_acks', 'confusions', 'quiz_questions', 'quiz_attempts', 'usage_events',
  'store_secrets', 'pin_attempts', 'pin_locks', 'templates'];

test('未ログイン（anon）ではどのテーブルも読めない', async () => {
  for (const t of TABLES) {
    await assert.rejects(as(pool, null, `select * from public.${t}`), /permission denied/, t);
  }
  const objs = await as(pool, null, 'select * from storage.objects');
  assert.equal(objs.rowCount, 0, 'storage.objects');
});

test('未ログイン（anon）では RPC も実行できない', async () => {
  for (const sql of [`select public.get_quiz('${DEMO.manualId}')`, `select public.publish_manual('${DEMO.manualId}')`,
    `select public.submit_quiz('${DEMO.manualId}', '{}')`, `select public.select_alias('${DEMO.manualId}')`]) {
    await assert.rejects(as(pool, null, sql), /permission denied/, sql);
  }
});

test('店舗に未参加のユーザーは店舗データを読めない（テンプレートのみ）', async () => {
  for (const t of ['stores', 'manuals', 'manual_revisions', 'staff_aliases', 'confusions', 'usage_events']) {
    assert.equal((await as(pool, outsider, `select * from public.${t}`)).rowCount, 0, t);
  }
  assert.equal((await as(pool, outsider, 'select * from public.templates')).rowCount, 6);
});

test('PINハッシュ・試行履歴は管理者を含め誰も読めない', async () => {
  for (const t of ['store_secrets', 'pin_attempts', 'pin_locks']) {
    await assert.rejects(as(pool, admin, `select * from public.${t}`), /permission denied/, t);
  }
});

test('スタッフはマニュアルを作成・編集・削除・公開できない', async () => {
  await assert.rejects(as(pool, staff, `insert into public.manuals (store_id, title) values ($1, 'x')`, [DEMO.storeId]), /row-level security/);
  const u = await as(pool, staff, `update public.manuals set title='改ざん' where id=$1 returning id`, [DEMO.manualId]);
  assert.equal(u.rowCount, 0);
  const d = await as(pool, staff, `delete from public.manuals where id=$1 returning id`, [DEMO.manualId]);
  assert.equal(d.rowCount, 0);
  await assert.rejects(as(pool, staff, `insert into public.manual_steps (manual_id, store_id, position, body) values ($1,$2,9,'x')`, [DEMO.manualId, DEMO.storeId]), /row-level security/);
  assert.equal((await as(pool, staff, `update public.manual_steps set body='x' returning id`)).rowCount, 0);
  await assert.rejects(as(pool, staff, `select public.publish_manual($1)`, [DEMO.manualId]), /admin only/);
  await assert.rejects(as(pool, staff, `insert into public.manual_revisions (manual_id, store_id, version, title, steps) values ($1,$2,99,'x','[]')`, [DEMO.manualId, DEMO.storeId]), /row-level security/);
  const t = await pool.query('select title from public.manuals where id=$1', [DEMO.manualId]);
  assert.equal(t.rows[0].title, '開店準備（サンプル）');
});

test('スタッフは写真をアップロード・削除できない', async () => {
  await assert.rejects(as(pool, staff, `insert into storage.objects (bucket_id, name) values ('manual-photos', $1)`, [`${DEMO.storeId}/m/a.jpg`]), /row-level security/);
  assert.equal((await as(pool, staff, `delete from storage.objects returning id`)).rowCount, 0);
  // 自店舗の写真は閲覧できる
  assert.equal((await as(pool, staff, `select name from storage.objects`)).rowCount, 1);
});

test('スタッフは下書き・クイズの正答・ログ・他人の記録を読めない', async () => {
  await pool.query(`insert into public.manuals (store_id, title) values ($1, '下書き')`, [DEMO.storeId]);
  const m = await as(pool, staff, 'select title from public.manuals');
  assert.deepEqual(m.rows.map((r) => r.title), ['開店準備（サンプル）']);
  assert.equal((await as(pool, staff, 'select * from public.manual_steps')).rowCount, 0);
  assert.equal((await as(pool, staff, 'select * from public.quiz_questions')).rowCount, 0);
  assert.equal((await as(pool, staff, 'select * from public.usage_events')).rowCount, 0);
  assert.equal((await as(pool, staff, 'select * from public.confusions')).rowCount, 0);
  const q = await as(pool, staff, 'select * from public.get_quiz($1)', [DEMO.manualId]);
  assert.equal(q.rowCount, 1);
  assert.equal(q.rows[0].correct_index, undefined);
});

test('他店舗のデータは読めない（管理者・スタッフとも）', async () => {
  for (const uid of [admin, staff]) {
    for (const [t, col] of [['stores', 'id'], ['manuals', 'store_id'], ['manual_revisions', 'store_id'], ['staff_aliases', 'store_id'], ['confusions', 'store_id'], ['usage_events', 'store_id'], ['store_members', 'store_id']]) {
      const r = await as(pool, uid, `select 1 from public.${t} where ${col} = $1`, [OTHER]);
      assert.equal(r.rowCount, 0, `${t} as ${uid === admin ? 'admin' : 'staff'}`);
    }
    assert.equal((await as(pool, uid, `select 1 from storage.objects where name like $1`, [`${OTHER}/%`])).rowCount, 0);
    assert.equal((await as(pool, uid, 'select * from public.get_quiz($1)', [OTHER_MANUAL])).rowCount, 0);
  }
  // 他店舗の管理者は自店舗分しか見えない
  const s = await as(pool, otherAdmin, 'select id from public.stores');
  assert.deepEqual(s.rows.map((r) => r.id), [OTHER]);
});

test('他店舗へ書き込めない（管理者でも）', async () => {
  await assert.rejects(as(pool, admin, `insert into public.manuals (store_id, title) values ($1, 'x')`, [OTHER]), /row-level security/);
  assert.equal((await as(pool, admin, `update public.manuals set title='x' where id=$1 returning id`, [OTHER_MANUAL])).rowCount, 0);
  await assert.rejects(as(pool, staff, `insert into public.confusions (store_id, manual_id, step_no) values ($1,$2,1)`, [OTHER, OTHER_MANUAL]), /manual not in store|row-level security/);
  await assert.rejects(as(pool, admin, `insert into storage.objects (bucket_id, name) values ('manual-photos', $1)`, [`${OTHER}/m/a.jpg`]), /row-level security/);
  await assert.rejects(as(pool, staff, `select public.submit_quiz($1, '{}')`, [OTHER_MANUAL]), /not allowed/);
  // 自店舗の store_id を名乗って他店舗のマニュアルに工程・問題を差し込めない
  await assert.rejects(as(pool, admin, `insert into public.manual_steps (manual_id, store_id, position, body) values ($1,$2,1,'x')`, [OTHER_MANUAL, DEMO.storeId]), /manual not in store/);
  await assert.rejects(as(pool, admin, `insert into public.quiz_questions (manual_id, store_id, question, choices, correct_index) values ($1,$2,'q','["a","b"]',0)`, [OTHER_MANUAL, DEMO.storeId]), /manual not in store/);
});

test('スタッフは「わからない」と閲覧ログを登録でき、仮名・店舗はサーバー側で補完される', async () => {
  const alias = (await as(pool, staff, `select id from public.staff_aliases where name='スタッフB'`)).rows[0].id;
  await as(pool, staff, 'select public.select_alias($1)', [alias]);
  // スタッフは confusions を参照できないため RETURNING なしで登録する
  const c = await as(pool, staff, `insert into public.confusions (store_id, manual_id, step_no, step_text, alias_name) values ($1,$2,2,'テスト','なりすまし')`, [DEMO.storeId, DEMO.manualId]);
  assert.equal(c.rowCount, 1);
  const row = (await as(pool, admin, `select alias_name, manual_title from public.confusions where step_text='テスト'`)).rows[0];
  assert.equal(row.alias_name, 'スタッフB');
  assert.equal(row.manual_title, '開店準備（サンプル）');
  await as(pool, staff, `insert into public.usage_events (store_id, event_type, manual_id, user_id) values ($1,'view_start',$2,auth.uid())`, [DEMO.storeId, DEMO.manualId]);
  // 管理者専用の種別は登録できない
  await assert.rejects(as(pool, staff, `insert into public.usage_events (store_id, event_type, user_id) values ($1,'quiz_result',auth.uid())`, [DEMO.storeId]), /row-level security/);
  const ev = await as(pool, admin, `select event_type from public.usage_events order by id`);
  assert.deepEqual(ev.rows.map((r) => r.event_type), ['confusion', 'view_start']);
});

test('管理者は自店舗のマニュアルを編集・公開でき、2回目の公開で再確認依頼が出る', async () => {
  const m = await as(pool, admin, `insert into public.manuals (store_id, template_key, title) values ($1,'close','閉店') returning id`, [DEMO.storeId]);
  const id = m.rows[0].id;
  await as(pool, admin, `insert into public.manual_steps (manual_id, store_id, position, body) values ($1,$2,1,'レジを締める')`, [id, DEMO.storeId]);
  const p1 = (await as(pool, admin, 'select public.publish_manual($1) j', [id])).rows[0].j;
  assert.equal(p1.ok, true); assert.equal(p1.version, 1);
  assert.ok(p1.creation_seconds >= 0);
  await as(pool, admin, `update public.manual_steps set body='レジを締めて金額を記録する' where manual_id=$1`, [id]);
  const p2 = (await as(pool, admin, `select public.publish_manual($1, '金額記録を追加') j`, [id])).rows[0].j;
  assert.equal(p2.version, 2);
  const rr = await as(pool, staff, 'select version from public.reconfirm_requests where manual_id=$1', [id]);
  assert.deepEqual(rr.rows.map((r) => r.version), [2]);
  const rev = await as(pool, staff, 'select version from public.manual_revisions where manual_id=$1 order by version', [id]);
  assert.deepEqual(rev.rows.map((r) => r.version), [1, 2]);
});
