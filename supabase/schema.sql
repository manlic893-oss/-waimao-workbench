create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  source text check (source in ('阿里国际站', 'RFQ', '展会', '独立站', '社媒', '老客户介绍', '其他')),
  grade text check (grade in ('A', 'B', 'C')),
  status text check (status in ('new', 'follow', 'sample', 'closed', 'lost')),
  whatsapp text,
  email text,
  product text,
  next_follow_date date,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.customer_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in ('inquiry', 'rfq', 'product', 'other', 'relationship')),
  title text not null,
  done boolean not null default false,
  is_template boolean not null default false,
  template_key text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  inquiry_count integer not null default 0,
  rfq_sent integer not null default 0,
  new_products integer not null default 0,
  orders_closed integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_customers_next_follow_date on public.customers(next_follow_date);
create index if not exists idx_customers_status on public.customers(status);
create index if not exists idx_customers_grade on public.customers(grade);
create index if not exists idx_customer_logs_customer_id on public.customer_logs(customer_id);
create index if not exists idx_daily_tasks_date on public.daily_tasks(date);

create unique index if not exists idx_daily_tasks_template_unique
on public.daily_tasks(date, template_key)
where is_template = true and template_key is not null;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_logs enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_stats enable row level security;

drop policy if exists "authenticated users can manage customers" on public.customers;
create policy "authenticated users can manage customers"
on public.customers
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage customer_logs" on public.customer_logs;
create policy "authenticated users can manage customer_logs"
on public.customer_logs
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage daily_tasks" on public.daily_tasks;
create policy "authenticated users can manage daily_tasks"
on public.daily_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage daily_stats" on public.daily_stats;
create policy "authenticated users can manage daily_stats"
on public.daily_stats
for all
to authenticated
using (true)
with check (true);

alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.customer_logs;
alter publication supabase_realtime add table public.daily_tasks;
alter publication supabase_realtime add table public.daily_stats;
