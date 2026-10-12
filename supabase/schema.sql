-- ============================================================================
-- CalmDesk → Supabase: схема БД + Row Level Security (RLS)
--
-- КАК ПРИМЕНИТЬ:
--   Supabase Dashboard → SQL Editor → New query → вставить весь файл → Run.
--   Повторное выполнение безопасно (все объекты пересоздаются через IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Модель доступа:
--   * profile.role        : 'manager' (руководитель) | 'employee' (сотрудник)
--   * team_memberships    : связь «руководитель ↔ сотрудник» (объединение аккаунтов)
--   * задачи/назначения/статусы дней хранятся ПОД ВЛАДЕЛЬЦЕМ (owner_id = auth.uid())
--   * руководитель читает данные своих сотрудников и может создавать задачи у них;
--     сотрудник не видит чужие данные; администратор (service role) — всё.
-- ============================================================================

-- ── 1. Профили (привязаны к auth.users) ─────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique not null,
  display_name  text not null default '',
  role          text not null default 'employee' check (role in ('manager', 'employee')),
  created_at    timestamptz not null default now()
);

-- Авто-создание профиля при регистрации (через Auth → Sign Up).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    -- первый зарегистрированный пользователь становится руководителем;
    -- дальше роли назначаются вручную (см. п.5) или руководителем из UI.
    case when (select count(*) from public.profiles) = 0 then 'manager' else 'employee' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Само-восстановление профиля при входе: если триггер по какой-то причине
-- не создал строку в profiles (например, схема применена уже после
-- регистрации пользователей), RPC ensure_my_profile() создаст её.
-- Вызывается из UI после signInWithPassword.
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    coalesce((select raw_user_meta_data ->> 'display_name' from auth.users where id = auth.uid()),
             split_part(coalesce((select email from auth.users where id = auth.uid()), ''), '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'manager' else 'employee' end
  )
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.ensure_my_profile() from anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- ── 2. Команды: руководитель привязывает к себе сотрудников ────────────────
create table if not exists public.team_memberships (
  manager_id  uuid not null references public.profiles (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (manager_id, employee_id)
);

-- ── 3. Доменные таблицы (идентичны типам приложения) ────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  total_hours  numeric not null default 0,
  color        text not null default '#3996D2',
  description  text,
  link         text,
  status       text check (status in ('new', 'completed')) default 'new',
  created_at   timestamptz,
  completed_at timestamptz
);
create index if not exists tasks_owner_idx on public.tasks (owner_id);

create table if not exists public.assignments (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references public.profiles (id) on delete cascade,
  task_id   uuid not null references public.tasks (id) on delete cascade,
  day_id    text not null,
  hours     numeric not null default 0,
  "order"   integer not null default 0
);
create index if not exists assignments_owner_idx on public.assignments (owner_id);
create index if not exists assignments_task_idx  on public.assignments (task_id);

create table if not exists public.day_statuses (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  day_id     text not null,
  status     text not null check (status in ('vacation', 'holiday', 'short')),
  short_hours numeric,
  primary key (owner_id, day_id)
);

-- ── 3.1 Самовосстановление схемы ─────────────────────────────────────────────
-- Если таблицы уже были созданы ранее без колонки owner_id (или приложение
-- вставляет UUID-строки формата crypto.randomUUID() в таблицу с id типа text),
-- PostgREST вернёт 400 Bad Request при POST /tasks. Приводим схему к ожидаемому
-- виду безопасно и идемпотентно.
do $$
begin
  if to_regclass('public.tasks') is not null then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='owner_id') then
      alter table public.tasks add column owner_id uuid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='id' and data_type <> 'uuid') then
      alter table public.tasks alter column id type uuid using (case when id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then id::uuid else gen_random_uuid() end);
    end if;
  end if;

  if to_regclass('public.assignments') is not null then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='owner_id') then
      alter table public.assignments add column owner_id uuid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='id' and data_type <> 'uuid') then
      alter table public.assignments alter column id type uuid using (case when id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then id::uuid else gen_random_uuid() end);
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='task_id' and data_type <> 'uuid') then
      alter table public.assignments alter column task_id type uuid using (case when task_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then task_id::uuid else gen_random_uuid() end);
    end if;
  end if;

  if to_regclass('public.day_statuses') is not null then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='day_statuses' and column_name='owner_id') then
      alter table public.day_statuses add column owner_id uuid;
    end if;
  end if;
