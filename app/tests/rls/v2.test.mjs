// RLS テスト（v2 追加機能）: 機能フラグ・他店舗の読み取り不可・スタッフ権限・パートナー集計の最小単位
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setup, newUser, as, join, DEMO } from '../local/db.mjs';

let pool, admin, staff, staff2, otherAdmin, otherStaff, outsider, partnerUser;
const OTHER = '00000000-0000-4000-8000-0000000000ee';
const PARTNER = { code: 'demo-partner', pin: '864209' };
const NEW_TABLES = ['store_features', 'input_logs', 'store_invites', 'partners', 'partner_secrets', 'partner_stores',
  'partner_members', 'menu_items', 'staff_profile_items'];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const aliasIds = async (store) => (await pool.query('select id, name from public.staff_aliases where store_id=$1 order by name', [store])).rows;

before(async () => {
  pool = await setup();
  // 他店舗（フラグ OFF のまま＝本番の試験導入店舗と同じ状態）
  await pool.query(`insert into public.stores (id, code, name) values ($1, 'other2', '他店舗2')`, [OTHER]);
  await pool.query(`insert into public.store_secrets values ($1, extensions.crypt('111222', extensions.gen_salt('bf')), extensions.crypt('333444', extensions.gen_salt('bf')))`, [OTHER]);
  await pool.query(`insert into public.staff_aliases (store_id, name) values ($1, '他店スタッフ')`, [OTHER]);
  await pool.query(`insert into public.menu_items (store_id, name_ja) values ($1, '他店の秘密メニュー')`, [OTHER]);

  admin = await newUser(pool); await join(pool, admin, DEMO.admin);
  staff = await newUser(pool); await join(pool, staff, DEMO.staff);
  staff2 = await newUser(pool); await join(pool, staff2, DEMO.staff);
  otherAdmin = await newUser(pool); await join(pool, otherAdmin, '111222', 'other2');
  otherStaff = await newUser(pool); await join(pool, otherStaff, '333444', 'other2');
  outsider = await newUser(pool);
  partnerUser = await newUser(pool);
  const al = await aliasIds(DEMO.storeId);
  await as(pool, staff, 'select public.select_alias($1)', [al[0].id]);
  await as(pool, staff2, 'select public.select_alias($1)', [al[1].id]);
  const oal = await aliasIds(OTHER);
  await as(pool, otherStaff, 'select public.select_alias($1)', [oal[0].id]);
});
after(async () => { await pool.end(); });

test('未ログイン（anon）は v2 のテーブル・RPC を使えない', async () => {
  for (const t of NEW_TABLES) await assert.rejects(as(pool, null, `select * from public.${t}`), /permission denied/, t);
  for (const sql of ['select public.partner_summary()', `select public.join_partner('demo-partner','864209','device-0001')`,
    `select public.create_store_from_invite('x','y','z','1','2')`]) {
    await assert.rejects(as(pool, null, sql), /permission denied/, sql);
  }
});

test('機能フラグ: 既定は OFF。デモ店舗だけ ON。API からは変更できない', async () => {
  const demo = await as(pool, admin, 'select feature from public.store_features where enabled order by feature');
  assert.deepEqual(demo.rows.map((r) => r.feature), ['invite', 'menu_i18n', 'promo_image', 'staff_profile', 'template_share', 'voice_input']);
  assert.equal((await as(pool, otherAdmin, 'select * from public.store_features')).rowCount, 0, '他店舗は行なし＝OFF');
  assert.equal((await as(pool, otherAdmin, 'select * from public.store_features where store_id=$1', [DEMO.storeId])).rowCount, 0, '他店舗のフラグは見えない');
  await assert.rejects(as(pool, otherAdmin, `insert into public.store_features (store_id, feature, enabled) values ($1,'menu_i18n',true)`, [OTHER]), /permission denied/);
  await assert.rejects(as(pool, admin, `update public.store_features set enabled=false`), /permission denied/);
});

