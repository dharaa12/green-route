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
  color text,
  threshold_type text,
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
  value_usd text,
  color text,
  lat float,
  lng float,
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

-- keep redemptions when a catalog item is removed
alter table redemptions drop constraint if exists redemptions_item_id_fkey;
alter table redemptions add constraint redemptions_item_id_fkey
  foreign key (item_id) references marketplace_items(id) on delete set null;

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
insert into badges (name, description, icon, color, threshold_type, threshold_value) values
  ('First Step',       'Completed your first green trip', '🌱', null,      'green_trips', 1),
  ('Green Streak',     'Completed 10 green trips',        '🌿', null,      'green_trips', 10),
  ('Eco Warrior',      'Completed 50 green trips',        '🌳', null,      'green_trips', 50),
  ('CO2 Saver',        'Saved 10 kg of CO₂',              '💨', null,      'co2',         10),
  ('Climate Hero',     'Saved 100 kg of CO₂',             '🌍', null,      'co2',         100),
  ('Point Collector',  'Earned 100 climate points',       '⭐', null,      'points',      100),
  ('Point Master',     'Earned 500 climate points',       '🏆', null,      'points',      500),
  ('Social Butterfly', 'Has 5+ friends on GreenRoute',    '🦋', '#0ea5e9', 'friends',     5)
on conflict do nothing;

-- Seed marketplace items
insert into marketplace_items
  (name, description, partner_name, points_cost, category, value_usd, color, lat, lng) values
  ('15% off any salad',        'Show at checkout for 15% off any salad or warm bowl.',  'Sweetgreen',          5,  'food',     '$4-$7',  '#22c55e', 40.7411, -73.9897),
  ('Free drip coffee',         'One free 12oz drip coffee, any NYC location.',          'Blue Bottle Coffee',  6,  'food',     '$5',     '#f97316', 40.7222, -73.9954),
  ('Free matcha or tea',       'Any hot or iced matcha, kombucha, or tea.',             'MatchaBar',           4,  'food',     '$5',     '#16a34a', 40.7440, -74.0010),
  ('Free pastry with coffee',  'Any pastry when you buy a coffee.',                     'La Colombe',          4,  'food',     '$4',     '#a16207', 40.7195, -74.0089),
  ('$2 off any pour-over',     '$2 off single-origin pour-over coffee.',                'Devocion',            5,  'food',     '$3',     '#7c2d12', 40.7185, -73.9590),
  ('$2.90 ride credit',        'One free subway or bus ride on your OMNY account.',     'MTA',                 3,  'transit',  '$2.90',  '#0ea5e9', 40.7560, -73.9865),
  ('1 free day pass',          'A complimentary 24-hour Citi Bike day pass.',           'Citi Bike',           8,  'transit',  '$19',    '#2563eb', 40.7180, -73.9570),
  ('10% off groceries',        '10% off your next grocery run, up to $15 off.',         'Whole Foods Market',  10, 'retail',   '$8+',    '#7c3aed', 40.7690, -73.9820),
  ('10% off sustainable goods','10% off everything, zero-waste refills included.',      'Package Free Shop',   9,  'retail',   '$6+',    '#9333ea', 40.7145, -73.9425),
  ('Free drop-in class',       'One complimentary drop-in yoga or sculpt class.',       'CorePower Yoga',      12, 'wellness', '$25',    '#db2777', 40.7730, -73.9560),
  ('$10 off a massage',        '$10 off any 60-minute in-home session.',                'Zeel',                11, 'wellness', '$10',    '#e11d48', 40.7540, -73.9700),
  ('Free class pass',          'One free group fitness class at any Brooklyn location.', 'Equinox',             13, 'wellness', '$40',    '#be185d', 40.6785, -73.9760)
on conflict do nothing;
