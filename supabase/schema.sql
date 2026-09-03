-- =========================================================
-- DocuExtract - Esquema de base de datos (Supabase / Postgres)
-- =========================================================
-- Ejecutar en el SQL Editor de Supabase, en orden.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. Empresas (multi-tenant simple)
-- ---------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  tax_id text,
  country text default 'CO',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. Perfiles de usuario (vinculan auth.users a una empresa)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  full_name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

-- Crea automaticamente un perfil (y una empresa personal) cuando se registra un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name)
  values (coalesce(new.raw_user_meta_data->>'company_name', 'Mi Empresa'))
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (new.id, new_company_id, new.raw_user_meta_data->>'full_name', 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- 3. Facturas / tickets
-- ---------------------------------------------------------
do $$ begin
  create type public.invoice_status as enum (
    'pending',      -- subida, en cola de procesamiento
    'processing',   -- OCR en curso
    'completed',    -- extraido con confianza aceptable
    'needs_review', -- extraido con baja confianza, requiere validacion humana
    'failed'        -- error irrecuperable en el pipeline
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,

  -- Archivo original
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint,

  -- Estado del pipeline
  status public.invoice_status not null default 'pending',
  ocr_confidence numeric(5, 2),          -- confianza cruda del motor OCR (0-100)
  extraction_confidence numeric(5, 2),   -- confianza combinada (OCR + campos hallados)
  processing_error text,
  raw_text text,                         -- texto crudo extraido (OCR o capa de texto del PDF)

  -- Campos fiscales normalizados
  vendor_name text,
  vendor_tax_id text,                    -- NIT / RIF / CUIT / RFC / RUC segun region
  tax_id_type text,                      -- 'NIT' | 'RIF' | 'CUIT' | 'RFC' | 'RUC' | 'UNKNOWN'
  invoice_number text,
  issue_date date,
  due_date date,
  currency text default 'COP',
  subtotal_amount numeric(14, 2),
  tax_amount numeric(14, 2),
  total_amount numeric(14, 2),

  -- Validacion humana
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_company_id_idx on public.invoices (company_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);

-- ---------------------------------------------------------
-- 4. Items / conceptos de cada factura
-- ---------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12, 3) default 1,
  unit_price numeric(14, 2),
  total_price numeric(14, 2)
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------
-- 5. Trigger de updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create or replace function public.current_company_id()
returns uuid
language sql stable
security definer set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create policy "companies: ver la propia" on public.companies
  for select using (id = public.current_company_id());

create policy "profiles: ver mi perfil y compañeros" on public.profiles
  for select using (company_id = public.current_company_id());

create policy "invoices: CRUD dentro de la empresa" on public.invoices
  for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "invoice_items: CRUD via factura de mi empresa" on public.invoice_items
  for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------
-- 7. Storage: bucket privado para los documentos originales
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices storage: leer archivos de mi empresa"
  on storage.objects for select
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "invoices storage: subir archivos a mi empresa"
  on storage.objects for insert
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
