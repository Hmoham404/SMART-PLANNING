-- Structure compacte pour les entités métier de MYC Smart Planning V3.
-- À exécuter une seule fois ; les anciennes tables Excel restent intactes.
create table if not exists public.myc_records (
 id text primary key,
 type text not null check (type in ('order','material','operation','delivery','history','schedule','holiday','issue','entry','movement','plan')),
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 updated_at timestamptz not null default now(),
 revision bigint not null default 1
);
create index if not exists myc_records_type_idx on public.myc_records(type);
alter table public.myc_records enable row level security;
grant select, insert, update on public.myc_records to anon, authenticated;
drop policy if exists myc_records_select on public.myc_records;
drop policy if exists myc_records_insert on public.myc_records;
drop policy if exists myc_records_update on public.myc_records;
create policy myc_records_select on public.myc_records for select to anon, authenticated using (true);
create policy myc_records_insert on public.myc_records for insert to anon, authenticated with check (true);
create policy myc_records_update on public.myc_records for update to anon, authenticated using (true) with check (true);
-- Sans authentification : toute personne possédant l’URL et la clé publique
-- peut lire et modifier ces données. Restreindre l’exposition réseau.

alter table public.myc_records add column if not exists revision bigint not null default 1;
create or replace function public.myc_record_version() returns trigger language plpgsql as $$
begin
 new.updated_at = now();
 new.revision = old.revision + 1;
 return new;
end;
$$;
drop trigger if exists myc_record_version on public.myc_records;
create trigger myc_record_version before update on public.myc_records for each row execute function public.myc_record_version();
