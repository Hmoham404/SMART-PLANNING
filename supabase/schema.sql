-- MYC Smart Planning : exécuter dans l’éditeur SQL Supabase.
-- ATTENTION : accès anonyme en lecture/écriture. À utiliser uniquement sur un réseau de confiance.
create extension if not exists pgcrypto;
create table if not exists public.production_entries (
 id uuid primary key default gen_random_uuid(), entry_date date not null,
 department text not null, shift text not null, machine text not null, client text not null,
 product text not null, production_order text not null,
 planned_quantity numeric not null check (planned_quantity >= 0),
 produced_quantity numeric not null check (produced_quantity >= 0),
 rejected_quantity numeric not null default 0 check (rejected_quantity >= 0 and rejected_quantity <= produced_quantity),
 downtime_minutes numeric not null default 0 check (downtime_minutes >= 0),
 downtime_reason text not null default '', comment text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists production_entries_date_idx on public.production_entries(entry_date desc);
create or replace function public.myc_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists production_entries_updated on public.production_entries;
create trigger production_entries_updated before update on public.production_entries for each row execute function public.myc_set_updated_at();
alter table public.production_entries enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.production_entries to anon, authenticated;
drop policy if exists "myc_anonymous_access" on public.production_entries;
create policy "myc_anonymous_access" on public.production_entries for all to anon, authenticated using (true) with check (true);
