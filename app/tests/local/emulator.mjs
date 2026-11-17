// ローカル検証用: Supabase の Auth（匿名サインイン）/ REST（PostgREST の一部）/ Storage を
// 実 PostgreSQL の上で最小限に再現する。全クエリは anon / authenticated ロールと
// request.jwt.claims を設定したうえで実行するため、本番と同じ RLS が適用される。
// ※ E2E テスト専用。本番では使用しない。
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const SECRET = 'local-emulator-secret-not-for-production';
const b64u = (b) => Buffer.from(b).toString('base64url');

export function signJwt(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!s) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (exp.length !== s.length || !crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

export const ANON_KEY = signJwt({ role: 'anon', iss: 'shopnavi-emulator', iat: 1700000000, exp: 2000000000 });

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw httpErr(400, 'PGRST100', `invalid identifier ${s}`);
  return `"${s}"`;
};
function httpErr(status, code, message) {
  const e = new Error(message);
  e.status = status; e.code = code;
  return e;
}

export async function startEmulator({ port = 54321, dbUrl, storageDir } = {}) {
  const pool = new pg.Pool({ connectionString: dbUrl, max: 8 });
  const files = storageDir || fs.mkdtempSync(path.join(os.tmpdir(), 'shopnavi-storage-'));
  const refresh = new Map();
  const base = `http://127.0.0.1:${port}`;

  function session(userId) {
    const now = Math.floor(Date.now() / 1000);
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', is_anonymous: true,
      app_metadata: { provider: 'anonymous' }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
    const access = signJwt({ sub: userId, role: 'authenticated', aud: 'authenticated', is_anonymous: true, iat: now, exp: now + 3600 });
    const rt = crypto.randomBytes(16).toString('hex');
    refresh.set(rt, userId);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user };
  }

  function claimsOf(req) {
    const auth = req.headers.authorization || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers.apikey;
    const c = verifyJwt(tok);
    if (!c) throw httpErr(401, 'PGRST301', 'JWT invalid');
    return c;
  }

  async function withRole(claims, fn) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      const role = claims.role === 'authenticated' ? 'authenticated' : 'anon';
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const r = await fn(c);
      await c.query('commit');
      return r;
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  // ---- PostgREST サブセット ----
  function parseFilters(params, args) {
    const where = [];
    for (const [k, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const col = ident(k);
      let v = raw; let not = false;
      if (v.startsWith('not.')) { not = true; v = v.slice(4); }
      const dot = v.indexOf('.');
      const op = v.slice(0, dot); const val = v.slice(dot + 1);
      let clause;
      const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
      if (ops[op]) {
        args.push(op.endsWith('like') ? val.replace(/\*/g, '%') : val);
        clause = `${col}::text ${ops[op]} $${args.length}`;
        if (['gt', 'gte', 'lt', 'lte'].includes(op)) clause = `${col} ${ops[op]} $${args.length}`;
        if (op === 'eq' || op === 'neq') clause = `${col} ${ops[op]} $${args.length}`;
      } else if (op === 'is') {
        const m = { null: 'null', true: 'true', false: 'false' }[val];
        if (!m) throw httpErr(400, 'PGRST100', 'bad is');
        clause = `${col} is ${m}`;
      } else if (op === 'in') {
        const items = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
        args.push(items);
        clause = `${col}::text = any($${args.length}::text[])`;
      } else throw httpErr(400, 'PGRST100', `unsupported op ${op}`);
      where.push(not ? `not (${clause})` : clause);
    }
    return where.length ? ` where ${where.join(' and ')}` : '';
  }
  function parseSelect(sel) {
    if (!sel || sel === '*') return '*';
    return sel.split(',').map((s) => ident(s.trim())).join(',');
  }
  function parseOrder(order) {
    if (!order) return '';
    return ' order by ' + order.split(',').map((o) => {
      const [c, dir, nulls] = o.split('.');
      return `${ident(c)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
    }).join(',');
  }

  async function rest(req, res, url, body) {
    const claims = claimsOf(req);
    const parts = url.pathname.replace(/^\/rest\/v1\/?/, '').split('/');
    const params = url.searchParams;
    const prefer = req.headers.prefer || '';
    const single = (req.headers.accept || '').includes('vnd.pgrst.object');
    const wantRep = prefer.includes('return=representation');

    let rows;
    if (parts[0] === 'rpc') {
      const fn = ident(parts[1]);
      const meta = await pool.query(
        `select p.proargnames, oidvectortypes(p.proargtypes) as types, p.proretset, format_type(p.prorettype, null) as rettype
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`, [parts[1]]);
      if (!meta.rowCount) throw httpErr(404, 'PGRST202', 'function not found');
      const m = meta.rows[0];
      const names = m.proargnames || []; const types = m.types ? m.types.split(', ') : [];
      const args = []; const sqlArgs = [];
      const input = body ? JSON.parse(body) : {};
      names.forEach((n, i) => {
        if (!(n in input)) return;
        const v = input[n];
        args.push(v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
        sqlArgs.push(`${ident(n)} => $${args.length}::${types[i]}`);
      });
      const call = `public.${fn}(${sqlArgs.join(', ')})`;
      const sql = m.proretset ? `select to_jsonb(r) as j from ${call} r` : `select to_jsonb(${call}) as j`;
      const r = await withRole(claims, (c) => c.query(sql, args));
      const out = m.proretset ? r.rows.map((x) => x.j) : r.rows[0]?.j ?? null;
      return send(res, 200, out);
    }

    const table = `public.${ident(parts[0])}`;
    const args = [];
    if (req.method === 'GET' || req.method === 'HEAD') {
      const lim = params.get('limit') ? ` limit ${Number(params.get('limit')) | 0}` : '';
      const off = params.get('offset') ? ` offset ${Number(params.get('offset')) | 0}` : '';
      const sql = `select to_jsonb(q) as j from (select ${parseSelect(params.get('select'))} from ${table}${parseFilters(params, args)}${parseOrder(params.get('order'))}${lim}${off}) q`;
      rows = (await withRole(claims, (c) => c.query(sql, args))).rows.map((r) => r.j);
    } else if (req.method === 'POST') {
      const data = JSON.parse(body || '{}');
      const list = Array.isArray(data) ? data : [data];
      const cols = [...new Set(list.flatMap((o) => Object.keys(o)))];
      args.push(JSON.stringify(list));
      const colSql = cols.map(ident).join(',');
      let conflict = '';
      if (prefer.includes('resolution=merge-duplicates')) {
        const oc = (params.get('on_conflict') || 'id').split(',').map(ident).join(',');
        conflict = ` on conflict (${oc}) do update set ${cols.map((c) => `${ident(c)}=excluded.${ident(c)}`).join(',')}`;
      } else if (prefer.includes('resolution=ignore-duplicates')) conflict = ' on conflict do nothing';
      const ins = `insert into ${table} (${colSql}) select ${colSql} from jsonb_populate_recordset(null::${table}, $1::jsonb)${conflict}`;
      const sql = wantRep ? `with w as (${ins} returning *) select ${params.get('select') ? `to_jsonb(x) as j from (select ${parseSelect(params.get('select'))} from w) x` : 'to_jsonb(w) as j from w'}` : ins;
      rows = (await withRole(claims, (c) => c.query(sql, args))).rows.map((r) => r.j);
      if (!wantRep) return send(res, 201, null);
    } else if (req.method === 'PATCH') {
      const data = JSON.parse(body || '{}');
      const cols = Object.keys(data);
      args.push(JSON.stringify(data));
      const setSql = cols.map((c) => `${ident(c)} = (jsonb_populate_record(null::${table}, $1::jsonb)).${ident(c)}`).join(', ');
      const upd = `update ${table} set ${setSql}${parseFilters(params, args)}`;
      const sql = wantRep ? `with w as (${upd} returning *) select to_jsonb(x) as j from (select ${parseSelect(params.get('select'))} from w) x` : upd;
      rows = (await withRole(claims, (c) => c.query(sql, args))).rows.map((r) => r.j);
      if (!wantRep) return send(res, 204, null);
    } else if (req.method === 'DELETE') {
      const del = `delete from ${table}${parseFilters(params, args)}`;
      const sql = wantRep ? `with w as (${del} returning *) select to_jsonb(w) as j from w` : del;
      rows = (await withRole(claims, (c) => c.query(sql, args))).rows.map((r) => r.j);
      if (!wantRep) return send(res, 204, null);
    } else throw httpErr(405, 'PGRST000', 'method');

    if (single) {
      if (rows.length !== 1) throw httpErr(406, 'PGRST116', `JSON object requested, multiple (or no) rows returned (${rows.length})`);
      return send(res, 200, rows[0]);
    }
    return send(res, req.method === 'POST' ? 201 : 200, rows);
  }

  // ---- Auth ----
  async function auth(req, res, url, body) {
    const p = url.pathname.replace(/^\/auth\/v1/, '');
    if (p === '/signup' && req.method === 'POST') {
      const data = JSON.parse(body || '{}');
      if (data.email || data.phone) throw httpErr(422, 'signup_disabled', 'only anonymous sign-in');
      const id = crypto.randomUUID();
      await pool.query('insert into auth.users (id) values ($1)', [id]);
      return send(res, 200, session(id));
    }
    if (p === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const { refresh_token } = JSON.parse(body || '{}');
      const uid = refresh.get(refresh_token);
      if (!uid) throw httpErr(400, 'invalid_grant', 'Invalid Refresh Token');
      refresh.delete(refresh_token);
      return send(res, 200, session(uid));
    }
    if (p === '/user' && req.method === 'GET') {
      const c = claimsOf(req);
      if (c.role !== 'authenticated') throw httpErr(401, 'no_session', 'no user');
      return send(res, 200, session(c.sub).user);
    }
    if (p === '/logout') return send(res, 204, null);
    if (p === '/settings') return send(res, 200, { external: { anonymous_users: true } });
    throw httpErr(404, 'not_found', p);
  }

  // ---- Storage ----
  const tokenFor = (bucket, name, exp) => crypto.createHmac('sha256', SECRET).update(`${bucket}/${name}/${exp}`).digest('base64url');
  async function readForm(req, buf) {
    const r = new Response(buf, { headers: { 'content-type': req.headers['content-type'] } });
    const fd = await r.formData();
    for (const [, v] of fd.entries()) if (typeof v !== 'string') return v;
    throw httpErr(400, 'InvalidRequest', 'no file');
  }
  async function storage(req, res, url, buf) {
    const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''));
    let m;
    if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      const [, bucket, name] = m;
      const tok = url.searchParams.get('token') || '';
      const [exp, sig] = tok.split('.');
      if (!sig || Number(exp) < Date.now() / 1000 || sig !== tokenFor(bucket, name, exp)) throw httpErr(400, 'InvalidSignature', 'invalid signature');
      const fp = path.join(files, bucket, name);
      if (!fs.existsSync(fp)) throw httpErr(404, 'not_found', 'Object not found');
      res.writeHead(200, { 'content-type': fs.readFileSync(fp + '.type', 'utf8'), 'access-control-allow-origin': '*' });
      return res.end(fs.readFileSync(fp));
    }
    const claims = claimsOf(req);
    if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
      const [, bucket, name] = m;
      const { expiresIn = 60 } = JSON.parse(buf.toString() || '{}');
      const ok = await withRole(claims, (c) => c.query('select 1 from storage.objects where bucket_id=$1 and name=$2', [bucket, name]));
      if (!ok.rowCount) throw httpErr(400, 'not_found', 'Object not found');
      const exp = Math.floor(Date.now() / 1000) + Number(expiresIn);
      return send(res, 200, { signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${exp}.${tokenFor(bucket, name, exp)}` });
    }
    if ((m = p.match(/^\/object\/sign\/([^/]+)$/)) && req.method === 'POST') {
      const [, bucket] = m;
      const { expiresIn = 60, paths = [] } = JSON.parse(buf.toString() || '{}');
      const ok = await withRole(claims, (c) => c.query('select name from storage.objects where bucket_id=$1 and name = any($2)', [bucket, paths]));
      const allowed = new Set(ok.rows.map((r) => r.name));
      const exp = Math.floor(Date.now() / 1000) + Number(expiresIn);
      return send(res, 200, paths.map((n) => allowed.has(n)
        ? { path: n, error: null, signedURL: `/object/sign/${bucket}/${encodeURI(n)}?token=${exp}.${tokenFor(bucket, n, exp)}` }
        : { path: n, error: 'Either the object does not exist or you do not have access to it', signedURL: null }));
    }
    if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && (req.method === 'POST' || req.method === 'PUT')) {
      const [, bucket, name] = m;
      const file = (req.headers['content-type'] || '').startsWith('multipart/form-data') ? await readForm(req, buf) : new Blob([buf], { type: req.headers['content-type'] });
      const b = (await pool.query('select * from storage.buckets where id=$1', [bucket])).rows[0];
      if (!b) throw httpErr(404, 'not_found', 'Bucket not found');
      if (b.file_size_limit && file.size > Number(b.file_size_limit)) throw httpErr(413, 'EntityTooLarge', 'The object exceeded the maximum allowed size');
      if (b.allowed_mime_types && !b.allowed_mime_types.includes(file.type)) throw httpErr(415, 'InvalidMimeType', `mime type ${file.type} is not supported`);
      const upsert = req.headers['x-upsert'] === 'true';
      await withRole(claims, (c) => c.query(
        `insert into storage.objects (bucket_id, name, owner, metadata) values ($1,$2,auth.uid(),$3)${upsert ? ' on conflict (bucket_id,name) do update set updated_at=now()' : ''}`,
        [bucket, name, JSON.stringify({ mimetype: file.type, size: file.size })]));
      const fp = path.join(files, bucket, name);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, Buffer.from(await file.arrayBuffer()));
      fs.writeFileSync(fp + '.type', file.type);
      return send(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
    }
    if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
      const [, bucket] = m;
      const { prefixes = [] } = JSON.parse(buf.toString() || '{}');
      const r = await withRole(claims, (c) => c.query('delete from storage.objects where bucket_id=$1 and name = any($2) returning name', [bucket, prefixes]));
      for (const row of r.rows) fs.rmSync(path.join(files, bucket, row.name), { force: true });
      return send(res, 200, r.rows.map((x) => ({ name: x.name })));
    }
    throw httpErr(404, 'not_found', p);
  }

  function send(res, status, data) {
    const h = { 'access-control-allow-origin': '*' };
    if (status === 204 || data === null && status === 201) { res.writeHead(status === 201 ? 201 : 204, h); return res.end(); }
    res.writeHead(status, { ...h, 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
        'access-control-max-age': '600',
      });
      return res.end();
    }
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const buf = Buffer.concat(chunks);
    const url = new URL(req.url, base);
    try {
      if (url.pathname.startsWith('/rest/v1')) return await rest(req, res, url, buf.toString());
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url, buf.toString());
      if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url, buf);
      throw httpErr(404, 'not_found', url.pathname);
    } catch (e) {
      const pgCode = e.code;
      let status = e.status || 400;
      if (!e.status && pgCode === '42501') status = 403;
      if (!e.status && pgCode === '23505') status = 409;
      if (url.pathname.startsWith('/storage/v1')) {
        return send(res, status, { statusCode: String(status), error: e.code || 'error', message: e.message });
      }
      if (url.pathname.startsWith('/auth/v1')) {
        return send(res, status, { code: status, error_code: e.code, msg: e.message });
      }
      return send(res, status, { code: pgCode || 'PGRST000', message: e.message, details: e.detail || null, hint: e.hint || null });
    }
  });
  // Realtime の WebSocket は未対応（アプリ側はポーリングで補完する）
  server.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { url: base, anonKey: ANON_KEY, storageDir: files, close: async () => { server.close(); await pool.end(); } };
}