test('A: 入力方法ログは管理者のみ記録・閲覧。フラグ OFF の店舗では記録できない', async () => {
  await as(pool, admin, `insert into public.input_logs (store_id, manual_id, step_no, method, chars) values ($1,$2,1,'voice',12)`, [DEMO.storeId, DEMO.manualId]);
  assert.equal((await as(pool, admin, 'select * from public.input_logs')).rowCount, 1);
  await assert.rejects(as(pool, staff, `insert into public.input_logs (store_id, method) values ($1,'voice')`, [DEMO.storeId]), /row-level security/);
  assert.equal((await as(pool, staff, 'select * from public.input_logs')).rowCount, 0);
  await assert.rejects(as(pool, otherAdmin, `insert into public.input_logs (store_id, method) values ($1,'typed')`, [OTHER]), /row-level security/, 'フラグOFF');
  await assert.rejects(as(pool, otherAdmin, `insert into public.input_logs (store_id, method) values ($1,'typed')`, [DEMO.storeId]), /row-level security/, '他店舗');
  assert.equal((await as(pool, otherAdmin, 'select * from public.input_logs')).rowCount, 0);
  await assert.rejects(as(pool, admin, `insert into public.input_logs (store_id, method) values ($1,'ai')`, [DEMO.storeId]), /check constraint/);
  await assert.rejects(as(pool, admin, `update public.input_logs set method='typed'`), /permission denied/, '改ざん不可');
  await assert.rejects(as(pool, admin, `insert into public.input_logs (store_id, method, created_at) values ($1,'typed', now() - interval '30 days')`, [DEMO.storeId]), /row-level security/, '日時の偽装不可');
  const om = (await pool.query(`insert into public.manuals (store_id, title) values ('00000000-0000-4000-8000-0000000000ee', '他店') returning id`)).rows[0].id;
  await assert.rejects(as(pool, admin, `insert into public.input_logs (store_id, manual_id, method) values ($1,$2,'typed')`, [DEMO.storeId, om]), /row-level security/, '他店舗のマニュアルを指定できない');
});

test('C: 招待はデモ店舗の管理者だけが作れ、1回だけ使える。新店舗の作成者は管理者になる', async () => {
  const token = crypto.randomBytes(32).toString('base64url');
  await assert.rejects(as(pool, staff, `insert into public.store_invites (store_id, token_hash) values ($1,$2)`, [DEMO.storeId, sha(token)]), /row-level security/);
  await assert.rejects(as(pool, otherAdmin, `insert into public.store_invites (store_id, token_hash) values ($1,$2)`, [OTHER, sha('x'.repeat(40))]), /row-level security/, 'フラグOFF');
  await assert.rejects(as(pool, admin, `insert into public.store_invites (store_id, token_hash, expires_at) values ($1,$2, now() + interval '60 days')`, [DEMO.storeId, sha('y'.repeat(40))]), /check constraint/);
  await as(pool, admin, `insert into public.store_invites (store_id, token_hash, note) values ($1,$2,'テスト')`, [DEMO.storeId, sha(token)]);
  assert.equal((await as(pool, otherAdmin, 'select * from public.store_invites')).rowCount, 0);
  assert.equal((await as(pool, staff, 'select * from public.store_invites')).rowCount, 0);

  const u = await newUser(pool);
  const bad = await as(pool, u, `select public.create_store_from_invite($1,'new-shop','新しい店','123456','654321') j`, ['z'.repeat(43)]);
  assert.equal(bad.rows[0].j.reason, 'invalid_token');
  const samePin = await as(pool, u, `select public.create_store_from_invite($1,'new-shop','新しい店','482039','482039') j`, [token]);
  assert.equal(samePin.rows[0].j.reason, 'same_pin');
  const taken = await as(pool, u, `select public.create_store_from_invite($1,'demo','新しい店','482039','739104') j`, [token]);
  assert.equal(taken.rows[0].j.reason, 'code_taken');
  const ok = await as(pool, u, `select public.create_store_from_invite($1,'new-shop','新しい店','482039','739104') j`, [token]);
  assert.equal(ok.rows[0].j.ok, true);
  const m = await as(pool, u, 'select role, store_id from public.store_members');
  assert.equal(m.rows[0].role, 'admin');
  // 新店舗では招待元のフラグを引き継ぐ（partner_share は除く）。デモ店舗のデータは見えない
  const f = await as(pool, u, 'select feature from public.store_features where enabled');
  assert.ok(f.rows.some((r) => r.feature === 'menu_i18n'));
  assert.ok(!f.rows.some((r) => r.feature === 'partner_share'));
  assert.equal((await as(pool, u, 'select * from public.manuals')).rowCount, 0);
  assert.equal((await as(pool, u, 'select * from public.menu_items')).rowCount, 0);
  // 新しい PIN で入れる
  const u2 = await newUser(pool);
  assert.equal((await join(pool, u2, '739104', 'new-shop')).role, 'staff');
  // 2回目は使えない
  const again = await as(pool, await newUser(pool), `select public.create_store_from_invite($1,'new-shop2','2号店','482039','739104') j`, [token]);
  assert.equal(again.rows[0].j.reason, 'invalid_token');
  // PINは平文で保存されない
  const sec = await pool.query(`select admin_pin_hash from public.store_secrets s join public.stores t on t.id=s.store_id where t.code='new-shop'`);
  assert.ok(!sec.rows[0].admin_pin_hash.includes('482039'));
});

