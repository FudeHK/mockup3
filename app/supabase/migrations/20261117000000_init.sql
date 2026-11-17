-- ShopNavi 初期スキーマ
-- 方針:
--  * 全テーブル RLS 有効。判定は auth.uid() と store_members.role で行う
--  * 認証は Supabase の匿名サインイン + 店舗PIN（サーバー側 RPC で照合・bcrypt ハッシュ保存）
--  * スタッフ本人を特定できる情報（本名・電話番号）は保存しない。仮名（staff_aliases）のみ
--  * 秘密情報（PINハッシュ・試行履歴）は RLS で誰からも読めないテーブルに分離

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ============================================================
-- テーブル
-- ============================================================

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{3,32}$'),
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- PIN ハッシュ（bcrypt）。ポリシー無し = クライアントからは一切読めない
create table public.store_secrets (
  store_id uuid primary key references public.stores (id) on delete cascade,
  admin_pin_hash text not null,
  staff_pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- PIN 試行履歴とロック（ポリシー無し）
create table public.pin_attempts (
  id bigint generated always as identity primary key,
  store_id uuid references public.stores (id) on delete cascade,
  device_id text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index pin_attempts_device_idx on public.pin_attempts (device_id, created_at desc);
create index pin_attempts_store_idx on public.pin_attempts (store_id, created_at desc);

create table public.pin_locks (
  device_id text primary key,
  locked_until timestamptz not null
);

create table public.staff_aliases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table public.store_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  alias_id uuid references public.staff_aliases (id) on delete set null,
  created_at timestamptz not null default now()
);
create index store_members_store_idx on public.store_members (store_id);
create index store_members_alias_idx on public.store_members (alias_id);

create table public.templates (
  key text primary key,
  name text not null,
  sort int not null default 0,
  description text not null default '',
  questions jsonb not null check (jsonb_typeof(questions) = 'array')
);

create table public.manuals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  template_key text references public.templates (key),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'published')),
  version int not null default 0,
  has_unpublished_changes boolean not null default true,
  draft_started_at timestamptz not null default now(),
  first_published_at timestamptz,
  published_at timestamptz,
  creation_seconds int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index manuals_store_status_idx on public.manuals (store_id, status);
create index manuals_template_idx on public.manuals (template_key);

