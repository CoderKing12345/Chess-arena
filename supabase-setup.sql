-- Optional profile table for future persistent player profiles.
-- The current static starter uses Supabase Auth user metadata and browser-local statistics.
-- Safe to run in Supabase SQL Editor if you want a profile table ready for later expansion.

create table if not exists public.chess_arena_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chess_arena_profiles enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.chess_arena_profiles;
create policy "Profiles are readable by everyone"
on public.chess_arena_profiles for select
using (true);

drop policy if exists "Users can insert their own profile" on public.chess_arena_profiles;
create policy "Users can insert their own profile"
on public.chess_arena_profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.chess_arena_profiles;
create policy "Users can update their own profile"
on public.chess_arena_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists chess_arena_profiles_username_idx
on public.chess_arena_profiles (username);
