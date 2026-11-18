-- ShopNavi v2（追加機能）
-- 方針:
--  * 追加のみ。既存のテーブル・列・制約・RLS・関数は変更しない
--  * 新機能はすべて店舗ごとの機能フラグ（store_features）で切り替える。既定は OFF（行が無ければ OFF）
--  * フラグの変更は API からはできない（SQL Editor／シードのみ）
--  * 新テーブルは全て RLS 有効・anon からは権限剥奪。他店舗の行は読めない
--  * SECURITY DEFINER は「他人の行を集計する」「店舗を新規作成する」「PIN を照合する」箇所に限定し、
--    関数内で auth.uid() と権限を必ず確認する

-- ============================================================
-- 機能フラグ
-- ============================================================
create table if not exists public.store_features (
  store_id uuid not null references public.stores (id) on delete cascade,
  feature text not null check (feature in (
    'voice_input',     -- A 音声でマニュアル作成
    'promo_image',     -- B 広報画像
    'template_share',  -- C テンプレートの書き出し・取り込み
    'invite',          -- C 招待リンクで新しい店を作る
    'menu_i18n',       -- E メニュー表の多言語化とアレルゲン表示
    'staff_profile',   -- F スタッフの自己申告プロフィール
    'partner_share'    -- D パートナー集計への参加（店舗の同意）
  )),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (store_id, feature)
);

create or replace function private.feature_on(p_store uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select f.enabled from public.store_features f
                   where f.store_id = p_store and f.feature = p_feature), false)
$$;

-- ============================================================
-- A. 入力方法ログ（音声／手入力）
-- ============================================================
create table if not exists public.input_logs (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  manual_id uuid references public.manuals (id) on delete set null,
  manual_title text not null default '' check (char_length(manual_title) <= 60),
  step_no int check (step_no between 1 and 100),
  method text not null check (method in ('voice', 'typed', 'mixed')),
  chars int not null default 0 check (chars between 0 and 2000),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists input_logs_store_created_idx on public.input_logs (store_id, created_at);
create index if not exists input_logs_manual_idx on public.input_logs (manual_id);

-- ============================================================
-- C. 招待リンク（トークンはハッシュのみ保存）
-- ============================================================
create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  note text not null default '' check (char_length(note) <= 40),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_store_id uuid references public.stores (id) on delete set null,
  check (expires_at <= created_at + interval '14 days')
);
create index if not exists store_invites_store_idx on public.store_invites (store_id);
create index if not exists store_invites_created_store_idx on public.store_invites (created_store_id);