-- 編集中の工程（管理者のみ）
create table public.manual_steps (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  position int not null,
  question text not null default '',
  body text not null default '' check (char_length(body) <= 200),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index manual_steps_manual_idx on public.manual_steps (manual_id, position);
create index manual_steps_store_idx on public.manual_steps (store_id);

-- 公開版のスナップショット = 編集履歴
create table public.manual_revisions (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  version int not null,
  title text not null,
  steps jsonb not null,
  note text not null default '',
  published_by uuid,
  published_at timestamptz not null default now(),
  unique (manual_id, version)
);
create index manual_revisions_store_idx on public.manual_revisions (store_id);

-- 更新時の再確認依頼
create table public.reconfirm_requests (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  version int not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (manual_id, version)
);
create index reconfirm_requests_store_idx on public.reconfirm_requests (store_id);

-- スタッフ（仮名）ごとの確認済み記録
create table public.manual_acks (
  manual_id uuid not null references public.manuals (id) on delete cascade,
  alias_id uuid not null references public.staff_aliases (id) on delete cascade,
  version int not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (manual_id, alias_id, version)
);
create index manual_acks_alias_idx on public.manual_acks (alias_id);
create index manual_acks_store_idx on public.manual_acks (store_id);

-- 「わからない」
create table public.confusions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  manual_id uuid not null references public.manuals (id) on delete cascade,
  manual_title text not null default '',
  manual_version int not null default 0,
  step_id uuid,
  step_no int not null,
  step_text text not null default '',
  alias_id uuid references public.staff_aliases (id) on delete set null,
  alias_name text not null default '',
  user_id uuid default auth.uid(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index confusions_store_created_idx on public.confusions (store_id, created_at desc);
create index confusions_manual_idx on public.confusions (manual_id);
create index confusions_alias_idx on public.confusions (alias_id);

-- クイズ（正答は管理者のみ参照可。スタッフは RPC 経由で問題文と選択肢のみ取得）
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  manual_id uuid not null references public.manuals (id) on delete cascade,
  step_id uuid,
  step_no int,
  question text not null check (char_length(btrim(question)) between 1 and 120),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 4),
  correct_index int not null check (correct_index >= 0 and correct_index < 4),
  created_at timestamptz not null default now()
);
create index quiz_questions_manual_idx on public.quiz_questions (manual_id, created_at);
create index quiz_questions_store_idx on public.quiz_questions (store_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  manual_id uuid not null references public.manuals (id) on delete cascade,
  alias_id uuid references public.staff_aliases (id) on delete set null,
  user_id uuid,
  total int not null,
  correct int not null,
  rate numeric(5, 1) not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_store_created_idx on public.quiz_attempts (store_id, created_at desc);
create index quiz_attempts_manual_idx on public.quiz_attempts (manual_id);
create index quiz_attempts_alias_idx on public.quiz_attempts (alias_id);

-- 利用ログ（CSV 出力の元）
create table public.usage_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  event_type text not null check (event_type in
    ('manual_published', 'view_start', 'view_end', 'step_view', 'confusion', 'quiz_result')),
  manual_id uuid references public.manuals (id) on delete set null,
  manual_title text not null default '',
  manual_version int,
  step_id uuid,
  step_no int,
  alias_id uuid references public.staff_aliases (id) on delete set null,
  alias_name text not null default '',
  user_id uuid,
  session_id uuid,
  value numeric,
  detail text not null default '' check (char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index usage_events_store_created_idx on public.usage_events (store_id, created_at);
create index usage_events_manual_idx on public.usage_events (manual_id);
create index usage_events_alias_idx on public.usage_events (alias_id);

-- ============================================================
-- ヘルパー（private スキーマ: API には公開されない）
-- ============================================================

create or replace function private.my_store_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.store_id from public.store_members m where m.user_id = (select auth.uid())
$$;

create or replace function private.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.store_members m where m.user_id = (select auth.uid())
$$;

create or replace function private.my_alias_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.alias_id from public.store_members m where m.user_id = (select auth.uid())
$$;

create or replace function private.is_admin_of(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_members m
    where m.user_id = (select auth.uid()) and m.store_id = p_store and m.role = 'admin'
  )
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.stores enable row level security;
alter table public.store_secrets enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.pin_locks enable row level security;
alter table public.staff_aliases enable row level security;
alter table public.store_members enable row level security;
alter table public.templates enable row level security;
alter table public.manuals enable row level security;
alter table public.manual_steps enable row level security;
alter table public.manual_revisions enable row level security;
alter table public.reconfirm_requests enable row level security;
alter table public.manual_acks enable row level security;
alter table public.confusions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.usage_events enable row level security;

-- 未ログイン（anon）には何も許可しない
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.store_secrets, public.pin_attempts, public.pin_locks from authenticated;

-- stores
create policy stores_select_member on public.stores for select to authenticated
  using (id = (select private.my_store_id()));
create policy stores_update_admin on public.stores for update to authenticated
  using ((select private.is_admin_of(id))) with check ((select private.is_admin_of(id)));

-- staff_aliases
create policy aliases_select_member on public.staff_aliases for select to authenticated
  using (store_id = (select private.my_store_id()));
create policy aliases_insert_admin on public.staff_aliases for insert to authenticated
  with check ((select private.is_admin_of(store_id)));
create policy aliases_update_admin on public.staff_aliases for update to authenticated
  using ((select private.is_admin_of(store_id))) with check ((select private.is_admin_of(store_id)));

-- store_members: 自分の行と、管理者は自店舗の行を参照。変更は RPC のみ
create policy members_select on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin_of(store_id)));

-- templates: ログイン済みなら参照可
create policy templates_select on public.templates for select to authenticated using (true);

-- manuals
create policy manuals_select on public.manuals for select to authenticated
  using (
    store_id = (select private.my_store_id())
    and (status = 'published' or (select private.my_role()) = 'admin')
  );
