create extension if not exists "pgcrypto";

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists processes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid not null references clients(id) on delete cascade,
  numero text not null,
  tipo text,
  status text not null default 'ativo',
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  process_id uuid not null references processes(id) on delete cascade,
  descricao text not null,
  data date not null,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid not null references clients(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  status text not null default 'pendente',
  created_at timestamptz default now()
);

alter table clients enable row level security;
alter table processes enable row level security;
alter table deadlines enable row level security;
alter table payments enable row level security;

drop policy if exists "clients_select_own" on clients;
drop policy if exists "clients_insert_own" on clients;
drop policy if exists "clients_update_own" on clients;
drop policy if exists "clients_delete_own" on clients;

drop policy if exists "processes_select_own" on processes;
drop policy if exists "processes_insert_own" on processes;
drop policy if exists "processes_update_own" on processes;
drop policy if exists "processes_delete_own" on processes;

drop policy if exists "deadlines_select_own" on deadlines;
drop policy if exists "deadlines_insert_own" on deadlines;
drop policy if exists "deadlines_update_own" on deadlines;
drop policy if exists "deadlines_delete_own" on deadlines;

drop policy if exists "payments_select_own" on payments;
drop policy if exists "payments_insert_own" on payments;
drop policy if exists "payments_update_own" on payments;
drop policy if exists "payments_delete_own" on payments;

create policy "clients_select_own" on clients for select using (auth.uid() = user_id);
create policy "clients_insert_own" on clients for insert with check (auth.uid() = user_id);
create policy "clients_update_own" on clients for update using (auth.uid() = user_id);
create policy "clients_delete_own" on clients for delete using (auth.uid() = user_id);

create policy "processes_select_own" on processes for select using (auth.uid() = user_id);
create policy "processes_insert_own" on processes for insert with check (auth.uid() = user_id);
create policy "processes_update_own" on processes for update using (auth.uid() = user_id);
create policy "processes_delete_own" on processes for delete using (auth.uid() = user_id);

create policy "deadlines_select_own" on deadlines for select using (auth.uid() = user_id);
create policy "deadlines_insert_own" on deadlines for insert with check (auth.uid() = user_id);
create policy "deadlines_update_own" on deadlines for update using (auth.uid() = user_id);
create policy "deadlines_delete_own" on deadlines for delete using (auth.uid() = user_id);

create policy "payments_select_own" on payments for select using (auth.uid() = user_id);
create policy "payments_insert_own" on payments for insert with check (auth.uid() = user_id);
create policy "payments_update_own" on payments for update using (auth.uid() = user_id);
create policy "payments_delete_own" on payments for delete using (auth.uid() = user_id);
