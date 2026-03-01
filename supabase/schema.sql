create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

drop policy if exists "read own app state" on public.user_app_state;
create policy "read own app state"
on public.user_app_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own app state" on public.user_app_state;
create policy "insert own app state"
on public.user_app_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own app state" on public.user_app_state;
create policy "update own app state"
on public.user_app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_user_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_app_state_updated_at on public.user_app_state;
create trigger trg_touch_user_app_state_updated_at
before update on public.user_app_state
for each row
execute function public.touch_user_app_state_updated_at();