create policy manuals_insert_admin on public.manuals for insert to authenticated
  with check ((select private.is_admin_of(store_id)));
create policy manuals_update_admin on public.manuals for update to authenticated
  using ((select private.is_admin_of(store_id))) with check ((select private.is_admin_of(store_id)));
create policy manuals_delete_admin on public.manuals for delete to authenticated
  using ((select private.is_admin_of(store_id)));

-- manual_steps: 管理者のみ
create policy steps_all_admin on public.manual_steps for all to authenticated
  using ((select private.is_admin_of(store_id))) with check ((select private.is_admin_of(store_id)));

-- manual_revisions / reconfirm_requests: 店舗メンバーが参照（作成は RPC）
create policy revisions_select_member on public.manual_revisions for select to authenticated
  using (store_id = (select private.my_store_id()));
create policy reconfirm_select_member on public.reconfirm_requests for select to authenticated
  using (store_id = (select private.my_store_id()));

-- manual_acks: 自分の仮名分を登録・参照。管理者は全件参照
create policy acks_select on public.manual_acks for select to authenticated
  using (
    store_id = (select private.my_store_id())
    and (alias_id = (select private.my_alias_id()) or (select private.my_role()) = 'admin')
  );
create policy acks_insert_self on public.manual_acks for insert to authenticated
  with check (store_id = (select private.my_store_id()) and alias_id = (select private.my_alias_id()));

-- confusions: メンバーが登録、管理者が参照・解決
create policy confusions_insert_member on public.confusions for insert to authenticated
  with check (store_id = (select private.my_store_id()) and user_id = (select auth.uid()));
create policy confusions_select_admin on public.confusions for select to authenticated
  using ((select private.is_admin_of(store_id)));
create policy confusions_update_admin on public.confusions for update to authenticated
  using ((select private.is_admin_of(store_id))) with check ((select private.is_admin_of(store_id)));

-- quiz_questions: 管理者のみ
create policy quiz_q_all_admin on public.quiz_questions for all to authenticated
  using ((select private.is_admin_of(store_id))) with check ((select private.is_admin_of(store_id)));

-- quiz_attempts: 管理者は全件、スタッフは自分の仮名分のみ参照（登録は RPC）
create policy quiz_a_select on public.quiz_attempts for select to authenticated
  using (
    (select private.is_admin_of(store_id))
    or (store_id = (select private.my_store_id()) and alias_id = (select private.my_alias_id()))
  );

-- usage_events: メンバーは閲覧ログのみ登録可。参照は管理者のみ
create policy events_insert_member on public.usage_events for insert to authenticated
  with check (
    store_id = (select private.my_store_id())
    and user_id = (select auth.uid())
    and event_type in ('view_start', 'view_end', 'step_view')
  );
create policy events_select_admin on public.usage_events for select to authenticated
  using ((select private.is_admin_of(store_id)));

-- ============================================================
-- トリガー（なりすまし防止のため、名前・仮名・店舗をサーバー側で補完）
-- ============================================================

create or replace function private.fill_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_alias uuid;
  v_alias_name text;
  v_role text;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    select m.alias_id, m.role into v_alias, v_role from public.store_members m where m.user_id = auth.uid();
    new.alias_id := v_alias;
    if v_alias is not null then
      select a.name into v_alias_name from public.staff_aliases a where a.id = v_alias;
    end if;
    new.alias_name := coalesce(v_alias_name, case when v_role = 'admin' then '管理者' else '' end);
  end if;
  if new.manual_id is not null then
    select mm.title, mm.version into new.manual_title, new.manual_version
    from public.manuals mm where mm.id = new.manual_id and mm.store_id = new.store_id;
    if not found then
      raise exception 'manual not in store' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger confusions_fill before insert on public.confusions
  for each row execute function private.fill_actor();
create trigger usage_events_fill before insert on public.usage_events
  for each row execute function private.fill_actor();

