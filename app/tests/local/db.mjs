// テスト用 DB ヘルパー: 指定ユーザー（JWT クレーム）・ロールでクエリを実行する
import pg from 'pg';
import crypto from 'node:crypto';
import { startDb, DB_URL } from './pg.mjs';

export async function setup({ reset = true } = {}) {
  startDb({ reset });
  const pool = new pg.Pool({ connectionString: DB_URL, max: 4 });
  return pool;
}

export async function newUser(pool) {
  const id = crypto.randomUUID();
  await pool.query('insert into auth.users (id) values ($1)', [id]);
  return id;
}

// uid=null のときは未ログイン（anon）
export async function as(pool, uid, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const role = uid ? 'authenticated' : 'anon';
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify(uid ? { sub: uid, role } : { role })]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const DEMO = { code: 'demo', admin: '135790', staff: '246802', storeId: '00000000-0000-4000-8000-000000000001', manualId: '00000000-0000-4000-8000-000000000101' };

export async function join(pool, uid, pin, code = DEMO.code, device = crypto.randomUUID()) {
  const r = await as(pool, uid, 'select public.join_store($1,$2,$3) as j', [code, pin, device]);
  return r.rows[0].j;
}
