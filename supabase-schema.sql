-- Nourish: Supabase schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Profiles (auto-created on sign-up via trigger)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text default '',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Recipes (shared library – everyone can read, owner can edit/delete)
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  servings int default 1,
  ingredients jsonb default '[]'::jsonb,
  instructions text default '',
  macros jsonb default null,
  macro_source text default 'manual' check (macro_source in ('card', 'calculated', 'manual')),
  notes text default '',
  photo_url text default null,
  last_edited timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.recipes enable row level security;

create policy "Anyone can view recipes"
  on public.recipes for select using (true);

create policy "Authenticated users can insert recipes"
  on public.recipes for insert with check (auth.uid() = created_by);

create policy "Recipe owner can update"
  on public.recipes for update using (auth.uid() = created_by);

create policy "Recipe owner can delete"
  on public.recipes for delete using (auth.uid() = created_by);

-- 3. Favorites (per user)
create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, recipe_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
  on public.favorites for select using (auth.uid() = user_id);

create policy "Users can add favorites"
  on public.favorites for insert with check (auth.uid() = user_id);

create policy "Users can remove favorites"
  on public.favorites for delete using (auth.uid() = user_id);

-- 4. Goals (per user)
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  calories int default 2000,
  protein int default 120,
  carbs int default 200,
  fat int default 65,
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Users can view their own goals"
  on public.goals for select using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.goals for insert with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.goals for update using (auth.uid() = user_id);

-- 5. Meal plans (per user, keyed by week)
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_key text not null,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique(user_id, week_key)
);

alter table public.meal_plans enable row level security;

create policy "Users can view their own plans"
  on public.meal_plans for select using (auth.uid() = user_id);

create policy "Users can insert their own plans"
  on public.meal_plans for insert with check (auth.uid() = user_id);

create policy "Users can update their own plans"
  on public.meal_plans for update using (auth.uid() = user_id);

-- 6. Daily log (per user)
create table public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date_key text not null,
  meals_checked jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date_key)
);

alter table public.daily_logs enable row level security;

create policy "Users can view their own logs"
  on public.daily_logs for select using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.daily_logs for insert with check (auth.uid() = user_id);

create policy "Users can update their own logs"
  on public.daily_logs for update using (auth.uid() = user_id);