end$$;

-- ── 4. Привилегии (GRANT) + Row Level Security ──────────────────────────────
-- ВАЖНО: в новых проектах Supabase (после ~мая 2025) по умолчанию нет прямого
-- GRANT на public-таблицы для ролей anon/authenticated — без этих строк
-- запросы из приложения вернут 403 "permission denied for table ..." даже
-- при корректных RLS-политиках. Повторное выполнение безопасно.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

alter table public.profiles         enable row level security;
alter table public.team_memberships enable row level security;
alter table public.tasks            enable row level security;
alter table public.assignments      enable row level security;
alter table public.day_statuses     enable row level security;

-- Небольшая функция-помощник: является ли вызывающий членом чьей-то команды.
create or replace function public.is_visible_to(viewer_id uuid, data_owner_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select viewer_id = data_owner_id
     or exists (
          select 1 from public.team_memberships tm
          where tm.manager_id = viewer_id and tm.employee_id = data_owner_id
        );
$$;

-- profiles: каждый видит себя; сотрудники видят профили своих руководителей
-- (нужно для отображения имён), руководители — всех в своей команде.
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_team_select" on public.profiles;
create policy "profiles_team_select" on public.profiles for select
  using (
    exists (select 1 from public.team_memberships tm
            where tm.employee_id = auth.uid() and tm.manager_id = profiles.id)
    or
    exists (select 1 from public.team_memberships tm
            where tm.manager_id = auth.uid() and tm.employee_id = profiles.id)
  );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- team_memberships: менеджер управляет своей командой.
drop policy if exists "team_manager_manage" on public.team_memberships;
create policy "team_manager_manage" on public.team_memberships for all
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());

drop policy if exists "team_employee_read" on public.team_memberships;
create policy "team_employee_read" on public.team_memberships for select
  using (employee_id = auth.uid());

-- tasks: владелец + его руководитель.
drop policy if exists "tasks_rw_own" on public.tasks;
create policy "tasks_rw_own" on public.tasks for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tasks_manager_read" on public.tasks;
create policy "tasks_manager_read" on public.tasks for select
  using (public.is_visible_to(auth.uid(), owner_id));

drop policy if exists "tasks_manager_insert_for_employee" on public.tasks;
create policy "tasks_manager_insert_for_employee" on public.tasks for insert
  with check (
    owner_id <> auth.uid() and
    exists (select 1 from public.team_memberships tm
            where tm.manager_id = auth.uid() and tm.employee_id = tasks.owner_id)
  );

-- assignments: те же правила, что у задач.
drop policy if exists "assignments_rw_own" on public.assignments;
create policy "assignments_rw_own" on public.assignments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "assignments_manager_read" on public.assignments;
create policy "assignments_manager_read" on public.assignments for select
  using (public.is_visible_to(auth.uid(), owner_id));

drop policy if exists "assignments_manager_write" on public.assignments;
create policy "assignments_manager_write" on public.assignments for insert
  with check (
    exists (select 1 from public.team_memberships tm
            where tm.manager_id = auth.uid() and tm.employee_id = assignments.owner_id)
  );

-- day_statuses: только владелец (график — личная зона сотрудника).
drop policy if exists "daystatuses_rw_own" on public.day_statuses;
create policy "daystatuses_rw_own" on public.day_statuses for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "daystatuses_manager_read" on public.day_statuses;
create policy "daystatuses_manager_read" on public.day_statuses for select
  using (public.is_visible_to(auth.uid(), owner_id));

-- ── 5. Назначение ролей и объединение аккаунтов (примеры) ──────────────────
-- Роли меняются простым UPDATE (может сделать руководитель из UI или вы здесь):
--   update public.profiles set role = 'manager'  where email = 'boss@company.com';
--   update public.profiles set role = 'employee' where email = 'dev@company.com';
-- Объединение аккаунтов (менеджер добавляет сотрудника в команду):
--   insert into public.team_memberships (manager_id, employee_id)
--   values ('<uuid менеджера>', '<uuid сотрудника>');
