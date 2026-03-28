-- ══════════════════════════════════════════════════════════
-- LinkCore — Supabase SQL Setup
-- Run this ONCE in your Supabase SQL editor (supabase.com → your project → SQL editor)
-- ══════════════════════════════════════════════════════════

-- ── 1. ic_short_links table (short link store) ─────────────
-- Already exists if you used the original LinkCore.
-- Run this safely — it won't overwrite existing data.
create table if not exists ic_short_links (
  code        text primary key,
  target      text not null,
  hits        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast code lookups (redirect speed)
create index if not exists ic_short_links_code_idx on ic_short_links (code);

-- Enable RLS
alter table ic_short_links enable row level security;

-- Allow public read (Googlebot, redirects, hit counts)
create policy "public read" on ic_short_links
  for select using (true);

-- Allow anon write (LinkCore adds links via anon key)
create policy "anon insert" on ic_short_links
  for insert with check (true);

-- Allow anon update (hit counter increments)
create policy "anon update" on ic_short_links
  for update using (true) with check (true);

-- Allow anon delete (LinkCore deletes links)
create policy "anon delete" on ic_short_links
  for delete using (true);


-- ── 2. lc_links table (LinkCore project links) ─────────────
create table if not exists lc_links (
  id           text primary key,
  project_id   text not null,
  original     text not null,
  code         text not null,
  verdict      text default 'pending',
  hits         integer default 0,
  submitted    boolean default false,
  retry_count  integer default 0,
  site_id      text,           -- which multi-site domain this link belongs to
  added_at     timestamptz not null default now()
);

create index if not exists lc_links_project_idx on lc_links (project_id);
create index if not exists lc_links_code_idx    on lc_links (code);

alter table lc_links enable row level security;
create policy "allow all" on lc_links for all using (true) with check (true);


-- ── 3. lc_projects table ───────────────────────────────────
create table if not exists lc_projects (
  id          text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table lc_projects enable row level security;
create policy "allow all" on lc_projects for all using (true) with check (true);


-- ── 4. lc_sites table (Multi-Site config) ──────────────────
create table if not exists lc_sites (
  id          text primary key,
  sites_json  text,
  updated_at  timestamptz default now()
);

alter table lc_sites enable row level security;
create policy "allow all" on lc_sites for all using (true) with check (true);


-- ── 5. increment_hit RPC ────────────────────────────────────
-- Called by the redirect Edge Function every time a link is visited.
-- Atomic increment — no race condition even under high traffic.
create or replace function increment_hit(link_code text)
returns void
language plpgsql
security definer
as $$
begin
  update ic_short_links
  set
    hits       = hits + 1,
    updated_at = now()
  where code = link_code;
end;
$$;

-- Grant execute to anon role (called by Edge Function with anon key)
grant execute on function increment_hit(text) to anon;
grant execute on function increment_hit(text) to authenticated;


-- ── 6. Verify everything was created ───────────────────────
select
  table_name,
  (select count(*) from information_schema.columns c
   where c.table_name = t.table_name) as column_count
from information_schema.tables t
where table_schema = 'public'
  and table_name in ('ic_short_links','lc_links','lc_projects','lc_sites')
order by table_name;
