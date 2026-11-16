-- Crée la table de stockage des feuilles. Exécuter après schema.sql.
-- Attention : cette politique autorise lecture et écriture avec la clé publique.
create table if not exists public.workbook_rows (
  sheet_name text not null,
  row_number integer not null,
  cells jsonb not null,
  formulas jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (sheet_name, row_number)
);
alter table public.workbook_rows enable row level security;
grant select, insert, update, delete on public.workbook_rows to anon, authenticated;
drop policy if exists "myc_workbook_access" on public.workbook_rows;
create policy "myc_workbook_access" on public.workbook_rows for all to anon, authenticated using (true) with check (true);