-- ============================================================
-- D. パートナー（卸・酒屋）: 集計のみ閲覧
-- ============================================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{3,32}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.partner_secrets (
  partner_id uuid primary key references public.partners (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.partner_stores (
  partner_id uuid not null references public.partners (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  category text not null default 'その他' check (char_length(category) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (partner_id, store_id)
);
create index if not exists partner_stores_store_idx on public.partner_stores (store_id);
create table if not exists public.partner_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists partner_members_partner_idx on public.partner_members (partner_id);

-- ============================================================
-- E. メニュー（多言語・アレルゲン）
-- ============================================================
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name_ja text not null check (char_length(btrim(name_ja)) between 1 and 40),
  description_ja text not null default '' check (char_length(description_ja) <= 120),
  price int check (price between 0 and 1000000),
  -- 特定原材料8品目 + 特定原材料に準ずるもの20品目。店主の入力のみ（自動判定はしない）
  allergens text[] not null default '{}' check (allergens <@ array[
    'shrimp','crab','walnut','wheat','buckwheat','egg','milk','peanut',
    'almond','abalone','squid','salmon_roe','orange','cashew','kiwi','beef','sesame','salmon',
    'mackerel','soybean','chicken','banana','pork','macadamia','peach','yam','apple','gelatin'
  ]::text[]),
  allergens_confirmed_at timestamptz,
  -- {"en":{"name":"","description":"","confirmed":true}, "zh":{...}, "ko":{...}}
  translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object'
    and pg_column_size(translations) < 8000),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_store_idx on public.menu_items (store_id, sort);

-- 日本語を書き換えたら、翻訳の「確定」を外す（古い翻訳がそのまま表示されないように）
create or replace function private.menu_reset_confirm()
returns trigger language plpgsql set search_path = '' as $$
declare
  k text;
begin
  new.updated_at := now();
  if (new.name_ja is distinct from old.name_ja or new.description_ja is distinct from old.description_ja)
     and new.translations is not distinct from old.translations then
    for k in select jsonb_object_keys(new.translations) loop
      new.translations := jsonb_set(new.translations, array[k, 'confirmed'], 'false'::jsonb, true);
    end loop;
  end if;
  if new.allergens is distinct from old.allergens and new.allergens_confirmed_at is not distinct from old.allergens_confirmed_at then
    new.allergens_confirmed_at := null;
  end if;
  return new;
end $$;
create or replace trigger menu_items_reset_confirm before update on public.menu_items
  for each row execute function private.menu_reset_confirm();

-- ============================================================
-- F. スタッフの自己申告プロフィール（項目ごとに本人が公開を選ぶ）
-- ============================================================
create table if not exists public.staff_profile_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  alias_id uuid not null references public.staff_aliases (id) on delete cascade,
  category text not null check (category in ('skill', 'experience', 'wish')),
  value text not null,
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (alias_id, category, value),
  check (
    (category = 'skill' and value in ('接客','レジ','調理','仕込み','盛り付け','掃除','発注・在庫','新人への説明'))
    or (category = 'experience' and value in ('飲食店は初めて','1年未満','1〜3年','3年以上'))
    or (category = 'wish' and value in ('接客をもっとしたい','調理を覚えたい','レジを覚えたい','新人に教えたい','シフトを増やしたい','シフトを減らしたい','今のままでよい'))
  )
);
create index if not exists staff_profile_items_store_idx on public.staff_profile_items (store_id);
create index if not exists staff_profile_items_alias_idx on public.staff_profile_items (alias_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.store_features enable row level security;
alter table public.input_logs enable row level security;
alter table public.store_invites enable row level security;
alter table public.partners enable row level security;
alter table public.partner_secrets enable row level security;
alter table public.partner_stores enable row level security;
alter table public.partner_members enable row level security;
alter table public.menu_items enable row level security;
alter table public.staff_profile_items enable row level security;

revoke all on public.store_features, public.input_logs, public.store_invites, public.partners,
  public.partner_secrets, public.partner_stores, public.partner_members, public.menu_items,
  public.staff_profile_items from anon;
revoke all on public.partner_secrets, public.partner_stores from authenticated;
revoke insert, update, delete on public.store_features, public.partners, public.partner_members from authenticated;
revoke update, delete on public.input_logs from authenticated;
revoke delete on public.store_invites from authenticated;
revoke all on sequence public.input_logs_id_seq from anon;

-- フラグ: 自店舗のメンバーは読める（変更は不可）
drop policy if exists features_select_member on public.store_features;
create policy features_select_member on public.store_features for select to authenticated
  using (store_id = (select private.my_store_id()));

-- 入力方法ログ: 管理者のみ記録・閲覧（フラグONの店舗のみ）
drop policy if exists input_logs_insert_admin on public.input_logs;
create policy input_logs_insert_admin on public.input_logs for insert to authenticated
  with check (
    (select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'voice_input'))
    and user_id = (select auth.uid())
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and (manual_id is null or exists (select 1 from public.manuals m where m.id = manual_id and m.store_id = input_logs.store_id))
  );
drop policy if exists input_logs_select_admin on public.input_logs;
create policy input_logs_select_admin on public.input_logs for select to authenticated
  using ((select private.is_admin_of(store_id)));

-- 招待: 管理者が自店舗の招待を作成・閲覧・取り消し（取り消し = 期限を今にする）
drop policy if exists invites_select_admin on public.store_invites;
create policy invites_select_admin on public.store_invites for select to authenticated
  using ((select private.is_admin_of(store_id)));
drop policy if exists invites_insert_admin on public.store_invites;
create policy invites_insert_admin on public.store_invites for insert to authenticated
  with check (
    (select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'invite'))
    and used_at is null and created_store_id is null
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
drop policy if exists invites_update_admin on public.store_invites;
-- 更新できるのは期限（expires_at）だけで、しかも「今以前」にする＝取り消しのみ
revoke update on public.store_invites from authenticated;
grant update (expires_at) on public.store_invites to authenticated;
create policy invites_update_admin on public.store_invites for update to authenticated
  using ((select private.is_admin_of(store_id)) and used_at is null)
  with check ((select private.is_admin_of(store_id)) and used_at is null and expires_at <= now());

-- パートナー: 自分が属するパートナーの名前だけ読める。店舗の一覧・個別データは読めない（集計は関数経由）
drop policy if exists partners_select_member on public.partners;
create policy partners_select_member on public.partners for select to authenticated
  using (id = (select pm.partner_id from public.partner_members pm where pm.user_id = (select auth.uid())));
drop policy if exists partner_members_select_self on public.partner_members;
create policy partner_members_select_self on public.partner_members for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists partner_members_delete_self on public.partner_members;
grant delete on public.partner_members to authenticated;
create policy partner_members_delete_self on public.partner_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- メニュー: 自店舗のメンバーが閲覧、管理者が編集（フラグONの店舗のみ）
drop policy if exists menu_select_member on public.menu_items;
create policy menu_select_member on public.menu_items for select to authenticated
  using (store_id = (select private.my_store_id()) and (select private.feature_on(store_id, 'menu_i18n')));
drop policy if exists menu_insert_admin on public.menu_items;
create policy menu_insert_admin on public.menu_items for insert to authenticated
  with check ((select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'menu_i18n')));
drop policy if exists menu_update_admin on public.menu_items;
create policy menu_update_admin on public.menu_items for update to authenticated
  using ((select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'menu_i18n')))
  with check ((select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'menu_i18n')));
