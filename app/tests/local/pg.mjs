// ローカル検証用 PostgreSQL の起動・初期化（Supabase のスタブ + マイグレーション + シード）
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
export const PG_PORT = Number(process.env.SN_PG_PORT || 54329);
const DATA = process.env.SN_PG_DATA || path.join(os.tmpdir(), 'shopnavi-pg');

function findBin(name) {
  for (const v of ['17', '16', '15']) {
    const p = `/usr/lib/postgresql/${v}/bin/${name}`;
    if (fs.existsSync(p)) return p;
  }
  return name;
}

function asPg(cmd, args) {
  const isRoot = process.getuid && process.getuid() === 0;
  const r = isRoot
    ? spawnSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { encoding: 'utf8' })
    : spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

export const PG_URL = `postgres://postgres@127.0.0.1:${PG_PORT}/postgres`;

export function psql(sql, { file, db = 'postgres', quiet = true } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'];
  if (file) args.push('-f', file); else args.push('-c', sql);
  return execFileSync('psql', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'] });
}

function running() {
  return spawnSync('pg_isready', ['-h', '127.0.0.1', '-p', String(PG_PORT)]).status === 0;
}

export function startDb({ reset = true } = {}) {
  if (!running()) {
    if (!fs.existsSync(path.join(DATA, 'PG_VERSION'))) {
      fs.mkdirSync(DATA, { recursive: true });
      if (process.getuid && process.getuid() === 0) execFileSync('chown', ['-R', 'postgres:postgres', DATA]);
      asPg(findBin('initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8']);
    }
    asPg(findBin('pg_ctl'), ['-D', DATA, '-o', `-p ${PG_PORT} -k /tmp -c listen_addresses=127.0.0.1`, '-l', path.join(DATA, 'log.txt'), '-w', 'start']);
  }
  if (reset) resetDb();
}

export function resetDb() {
  psql(`select pg_terminate_backend(pid) from pg_stat_activity where datname='shopnavi' and pid<>pg_backend_pid()`);
  psql('drop database if exists shopnavi');
  for (const r of ['anon', 'authenticated', 'service_role']) {
    psql(`do $$ begin if exists (select 1 from pg_roles where rolname='${r}') then execute 'drop owned by ${r} cascade'; execute 'drop role ${r}'; end if; end $$`);
  }
  psql('create database shopnavi');
  psql(null, { file: path.join(here, 'supabase-stub.sql'), db: 'shopnavi' });
  const migDir = path.join(appRoot, 'supabase/migrations');
  for (const f of fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    psql(null, { file: path.join(migDir, f), db: 'shopnavi' });
  }
  psql(null, { file: path.join(appRoot, 'supabase/seed.sql'), db: 'shopnavi' });
  // v2 デモ用データ（架空）。本番には適用しない
  const v2 = path.join(appRoot, 'supabase/seed_v2_demo.sql');
  if (fs.existsSync(v2)) psql(null, { file: v2, db: 'shopnavi' });
}

export function stopDb() {
  if (running()) asPg(findBin('pg_ctl'), ['-D', DATA, '-m', 'fast', 'stop']);
}

export const DB_URL = `postgres://postgres@127.0.0.1:${PG_PORT}/shopnavi`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'start';
  if (cmd === 'start') { startDb(); console.log(`ok ${DB_URL}`); }
  else if (cmd === 'stop') { stopDb(); console.log('stopped'); }
}
