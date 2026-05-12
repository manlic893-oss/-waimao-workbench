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

create or replace function public.get_customer_dashboard_aggregate()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'totalCount', count(*)::int,
    'sourceData', coalesce((
      select jsonb_agg(jsonb_build_object('name', source_name, 'value', total) order by total desc, source_name)
      from (
        select coalesce(source, '未填写') as source_name, count(*)::int as total
        from public.customers
        group by coalesce(source, '未填写')
      ) grouped_source
    ), '[]'::jsonb),
    'funnelData', coalesce((
      select jsonb_agg(jsonb_build_object('status', status_name, 'value', total) order by total desc, status_name)
      from (
        select status as status_name, count(*)::int as total
        from public.customers
        where status is not null
        group by status
      ) grouped_status
    ), '[]'::jsonb)
  )
  into result
  from public.customers;

  return result;
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
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.customer_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
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
  user_id uuid references auth.users(id) on delete set null,
  date date not null,
  fixed_task_id uuid references public.fixed_tasks(id) on delete set null,
  title text not null,
  category text not null check (category in ('inquiry', 'rfq', 'product', 'other', 'relationship', 'data', 'development')),
  done boolean not null default false,
  removed boolean not null default false,
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
  user_id uuid references auth.users(id) on delete set null,
  date date not null,
  inquiry_count integer not null default 0,
  rfq_sent integer not null default 0,
  new_products integer not null default 0,
  orders_closed integer not null default 0,
  notes text,
  ai_summary text,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.product_knowledge (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text,
  specs text,
  price_range text,
  moq text,
  material text,
  lead_time text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.alibaba_title_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  image_path text not null,
  sku text,
  confirmed_material text,
  confirmed_size text,
  confirmed_usage text,
  reference_text text,
  forbidden_words text[] not null default '{}',
  product_identification text,
  possible_material text,
  shape_or_style text,
  recommended_keywords text[] not null default '{}',
  keywords_to_avoid text[] not null default '{}',
  titles jsonb not null default '[]'::jsonb,
  recommended_title text,
  reason text,
  risk_check text[] not null default '{}',
  confirmed_title text,
  status text not null default 'generated' check (status in ('generated', 'confirmed')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  url text,
  content text,
  summary text,
  tags text[],
  category text check (category in ('sales_skills', 'trade_knowledge', 'tools', 'other')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_customers_next_follow_date on public.customers(next_follow_date);
create index if not exists idx_customers_status on public.customers(status);
create index if not exists idx_customers_grade on public.customers(grade);
create index if not exists idx_customers_assigned_to on public.customers(assigned_to);
create index if not exists idx_customer_logs_customer_id on public.customer_logs(customer_id);
create index if not exists idx_fixed_tasks_category on public.fixed_tasks(category, weekday, is_active);
create index if not exists idx_daily_task_records_date on public.daily_task_records(date);
create index if not exists idx_daily_tasks_date on public.daily_tasks(date);
create index if not exists idx_daily_task_records_user_date on public.daily_task_records(user_id, date);
create index if not exists idx_daily_stats_user_date on public.daily_stats(user_id, date);
create index if not exists idx_knowledge_articles_user_id on public.knowledge_articles(user_id);
create index if not exists idx_product_knowledge_category on public.product_knowledge(category);
create index if not exists idx_alibaba_title_generations_user_id on public.alibaba_title_generations(user_id);
create index if not exists idx_alibaba_title_generations_created_at on public.alibaba_title_generations(created_at desc);
create unique index if not exists idx_daily_task_records_owner_unique
on public.daily_task_records(date, created_by, fixed_task_id)
where fixed_task_id is not null and created_by is not null;
create unique index if not exists idx_daily_stats_owner_unique
on public.daily_stats(date, created_by)
where created_by is not null;
create unique index if not exists idx_daily_task_records_user_unique
on public.daily_task_records(date, user_id, fixed_task_id)
where fixed_task_id is not null and user_id is not null;
create unique index if not exists idx_daily_stats_user_unique
on public.daily_stats(date, user_id)
where user_id is not null;

alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.customer_logs add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.daily_task_records add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.daily_task_records add column if not exists removed boolean not null default false;
alter table public.daily_stats add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.daily_stats add column if not exists ai_summary text;
alter table public.daily_stats add column if not exists submitted_at timestamptz;
alter table public.daily_stats drop constraint if exists daily_stats_date_key;

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

drop trigger if exists set_product_knowledge_updated_at on public.product_knowledge;
create trigger set_product_knowledge_updated_at
before update on public.product_knowledge
for each row
execute function public.set_updated_at();

drop trigger if exists set_alibaba_title_generations_updated_at on public.alibaba_title_generations;
create trigger set_alibaba_title_generations_updated_at
before update on public.alibaba_title_generations
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
alter table public.product_knowledge enable row level security;
alter table public.alibaba_title_generations enable row level security;
alter table public.knowledge_articles enable row level security;

drop policy if exists "authenticated users can manage customers" on public.customers;
drop policy if exists "users can view own customers" on public.customers;
drop policy if exists "users can insert own customers" on public.customers;
drop policy if exists "users can update own customers" on public.customers;
drop policy if exists "users can delete own customers" on public.customers;

create policy "users can view own customers"
on public.customers
for select
to authenticated
using (assigned_to = auth.uid() or created_by = auth.uid());

create policy "users can insert own customers"
on public.customers
for insert
to authenticated
with check ((assigned_to = auth.uid() or assigned_to is null) and created_by = auth.uid());

create policy "users can update own customers"
on public.customers
for update
to authenticated
using (assigned_to = auth.uid() or created_by = auth.uid())
with check (assigned_to = auth.uid() or created_by = auth.uid());

create policy "users can delete own customers"
on public.customers
for delete
to authenticated
using (assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "authenticated users can manage customer_logs" on public.customer_logs;
drop policy if exists "users can view own customer_logs" on public.customer_logs;
drop policy if exists "users can insert own customer_logs" on public.customer_logs;
drop policy if exists "users can update own customer_logs" on public.customer_logs;
drop policy if exists "users can delete own customer_logs" on public.customer_logs;

create policy "users can view own customer_logs"
on public.customer_logs
for select
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

create policy "users can insert own customer_logs"
on public.customer_logs
for insert
to authenticated
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can update own customer_logs"
on public.customer_logs
for update
to authenticated
using (user_id = auth.uid() or created_by = auth.uid())
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can delete own customer_logs"
on public.customer_logs
for delete
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

grant execute on function public.get_team_customer_dashboard() to authenticated;

drop policy if exists "authenticated users can manage fixed_tasks" on public.fixed_tasks;
create policy "authenticated users can manage fixed_tasks"
on public.fixed_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage daily_task_records" on public.daily_task_records;
drop policy if exists "users can view own daily_task_records" on public.daily_task_records;
drop policy if exists "users can insert own daily_task_records" on public.daily_task_records;
drop policy if exists "users can update own daily_task_records" on public.daily_task_records;
drop policy if exists "users can delete own daily_task_records" on public.daily_task_records;

create policy "users can view own daily_task_records"
on public.daily_task_records
for select
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

create policy "users can insert own daily_task_records"
on public.daily_task_records
for insert
to authenticated
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can update own daily_task_records"
on public.daily_task_records
for update
to authenticated
using (user_id = auth.uid() or created_by = auth.uid())
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can delete own daily_task_records"
on public.daily_task_records
for delete
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

drop policy if exists "authenticated users can manage daily_tasks" on public.daily_tasks;
create policy "authenticated users can manage daily_tasks"
on public.daily_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage daily_stats" on public.daily_stats;
drop policy if exists "users can view own daily_stats" on public.daily_stats;
drop policy if exists "authenticated users can view all daily_stats" on public.daily_stats;
drop policy if exists "users can insert own daily_stats" on public.daily_stats;
drop policy if exists "users can update own daily_stats" on public.daily_stats;
drop policy if exists "users can delete own daily_stats" on public.daily_stats;

create policy "authenticated users can view all daily_stats"
on public.daily_stats
for select
to authenticated
using (true);

create policy "users can insert own daily_stats"
on public.daily_stats
for insert
to authenticated
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can update own daily_stats"
on public.daily_stats
for update
to authenticated
using (user_id = auth.uid() or created_by = auth.uid())
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can delete own daily_stats"
on public.daily_stats
for delete
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

drop policy if exists "authenticated users can manage product_knowledge" on public.product_knowledge;
create policy "authenticated users can manage product_knowledge"
on public.product_knowledge
for all
to authenticated
using (true)
with check (true);

drop policy if exists "users can view own alibaba_title_generations" on public.alibaba_title_generations;
drop policy if exists "users can insert own alibaba_title_generations" on public.alibaba_title_generations;
drop policy if exists "users can update own alibaba_title_generations" on public.alibaba_title_generations;
drop policy if exists "users can delete own alibaba_title_generations" on public.alibaba_title_generations;

create policy "users can view own alibaba_title_generations"
on public.alibaba_title_generations
for select
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

create policy "users can insert own alibaba_title_generations"
on public.alibaba_title_generations
for insert
to authenticated
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can update own alibaba_title_generations"
on public.alibaba_title_generations
for update
to authenticated
using (user_id = auth.uid() or created_by = auth.uid())
with check (user_id = auth.uid() or created_by = auth.uid());

create policy "users can delete own alibaba_title_generations"
on public.alibaba_title_generations
for delete
to authenticated
using (user_id = auth.uid() or created_by = auth.uid());

drop policy if exists "authenticated users can manage knowledge_articles" on public.knowledge_articles;
drop policy if exists "users can view own knowledge_articles" on public.knowledge_articles;
drop policy if exists "users can insert own knowledge_articles" on public.knowledge_articles;
drop policy if exists "users can update own knowledge_articles" on public.knowledge_articles;
drop policy if exists "users can delete own knowledge_articles" on public.knowledge_articles;

create policy "users can view own knowledge_articles"
on public.knowledge_articles
for select
to authenticated
using (user_id = auth.uid());

create policy "users can insert own knowledge_articles"
on public.knowledge_articles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can update own knowledge_articles"
on public.knowledge_articles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own knowledge_articles"
on public.knowledge_articles
for delete
to authenticated
using (user_id = auth.uid());

grant execute on function public.get_customer_dashboard_aggregate() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-title-images',
  'product-title-images',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can view own product title images" on storage.objects;
drop policy if exists "users can upload own product title images" on storage.objects;
drop policy if exists "users can update own product title images" on storage.objects;
drop policy if exists "users can delete own product title images" on storage.objects;

create policy "users can view own product title images"
on storage.objects
for select
to authenticated
using (bucket_id = 'product-title-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can upload own product title images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-title-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can update own product title images"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-title-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'product-title-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete own product title images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-title-images' and (storage.foldername(name))[1] = auth.uid()::text);

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_logs'
  ) then
    alter publication supabase_realtime add table public.customer_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fixed_tasks'
  ) then
    alter publication supabase_realtime add table public.fixed_tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_task_records'
  ) then
    alter publication supabase_realtime add table public.daily_task_records;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_tasks'
  ) then
    alter publication supabase_realtime add table public.daily_tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_stats'
  ) then
    alter publication supabase_realtime add table public.daily_stats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_knowledge'
  ) then
    alter publication supabase_realtime add table public.product_knowledge;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alibaba_title_generations'
  ) then
    alter publication supabase_realtime add table public.alibaba_title_generations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_articles'
  ) then
    alter publication supabase_realtime add table public.knowledge_articles;
  end if;
end
$$;