test('C: 期限切れ・取り消した招待は使えない', async () => {
  const token = crypto.randomBytes(32).toString('base64url');
  await as(pool, admin, `insert into public.store_invites (store_id, token_hash) values ($1,$2)`, [DEMO.storeId, sha(token)]);
  await as(pool, admin, `update public.store_invites set expires_at = now() where token_hash=$1`, [sha(token)]);
  const r = await as(pool, await newUser(pool), `select public.create_store_from_invite($1,'late-shop','遅い店','482039','739104') j`, [token]);
  assert.equal(r.rows[0].j.reason, 'invalid_token');
  // 期限の延長・作成日時の偽装はできない（取り消しのみ）
  const t2 = crypto.randomBytes(32).toString('base64url');
  await assert.rejects(as(pool, admin, `insert into public.store_invites (store_id, token_hash, created_at, expires_at) values ($1,$2, now() + interval '300 days', now() + interval '301 days')`, [DEMO.storeId, sha(t2)]), /row-level security/);
  await as(pool, admin, `insert into public.store_invites (store_id, token_hash) values ($1,$2)`, [DEMO.storeId, sha(t2)]);
  await assert.rejects(as(pool, admin, `update public.store_invites set expires_at = now() + interval '3 days' where token_hash=$1`, [sha(t2)]), /row-level security/);
  await assert.rejects(as(pool, admin, `update public.store_invites set created_at = now() + interval '30 days' where token_hash=$1`, [sha(t2)]), /permission denied/);
  // 使用済みの招待は管理者でも書き換えられない
  await assert.rejects(as(pool, admin, `update public.store_invites set used_at=null where used_at is not null`), /permission denied/);
  assert.equal((await as(pool, admin, `update public.store_invites set expires_at=now() where used_at is not null returning id`)).rowCount, 0);
});

