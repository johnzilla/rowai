-- user_profile: one row per authenticated user
create table public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  onboarding_complete boolean not null default false,
  coaching_tone text not null default 'calm_supportive',
  experience_level text,
  injuries_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: every user sees and writes only their own row
alter table public.user_profile enable row level security;

create policy "Users can read own profile"
  on public.user_profile for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profile for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profile for update
  using (auth.uid() = id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_user_profile_updated_at
  before update on public.user_profile
  for each row execute function public.set_updated_at();