drop policy if exists menu_delete_admin on public.menu_items;
create policy menu_delete_admin on public.menu_items for delete to authenticated
  using ((select private.is_admin_of(store_id)));

-- プロフィール: 本人（選んだ仮名）だけが作成・変更・削除。管理者は「本人が公開に同意した項目」のみ閲覧
drop policy if exists profile_select_self on public.staff_profile_items;
create policy profile_select_self on public.staff_profile_items for select to authenticated
  using (alias_id = (select private.my_alias_id()) and store_id = (select private.my_store_id()));
drop policy if exists profile_select_admin_shared on public.staff_profile_items;
create policy profile_select_admin_shared on public.staff_profile_items for select to authenticated
  using (shared and (select private.is_admin_of(store_id)) and (select private.feature_on(store_id, 'staff_profile')));
drop policy if exists profile_insert_self on public.staff_profile_items;
create policy profile_insert_self on public.staff_profile_items for insert to authenticated
  with check (
    alias_id = (select private.my_alias_id()) and store_id = (select private.my_store_id())
    and (select private.my_role()) = 'staff' and (select private.feature_on(store_id, 'staff_profile'))
  );
drop policy if exists profile_update_self on public.staff_profile_items;
create policy profile_update_self on public.staff_profile_items for update to authenticated
  using (alias_id = (select private.my_alias_id()) and store_id = (select private.my_store_id()) and (select private.my_role()) = 'staff')
  with check (alias_id = (select private.my_alias_id()) and store_id = (select private.my_store_id()) and (select private.my_role()) = 'staff');