test('E: メニューは自店舗のメンバーだけが読め、編集は管理者のみ。フラグ OFF の店舗では使えない', async () => {
  const s = await as(pool, staff, 'select name_ja from public.menu_items order by sort');
  assert.equal(s.rowCount, 3);
  assert.ok(s.rows.every((r) => !r.name_ja.includes('他店')));
  await assert.rejects(as(pool, staff, `insert into public.menu_items (store_id, name_ja) values ($1,'x')`, [DEMO.storeId]), /row-level security/);
  assert.equal((await as(pool, staff, `update public.menu_items set price=1 returning id`)).rowCount, 0);
  assert.equal((await as(pool, staff, `delete from public.menu_items returning id`)).rowCount, 0);
  assert.equal((await as(pool, otherAdmin, 'select * from public.menu_items')).rowCount, 0, 'フラグOFFの店舗は自店舗のメニューも見えない');
  await assert.rejects(as(pool, otherAdmin, `insert into public.menu_items (store_id, name_ja) values ($1,'x')`, [OTHER]), /row-level security/);
  await assert.rejects(as(pool, admin, `insert into public.menu_items (store_id, name_ja) values ($1,'x')`, [OTHER]), /row-level security/);
  await assert.rejects(as(pool, admin, `insert into public.menu_items (store_id, name_ja, allergens) values ($1,'x', array['msg'])`, [DEMO.storeId]), /check constraint/, '28品目以外は入れられない');
  const id = (await as(pool, admin, `insert into public.menu_items (store_id, name_ja, allergens, allergens_confirmed_at, translations) values ($1,'焼きそば', array['wheat'], now(), '{"en":{"name":"Yakisoba","confirmed":true}}') returning id`, [DEMO.storeId])).rows[0].id;
  // 日本語を変えたら翻訳の確定が外れ、アレルゲンを変えたら確認日時が消える
  await as(pool, admin, `update public.menu_items set name_ja='ソース焼きそば', allergens=array['wheat','pork'] where id=$1`, [id]);
  const r = await pool.query('select translations, allergens_confirmed_at from public.menu_items where id=$1', [id]);
  assert.equal(r.rows[0].translations.en.confirmed, false);
  assert.equal(r.rows[0].allergens_confirmed_at, null);
});

test('F: プロフィールは本人だけが編集。管理者は公開に同意した項目だけ見える。他店舗・他のスタッフは見えない', async () => {
  const al = await aliasIds(DEMO.storeId);
  await as(pool, staff, `insert into public.staff_profile_items (store_id, alias_id, category, value, shared) values ($1,$2,'skill','レジ',true), ($1,$2,'wish','シフトを減らしたい',false)`, [DEMO.storeId, al[0].id]);
  await assert.rejects(as(pool, staff, `insert into public.staff_profile_items (store_id, alias_id, category, value) values ($1,$2,'skill','レジ')`, [DEMO.storeId, al[1].id]), /row-level security/, '他人の仮名では作れない');
  await assert.rejects(as(pool, staff, `insert into public.staff_profile_items (store_id, alias_id, category, value) values ($1,$2,'skill','口癖が多い')`, [DEMO.storeId, al[0].id]), /check constraint/, '選択肢以外は不可');
  await assert.rejects(as(pool, admin, `insert into public.staff_profile_items (store_id, alias_id, category, value) values ($1,$2,'skill','調理')`, [DEMO.storeId, al[0].id]), /row-level security/, '管理者は代わりに入力できない');
  const ad = await as(pool, admin, 'select category, value from public.staff_profile_items');
  assert.deepEqual(ad.rows, [{ category: 'skill', value: 'レジ' }], '非公開の希望は管理者に見えない');
  assert.equal((await as(pool, admin, `update public.staff_profile_items set shared=true returning id`)).rowCount, 0, '管理者は公開設定を変えられない');
  assert.equal((await as(pool, staff2, 'select * from public.staff_profile_items')).rowCount, 0, '他のスタッフには見えない');
  assert.equal((await as(pool, otherAdmin, 'select * from public.staff_profile_items')).rowCount, 0, '他店舗には見えない');
  await assert.rejects(as(pool, otherStaff, `insert into public.staff_profile_items (store_id, alias_id, category, value) values ($1,$2,'skill','レジ')`, [OTHER, (await aliasIds(OTHER))[0].id]), /row-level security/, 'フラグOFF');
  // 本人は非公開にでき、管理者から見えなくなる
  await as(pool, staff, `update public.staff_profile_items set shared=false where value='レジ'`);
  assert.equal((await as(pool, admin, 'select * from public.staff_profile_items')).rowCount, 0);
  assert.equal((await as(pool, staff, 'delete from public.staff_profile_items returning id')).rowCount, 2);
});