create or replace function private.confusion_to_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usage_events (store_id, event_type, manual_id, step_id, step_no, detail)
  values (new.store_id, 'confusion', new.manual_id, new.step_id, new.step_no, left(new.step_text, 200));
  return new;
end $$;

create trigger confusions_log after insert on public.confusions
  for each row execute function private.confusion_to_event();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger manuals_touch before update on public.manuals
  for each row execute function private.touch_updated_at();
create trigger steps_touch before update on public.manual_steps
  for each row execute function private.touch_updated_at();

-- manual_id と store_id の組み合わせが正しいか（他店舗のマニュアルへの書き込み防止）
create or replace function private.check_manual_store()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.manuals m where m.id = new.manual_id and m.store_id = new.store_id) then
    raise exception 'manual not in store' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger steps_check_store before insert or update on public.manual_steps
  for each row execute function private.check_manual_store();
create trigger quiz_q_check_store before insert or update on public.quiz_questions
  for each row execute function private.check_manual_store();
create trigger acks_check_store before insert or update on public.manual_acks
  for each row execute function private.check_manual_store();

-- 工程を編集したら「未公開の変更あり」にする
create or replace function private.mark_manual_dirty()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.manuals set has_unpublished_changes = true
  where id = coalesce(new.manual_id, old.manual_id) and has_unpublished_changes = false;
  return null;
end $$;

create trigger steps_dirty after insert or update or delete on public.manual_steps
  for each row execute function private.mark_manual_dirty();

-- ============================================================
-- RPC
-- ============================================================

-- PIN 照合 + ロック。成功時に店舗メンバー（役割つき）として登録
create or replace function public.join_store(p_store_code text, p_pin text, p_device_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_store public.stores;
  v_secret public.store_secrets;
  v_lock timestamptz;
  v_since timestamptz;
  v_fails int;
  v_role text;
  v_admin_ok boolean := false;
  v_staff_ok boolean := false;
  c_max_fails constant int := 5;
  c_lock constant interval := interval '15 minutes';
  c_store_max constant int := 50;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_device_id is null or p_device_id !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'invalid device id' using errcode = '22023';
  end if;

  -- 端末ロック中か
  select l.locked_until into v_lock from public.pin_locks l
  where l.device_id = p_device_id and l.locked_until > now();
  if v_lock is not null then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_lock);
  end if;

  select * into v_store from public.stores s where s.code = lower(btrim(coalesce(p_store_code, '')));

  -- 店舗単位の総当たり対策（15分で50回失敗したら店舗のPIN入力を一時停止）
  if v_store.id is not null and (
    select count(*) from public.pin_attempts a
    where a.store_id = v_store.id and not a.success and a.created_at > now() - c_lock
  ) >= c_store_max then
    return jsonb_build_object('ok', false, 'reason', 'store_locked',
      'locked_until', now() + c_lock);
  end if;

  if v_store.id is not null and coalesce(p_pin, '') ~ '^[0-9]{4,8}$' then
    select * into v_secret from public.store_secrets s where s.store_id = v_store.id;
    v_admin_ok := extensions.crypt(p_pin, v_secret.admin_pin_hash) = v_secret.admin_pin_hash;
    v_staff_ok := extensions.crypt(p_pin, v_secret.staff_pin_hash) = v_secret.staff_pin_hash;
  end if;

  if v_admin_ok then
    v_role := 'admin';
  elsif v_staff_ok then
    v_role := 'staff';
  end if;

  if v_role is null then
    insert into public.pin_attempts (store_id, device_id, success) values (v_store.id, p_device_id, false);
    -- 直近の成功・ロック解除・15分前のいずれか遅い時刻以降の失敗回数
    select greatest(
      now() - c_lock,
      coalesce((select max(a.created_at) from public.pin_attempts a
                where a.device_id = p_device_id and a.success), '-infinity'),
      coalesce((select l.locked_until from public.pin_locks l where l.device_id = p_device_id), '-infinity')
    ) into v_since;
    select count(*) into v_fails from public.pin_attempts a
    where a.device_id = p_device_id and not a.success and a.created_at >= v_since;
    if v_fails >= c_max_fails then
      insert into public.pin_locks (device_id, locked_until) values (p_device_id, now() + c_lock)
      on conflict (device_id) do update set locked_until = excluded.locked_until;
      return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + c_lock);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'remaining', c_max_fails - v_fails);
  end if;

  insert into public.pin_attempts (store_id, device_id, success) values (v_store.id, p_device_id, true);
  insert into public.store_members (user_id, store_id, role, alias_id)
  values (v_uid, v_store.id, v_role, null)
  on conflict (user_id) do update set store_id = excluded.store_id, role = excluded.role, alias_id = null;

  return jsonb_build_object('ok', true, 'role', v_role, 'store_id', v_store.id, 'store_name', v_store.name);