drop policy if exists profile_delete_self on public.staff_profile_items;
create policy profile_delete_self on public.staff_profile_items for delete to authenticated
  using (alias_id = (select private.my_alias_id()) and store_id = (select private.my_store_id()) and (select private.my_role()) = 'staff');

-- ============================================================
-- RPC
-- ============================================================

-- 招待リンクから新しい店舗を作成し、作成者を管理者として登録する
create or replace function public.create_store_from_invite(
  p_token text, p_store_code text, p_store_name text, p_admin_pin text, p_staff_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.store_invites;
  v_code text := lower(btrim(coalesce(p_store_code, '')));
  v_name text := btrim(coalesce(p_store_name, ''));
  v_store uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{32,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  select * into v_inv from public.store_invites i
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if not private.feature_on(v_inv.store_id, 'invite') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if v_code !~ '^[a-z0-9-]{3,32}$' then
    return jsonb_build_object('ok', false, 'reason', 'code_format');
  end if;
  if char_length(v_name) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'reason', 'name_format');
  end if;
  if coalesce(p_admin_pin, '') !~ '^[0-9]{6,8}$' or coalesce(p_staff_pin, '') !~ '^[0-9]{6,8}$' then
    return jsonb_build_object('ok', false, 'reason', 'pin_format');
  end if;
  if p_admin_pin = p_staff_pin then
    return jsonb_build_object('ok', false, 'reason', 'same_pin');
  end if;
  if exists (select 1 from public.stores s where s.code = v_code) then
    return jsonb_build_object('ok', false, 'reason', 'code_taken');
  end if;

  insert into public.stores (code, name) values (v_code, v_name) returning id into v_store;
  insert into public.store_secrets (store_id, admin_pin_hash, staff_pin_hash) values (
    v_store,
    extensions.crypt(p_admin_pin, extensions.gen_salt('bf', 10)),
    extensions.crypt(p_staff_pin, extensions.gen_salt('bf', 10)));
  insert into public.staff_aliases (store_id, name) values (v_store, 'スタッフA'), (v_store, 'スタッフB'), (v_store, 'スタッフC');
  -- 招待元と同じ機能フラグを引き継ぐ（パートナー集計への参加は引き継がない＝新店舗が自分で同意する）
  insert into public.store_features (store_id, feature, enabled)
  select v_store, f.feature, f.enabled from public.store_features f
  where f.store_id = v_inv.store_id and f.feature <> 'partner_share';
  update public.store_invites set used_at = now(), created_store_id = v_store where id = v_inv.id;

  insert into public.store_members (user_id, store_id, role, alias_id)
  values (v_uid, v_store, 'admin', null)
  on conflict (user_id) do update set store_id = excluded.store_id, role = 'admin', alias_id = null;

  return jsonb_build_object('ok', true, 'store_id', v_store, 'store_code', v_code, 'store_name', v_name);
end $$;

-- パートナーとしてログイン（PIN 照合 + 端末ロックは店舗と同じ仕組みを使う）
create or replace function public.join_partner(p_code text, p_pin text, p_device_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.partners;
  v_hash text;
  v_lock timestamptz;
  v_fails int;
  c_max_fails constant int := 5;
  c_lock constant interval := interval '15 minutes';
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_device_id is null or p_device_id !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'invalid device id' using errcode = '22023';
  end if;
  select l.locked_until into v_lock from public.pin_locks l
  where l.device_id = p_device_id and l.locked_until > now();
  if v_lock is not null then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_lock);
  end if;
  select * into v_p from public.partners p where p.code = lower(btrim(coalesce(p_code, '')));
  if v_p.id is not null and coalesce(p_pin, '') ~ '^[0-9]{6,8}$' then
    select s.pin_hash into v_hash from public.partner_secrets s where s.partner_id = v_p.id;
  end if;
  if v_hash is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    insert into public.pin_attempts (store_id, device_id, success) values (null, p_device_id, false);
    select count(*) into v_fails from public.pin_attempts a
    where a.device_id = p_device_id and not a.success and a.created_at > greatest(now() - c_lock,
      coalesce((select max(b.created_at) from public.pin_attempts b where b.device_id = p_device_id and b.success), '-infinity'),
      coalesce((select l.locked_until from public.pin_locks l where l.device_id = p_device_id), '-infinity'));
    if v_fails >= c_max_fails then
      insert into public.pin_locks (device_id, locked_until) values (p_device_id, now() + c_lock)
      on conflict (device_id) do update set locked_until = excluded.locked_until;
      return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + c_lock);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'remaining', c_max_fails - v_fails);
  end if;
  insert into public.pin_attempts (store_id, device_id, success) values (null, p_device_id, true);
  insert into public.partner_members (user_id, partner_id) values (v_uid, v_p.id)
  on conflict (user_id) do update set partner_id = excluded.partner_id;
  return jsonb_build_object('ok', true, 'partner_name', v_p.name, 'is_demo', v_p.is_demo);