test('D: パートナーは集計だけを見られる。店舗ごとのデータ・3店舗未満の区分は返さない', async () => {
  await assert.rejects(as(pool, partnerUser, 'select public.partner_summary()'), /partner only/, 'ログイン前');
  await assert.rejects(as(pool, admin, 'select public.partner_summary()'), /partner only/, '店舗の管理者は見られない');
  const bad = await as(pool, partnerUser, `select public.join_partner($1,'000000','device-p-001') j`, [PARTNER.code]);
  assert.equal(bad.rows[0].j.ok, false);
  const ok = await as(pool, partnerUser, `select public.join_partner($1,$2,'device-p-001') j`, [PARTNER.code, PARTNER.pin]);
  assert.equal(ok.rows[0].j.ok, true);
  assert.equal(ok.rows[0].j.is_demo, true);
  const s = (await as(pool, partnerUser, 'select public.partner_summary() s')).rows[0].s;
  assert.equal(s.total.stores, 7, '集計に同意した7店舗（同意していない1店舗は除外）');
  assert.equal(s.min_group, 3);
  assert.deepEqual(s.groups.map((g) => [g.category, g.stores]), [['カフェ', 3], ['居酒屋', 3]]);
  assert.equal(s.hidden_groups, 1, '1店舗だけの「定食屋」は表示しない');
  assert.ok(s.groups.every((g) => g.stores >= 3));
  assert.ok(!JSON.stringify(s).includes('fake-store'), '店舗コードを含まない');
  assert.ok(!JSON.stringify(s).includes('架空の居酒屋'), '店舗名を含まない');
  assert.equal(s.total.retention_pct, 71, '直近30日に利用のある5/7店舗');
  // テーブルを直接読んでも店舗ごとの値は取れない
  for (const t of ['stores', 'manuals', 'confusions', 'usage_events', 'store_members']) {
    assert.equal((await as(pool, partnerUser, `select * from public.${t}`)).rowCount, 0, t);
  }
  await assert.rejects(as(pool, partnerUser, 'select * from public.partner_stores'), /permission denied/);
  await assert.rejects(as(pool, partnerUser, 'select * from public.partner_secrets'), /permission denied/);
  assert.equal((await as(pool, partnerUser, 'select name from public.partners')).rows[0].name, 'デモ卸（架空）');
  // 退出
  await as(pool, partnerUser, 'delete from public.partner_members where user_id = auth.uid()');
  await assert.rejects(as(pool, partnerUser, 'select public.partner_summary()'), /partner only/);
});

test('D: 3店舗未満のパートナーには合計も返さない', async () => {
  const pid = crypto.randomUUID();
  await pool.query(`insert into public.partners (id, code, name) values ($1,'tiny-partner','小さな卸（架空）')`, [pid]);
  await pool.query(`insert into public.partner_secrets values ($1, extensions.crypt('592817', extensions.gen_salt('bf')))`, [pid]);
  await pool.query(`insert into public.partner_stores (partner_id, store_id, category) select $1, store_id, '居酒屋' from public.partner_stores where category='居酒屋' limit 2`, [pid]);
  const u = await newUser(pool);
  await as(pool, u, `select public.join_partner('tiny-partner','592817','device-p-002')`);
  const s = (await as(pool, u, 'select public.partner_summary() s')).rows[0].s;
  assert.equal(s.total.stores_lt_min, true);
  assert.equal(s.total.stores, undefined);
  assert.deepEqual(s.groups, []);
});

test('D: パートナーPINも5回失敗で端末ロック', async () => {
  const u = await newUser(pool);
  let last;
  for (let i = 0; i < 5; i++) last = (await as(pool, u, `select public.join_partner('demo-partner','000000','device-p-lock') j`)).rows[0].j;
  assert.equal(last.reason, 'locked');
  const r = (await as(pool, u, `select public.join_partner('demo-partner',$1,'device-p-lock') j`, [PARTNER.pin])).rows[0].j;
  assert.equal(r.reason, 'locked');
});

test('既存機能: v2 のデータが既存テーブルの見え方を変えていない', async () => {
  assert.deepEqual((await as(pool, admin, 'select code from public.stores')).rows, [{ code: 'demo' }]);
  assert.deepEqual((await as(pool, outsider, 'select * from public.stores')).rowCount, 0);
  assert.equal((await as(pool, outsider, 'select * from public.templates')).rowCount, 6);
});
