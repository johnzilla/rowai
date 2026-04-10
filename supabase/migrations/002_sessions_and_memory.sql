-- sessions table (POST-02)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null,
  total_meters numeric(8,1) not null,
  avg_split_ms integer,
  avg_watts integer,
  avg_stroke_rate numeric(4,1),
  energy_level integer,
  session_type text,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;
create policy "Users can read own sessions"
  on public.sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);

-- coach_memory table (POST-03 writes only, Phase 3 reads)
create table public.coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.coach_memory enable row level security;
create policy "Users can read own memory"
  on public.coach_memory for select using (auth.uid() = user_id);
create policy "Users can upsert own memory"
  on public.coach_memory for insert with check (auth.uid() = user_id);
create policy "Users can update own memory"
  on public.coach_memory for update using (auth.uid() = user_id);
