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

create or replace function public.get_team_customer_dashboard()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalCount',
    count(*)::int,
    'dueCount',
    count(*) filter (where next_follow_date is not null and next_follow_date <= current_date)::int,
    'gradeACount',
    count(*) filter (where grade = 'A')::int,
    'closedCount',
    count(*) filter (where status = 'closed')::int,
    'sourceData',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', grouped.source_name,
            'value', grouped.total
          )
          order by grouped.total desc, grouped.source_name
        )
        from (
          select coalesce(source, '未填写') as source_name, count(*)::int as total
          from public.customers
          group by coalesce(source, '未填写')
        ) as grouped
      ),
      '[]'::jsonb
    ),
    'funnelData',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', grouped.status,
            'value', grouped.total
          )
          order by grouped.total desc, grouped.status
        )
        from (
          select status, count(*)::int as total
          from public.customers
          where status is not null
          group by status
        ) as grouped
      ),
      '[]'::jsonb
    )
  )
  from public.customers;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  address text,
  phone text,
  source text check (source in ('阿里国际站', 'RFQ', '展会', '独立站', '社媒', '老客户介绍', '其他')),
  grade text check (grade in ('A', 'B', 'C')),
  status text check (status in (
    'no_reply_inquiry',
    'no_reply_quote',
    'no_reply_followup',
    'pending_quote',
    'catalog_sent',
    'price_negotiation',
    'pending_recommend',
    'pending_drawing',
    'pending_sample',
    'sample_sent',
    'no_order',
    'pending_factory',
    'factory_done',
    'pending_order',
    'closed',
    'lost'
  )),
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

create table if not exists public.fixed_tasks (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('daily', 'weekly')),
  weekday integer,
  title text not null,
  task_category text not null check (task_category in ('inquiry', 'rfq', 'product', 'other', 'relationship', 'data', 'development')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.daily_task_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  fixed_task_id uuid references public.fixed_tasks(id) on delete set null,
  title text not null,
  category text not null check (category in ('inquiry', 'rfq', 'product', 'other', 'relationship', 'data', 'development')),
  done boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
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
create index if not exists idx_fixed_tasks_category on public.fixed_tasks(category, weekday, is_active);
create index if not exists idx_daily_task_records_date on public.daily_task_records(date);
create index if not exists idx_daily_tasks_date on public.daily_tasks(date);

alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;

create unique index if not exists idx_daily_tasks_template_unique
on public.daily_tasks(date, template_key)
where is_template = true and template_key is not null;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

drop trigger if exists set_fixed_tasks_updated_at on public.fixed_tasks;
create trigger set_fixed_tasks_updated_at
before update on public.fixed_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_daily_task_records_updated_at on public.daily_task_records;
create trigger set_daily_task_records_updated_at
before update on public.daily_task_records
for each row
execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_logs enable row level security;
alter table public.fixed_tasks enable row level security;
alter table public.daily_task_records enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_stats enable row level security;

drop policy if exists "authenticated users can manage customers" on public.customers;
drop policy if exists "users can view own customers" on public.customers;
drop policy if exists "users can insert own customers" on public.customers;
drop policy if exists "users can update own customers" on public.customers;
drop policy if exists "users can delete own customers" on public.customers;

create policy "users can view own customers"
on public.customers
for select
to authenticated
using (created_by = auth.uid());

create policy "users can insert own customers"
on public.customers
for insert
to authenticated
with check (created_by = auth.uid());

create policy "users can update own customers"
on public.customers
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "users can delete own customers"
on public.customers
for delete
to authenticated
using (created_by = auth.uid());

drop policy if exists "authenticated users can manage customer_logs" on public.customer_logs;
drop policy if exists "users can view own customer_logs" on public.customer_logs;
drop policy if exists "users can insert own customer_logs" on public.customer_logs;
drop policy if exists "users can update own customer_logs" on public.customer_logs;
drop policy if exists "users can delete own customer_logs" on public.customer_logs;

create policy "users can view own customer_logs"
on public.customer_logs
for select
to authenticated
using (created_by = auth.uid());

create policy "users can insert own customer_logs"
on public.customer_logs
for insert
to authenticated
with check (created_by = auth.uid());

create policy "users can update own customer_logs"
on public.customer_logs
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "users can delete own customer_logs"
on public.customer_logs
for delete
to authenticated
using (created_by = auth.uid());

grant execute on function public.get_team_customer_dashboard() to authenticated;

drop policy if exists "authenticated users can manage fixed_tasks" on public.fixed_tasks;
create policy "authenticated users can manage fixed_tasks"
on public.fixed_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage daily_task_records" on public.daily_task_records;
create policy "authenticated users can manage daily_task_records"
on public.daily_task_records
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

insert into public.fixed_tasks (category, weekday, title, task_category, sort_order, is_active)
select seed.category, seed.weekday, seed.title, seed.task_category, seed.sort_order, true
from (
  values
    ('daily', null, '回复所有询盘和消息', 'inquiry', 1),
    ('daily', null, '刷RFQ，发有效报价（目标10条）', 'rfq', 2),
    ('daily', null, '优化1个低流量产品（标题/主图/详情）', 'product', 3),
    ('daily', null, '记录客户、更新跟进状态', 'relationship', 4),
    ('weekly', 1, '看上周数据（曝光、点击、询盘），逛同行店铺', 'data', 10),
    ('weekly', 3, '集中拍摄新品、完成上架，补充产品资料', 'product', 11),
    ('weekly', 5, '整理未回复客户，发邮件开发新客户', 'development', 12)
) as seed(category, weekday, title, task_category, sort_order)
where not exists (
  select 1
  from public.fixed_tasks existing
  where existing.category = seed.category
    and coalesce(existing.weekday, 0) = coalesce(seed.weekday, 0)
    and existing.title = seed.title
);

alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.customer_logs;
alter publication supabase_realtime add table public.fixed_tasks;
alter publication supabase_realtime add table public.daily_task_records;
alter publication supabase_realtime add table public.daily_tasks;
alter publication supabase_realtime add table public.daily_stats;