end $$;

-- 退出（この端末のメンバー登録を削除）
create or replace function public.leave_store()
returns void language sql security definer set search_path = '' as $$
  delete from public.store_members where user_id = auth.uid();
$$;

-- スタッフが自分の仮名を選ぶ
create or replace function public.select_alias(p_alias_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  select a.name into v_name from public.staff_aliases a
  where a.id = p_alias_id and a.active and a.store_id = private.my_store_id();
  if v_name is null then
    raise exception 'alias not available' using errcode = '42501';
  end if;
  update public.store_members set alias_id = p_alias_id where user_id = auth.uid();
  return jsonb_build_object('ok', true, 'alias_name', v_name);
end $$;

-- 管理者が PIN を変更（平文は保存しない）
create or replace function public.set_store_pin(p_kind text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := private.my_store_id();
  v_secret public.store_secrets;
begin
  if v_store is null or not private.is_admin_of(v_store) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_kind not in ('admin', 'staff') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  if coalesce(p_new_pin, '') !~ '^[0-9]{6,8}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;
  select * into v_secret from public.store_secrets where store_id = v_store;
  if (p_kind = 'admin' and extensions.crypt(p_new_pin, v_secret.staff_pin_hash) = v_secret.staff_pin_hash)
     or (p_kind = 'staff' and extensions.crypt(p_new_pin, v_secret.admin_pin_hash) = v_secret.admin_pin_hash) then
    return jsonb_build_object('ok', false, 'reason', 'same_as_other');
  end if;
  if p_kind = 'admin' then
    update public.store_secrets set admin_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = now() where store_id = v_store;
  else
    update public.store_secrets set staff_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = now() where store_id = v_store;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 公開（編集履歴の保存・作成時間の記録・再確認依頼）
create or replace function public.publish_manual(p_manual_id uuid, p_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_m public.manuals;
  v_steps jsonb;
  v_version int;
  v_seconds int;
begin
  select * into v_m from public.manuals where id = p_manual_id for update;
  if v_m.id is null or not private.is_admin_of(v_m.store_id) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'no', s.rn, 'question', s.question, 'body', s.body, 'photo_path', s.photo_path)
      order by s.rn), '[]'::jsonb)
  into v_steps
  from (
    select st.*, row_number() over (order by st.position, st.created_at) as rn
    from public.manual_steps st
    where st.manual_id = p_manual_id and btrim(st.body) <> ''
  ) s;

  if jsonb_array_length(v_steps) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_steps');
  end if;

  v_version := v_m.version + 1;
  v_seconds := coalesce(v_m.creation_seconds,
    greatest(0, extract(epoch from (now() - v_m.draft_started_at)))::int);

  insert into public.manual_revisions (manual_id, store_id, version, title, steps, note, published_by)
  values (v_m.id, v_m.store_id, v_version, v_m.title, v_steps, left(coalesce(p_note, ''), 200), auth.uid());

  update public.manuals set
    status = 'published', version = v_version, published_at = now(),
    first_published_at = coalesce(first_published_at, now()),
    creation_seconds = v_seconds, has_unpublished_changes = false
  where id = v_m.id;

  if v_version > 1 then
    insert into public.reconfirm_requests (manual_id, store_id, version, note)
    values (v_m.id, v_m.store_id, v_version, left(coalesce(p_note, ''), 200));
  end if;

  insert into public.usage_events (store_id, event_type, manual_id, value, detail)
  values (v_m.store_id, 'manual_published', v_m.id,
    case when v_version = 1 then v_seconds end,
    case when v_version = 1 then '初回公開（作成開始→公開の秒数）' else '更新公開（再確認依頼）' end);

  return jsonb_build_object('ok', true, 'version', v_version, 'creation_seconds', v_seconds);
