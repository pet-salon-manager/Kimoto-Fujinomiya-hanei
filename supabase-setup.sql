-- ふじのみや旅ナビ 管理者画面用 Supabase セットアップ
create extension if not exists pgcrypto;

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  genre text default '',
  area text default '',
  address text default '',
  phone text default '',
  homepage text default '',
  description text default '',
  image_url text default '',
  lat double precision,
  lng double precision,
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.spots enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "spots public read" on public.spots;
create policy "spots public read"
on public.spots for select
using (active = true or public.is_admin());

drop policy if exists "spots admin insert" on public.spots;
create policy "spots admin insert"
on public.spots for insert
to authenticated
with check (public.is_admin());

drop policy if exists "spots admin update" on public.spots;
create policy "spots admin update"
on public.spots for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "spots admin delete" on public.spots;
create policy "spots admin delete"
on public.spots for delete
to authenticated
using (public.is_admin());

drop policy if exists "admin can read own row" on public.admin_users;
create policy "admin can read own row"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('spot-images', 'spot-images', true)
on conflict (id) do update set public = true;

drop policy if exists "spot images public read" on storage.objects;
create policy "spot images public read"
on storage.objects for select
using (bucket_id = 'spot-images');

drop policy if exists "spot images admin insert" on storage.objects;
create policy "spot images admin insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'spot-images' and public.is_admin());

drop policy if exists "spot images admin update" on storage.objects;
create policy "spot images admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'spot-images' and public.is_admin());

drop policy if exists "spot images admin delete" on storage.objects;
create policy "spot images admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'spot-images' and public.is_admin());

-- Authで管理者ユーザーを作成した後、そのユーザーのUUIDを使って次を実行してください。
-- insert into public.admin_users (user_id) values ('ここにAuthユーザーのUUID');
