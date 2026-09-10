-- Run this in Supabase Dashboard → SQL Editor

create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  climate_points integer default 0,
  co2_saved_kg float default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Trips
create table if not exists trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  origin text not null,
  destination text not null,
  route_type text not null check (route_type in ('drive', 'transit', 'bike')),
  distance_km float not null,
  co2_emitted_kg float not null,
  co2_saved_kg float not null,
  points_earned integer not null,
  taken_at timestamptz default now()
);

alter table trips enable row level security;
create policy "Users read own trips" on trips for select using (auth.uid() = user_id);
create policy "Users insert own trips" on trips for insert with check (auth.uid() = user_id);

-- Badges
create table if not exists badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  icon text,
  threshold_type text check (threshold_type in ('trips', 'co2', 'points')),
  threshold_value float
);

alter table badges enable row level security;
create policy "Anyone reads badges" on badges for select using (true);

-- User badges
create table if not exists user_badges (
  user_id uuid references profiles(id) on delete cascade,
  badge_id uuid references badges(id) on delete cascade,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);

alter table user_badges enable row level security;
create policy "Users read own badges" on user_badges for select using (auth.uid() = user_id);
create policy "Service inserts badges" on user_badges for insert with check (true);

-- Marketplace
create table if not exists marketplace_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  partner_name text not null,
  points_cost integer not null,
  category text,
  image_url text,
  active boolean default true
);

alter table marketplace_items enable row level security;
create policy "Anyone reads marketplace" on marketplace_items for select using (active = true);

-- Redemptions
create table if not exists redemptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  item_id uuid references marketplace_items(id),
  redeemed_at timestamptz default now()
);

alter table redemptions enable row level security;
create policy "Users read own redemptions" on redemptions for select using (auth.uid() = user_id);
create policy "Users insert own redemptions" on redemptions for insert with check (auth.uid() = user_id);

-- Friendships
create table if not exists friendships (
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);

alter table friendships enable row level security;
create policy "Users read own friendships" on friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users insert own friendships" on friendships
  for insert with check (auth.uid() = user_id);

-- Seed badges
insert into badges (name, description, icon, threshold_type, threshold_value) values
  ('First Step',      'Completed your first green trip',  '🌱', 'trips',  1),
  ('Green Streak',    'Completed 10 green trips',         '🌿', 'trips',  10),
  ('Eco Warrior',     'Completed 50 green trips',         '🌳', 'trips',  50),
  ('CO2 Saver',       'Saved 10 kg of CO2',               '💨', 'co2',    10),
  ('Climate Hero',    'Saved 100 kg of CO2',              '🌍', 'co2',    100),
  ('Point Collector', 'Earned 100 climate points',        '⭐', 'points', 100),
  ('Point Master',    'Earned 500 climate points',        '🏆', 'points', 500)
on conflict do nothing;

-- Seed marketplace items
insert into marketplace_items (name, description, partner_name, points_cost, category) values
  ('Free Coffee',      'Get a free drip coffee',           'Blue Bottle Coffee',  50,  'food'),
  ('10% Off Groceries','10% off your next purchase',       'Whole Foods Market',  75,  'grocery'),
  ('Free Smoothie',    'Any smoothie of your choice',      'Juice Press',         60,  'food'),
  ('Free Bike Rental', '1 hour Citi Bike rental',          'Citi Bike',           40,  'transport'),
  ('$5 Off Order',     '$5 off orders over $20',           'Sweetgreen',          45,  'food'),
  ('Free Pastry',      'Any pastry with coffee purchase',  'La Colombe',          35,  'food'),
  ('10% Off Products', '10% off sustainable products',     'Package Free Shop',   80,  'shopping'),
  ('Free Drink',       'Free kombucha or tea',             'MatchaBar',           30,  'food')
on conflict do nothing;