end $$;

-- パートナー向け集計。店舗ごとの値は返さない。3店舗未満の集計は返さない（区分も同様）
create or replace function public.partner_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_pid uuid;
  v_p public.partners;
  c_min constant int := 3;
  v_total jsonb;
  v_groups jsonb;
  v_hidden int;
begin
  select pm.partner_id into v_pid from public.partner_members pm where pm.user_id = auth.uid();
  if v_pid is null then
    raise exception 'partner only' using errcode = '42501';
  end if;
  select * into v_p from public.partners where id = v_pid;

  with s as (
    select ps.store_id, ps.category, ps.joined_at,
      (select count(*) from public.manuals m where m.store_id = ps.store_id and m.status = 'published') as manuals,
      (select count(*) from public.confusions c where c.store_id = ps.store_id and c.created_at > now() - interval '30 days') as confusions,
      exists (select 1 from public.usage_events e where e.store_id = ps.store_id and e.created_at > now() - interval '30 days') as active
    from public.partner_stores ps
    where ps.partner_id = v_pid and private.feature_on(ps.store_id, 'partner_share')
  ),
  g as (
    select category, count(*) as n, sum(manuals) as manuals, sum(confusions) as confusions,
      round(100.0 * count(*) filter (where active) / count(*)) as retention
    from s group by category
  )
  select
    (select case when count(*) >= c_min then jsonb_build_object(
        'stores', count(*), 'manuals', sum(manuals), 'confusions_30d', sum(confusions),
        'retention_pct', round(100.0 * count(*) filter (where active) / count(*)),
        'avg_manuals', round(sum(manuals)::numeric / count(*), 1))
      else jsonb_build_object('stores_lt_min', true) end from s),
    (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'stores', n, 'manuals', manuals,
        'confusions_30d', confusions, 'retention_pct', retention) order by category), '[]'::jsonb)
     from g where n >= c_min),
    (select count(*) from g where n < c_min)
  into v_total, v_groups, v_hidden;

  return jsonb_build_object('ok', true, 'partner_name', v_p.name, 'is_demo', v_p.is_demo, 'min_group', c_min,
    'total', v_total, 'groups', v_groups, 'hidden_groups', v_hidden, 'generated_at', now());
end $$;

revoke all on function private.feature_on(uuid, text) from public;
grant execute on function private.feature_on(uuid, text) to authenticated;
revoke all on function private.menu_reset_confirm() from public;
revoke all on function public.create_store_from_invite(text, text, text, text, text) from public, anon;
revoke all on function public.join_partner(text, text, text) from public, anon;
revoke all on function public.partner_summary() from public, anon;
grant execute on function public.create_store_from_invite(text, text, text, text, text) to authenticated;
grant execute on function public.join_partner(text, text, text) to authenticated;
grant execute on function public.partner_summary() to authenticated;