end $$;

-- スタッフ向けクイズ取得（正答は返さない）
create or replace function public.get_quiz(p_manual_id uuid)
returns table (id uuid, step_no int, question text, choices jsonb)
language sql stable security definer set search_path = '' as $$
  select q.id, q.step_no, q.question, q.choices
  from public.quiz_questions q
  where q.manual_id = p_manual_id and q.store_id = private.my_store_id()
  order by q.created_at
$$;

-- クイズ採点と保存
create or replace function public.submit_quiz(p_manual_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := private.my_store_id();
  v_total int;
  v_correct int;
  v_rate numeric(5, 1);
begin
  if v_store is null or not exists (
    select 1 from public.manuals m where m.id = p_manual_id and m.store_id = v_store and m.status = 'published'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be object' using errcode = '22023';
  end if;
  select count(*), count(*) filter (where (p_answers ->> q.id::text) = q.correct_index::text)
  into v_total, v_correct
  from public.quiz_questions q where q.manual_id = p_manual_id and q.store_id = v_store;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_questions');
  end if;
  v_rate := round(v_correct * 100.0 / v_total, 1);

  insert into public.quiz_attempts (store_id, manual_id, alias_id, user_id, total, correct, rate, answers)
  values (v_store, p_manual_id, private.my_alias_id(), auth.uid(), v_total, v_correct, v_rate, p_answers);

  insert into public.usage_events (store_id, event_type, manual_id, value, detail)
  values (v_store, 'quiz_result', p_manual_id, v_rate, v_correct || '/' || v_total || '問正解');

  return jsonb_build_object('ok', true, 'total', v_total, 'correct', v_correct, 'rate', v_rate,
    'correct_map', (select jsonb_object_agg(q.id::text, q.correct_index)
                    from public.quiz_questions q where q.manual_id = p_manual_id and q.store_id = v_store));
end $$;

revoke all on function public.join_store(text, text, text) from public, anon;
revoke all on function public.leave_store() from public, anon;
revoke all on function public.select_alias(uuid) from public, anon;
revoke all on function public.set_store_pin(text, text) from public, anon;
revoke all on function public.publish_manual(uuid, text) from public, anon;
revoke all on function public.get_quiz(uuid) from public, anon;
revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.join_store(text, text, text) to authenticated;
grant execute on function public.leave_store() to authenticated;
grant execute on function public.select_alias(uuid) to authenticated;
grant execute on function public.set_store_pin(text, text) to authenticated;
grant execute on function public.publish_manual(uuid, text) to authenticated;
grant execute on function public.get_quiz(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- ============================================================
-- Storage（非公開バケット。パスの先頭フォルダ = store_id）
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-photos', 'manual-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy photos_select_member on storage.objects for select to authenticated
  using (
    bucket_id = 'manual-photos'
    and (storage.foldername(name))[1] = (select private.my_store_id())::text
  );
create policy photos_insert_admin on storage.objects for insert to authenticated
  with check (
    bucket_id = 'manual-photos'
    and (storage.foldername(name))[1] = (select private.my_store_id())::text
    and (select private.my_role()) = 'admin'
  );
create policy photos_update_admin on storage.objects for update to authenticated
  using (
    bucket_id = 'manual-photos'
    and (storage.foldername(name))[1] = (select private.my_store_id())::text
    and (select private.my_role()) = 'admin'
  );
create policy photos_delete_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'manual-photos'
    and (storage.foldername(name))[1] = (select private.my_store_id())::text
    and (select private.my_role()) = 'admin'
  );

-- ============================================================
-- Realtime（「わからない」一覧の即時更新）
-- ============================================================
alter publication supabase_realtime add table public.confusions;
