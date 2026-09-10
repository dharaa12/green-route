-- Run in Supabase Dashboard → SQL Editor. Non-destructive & re-runnable.
-- Keeps existing badges, adds new ones, backfills colours + threshold types.

alter table badges add column if not exists color text;
alter table badges drop constraint if exists badges_threshold_type_check;
create unique index if not exists badges_name_key on badges (name);

insert into badges (name, description, icon, color, threshold_type, threshold_value) values
  ('First Step',       'Completed your first green trip', '🌱', '#16a34a', 'green_trips',    1),
  ('Green Streak',     'Completed 10 green trips',        '🌿', '#16a34a', 'green_trips',    10),
  ('Green Commuter',   'Took 20+ eco-friendly trips',     '🚈', '#2563eb', 'green_trips',    20),
  ('Eco Warrior',      'Completed 50 green trips',        '🌳', '#15803d', 'green_trips',    50),
  ('Subway Streak',    'Rode transit 7 days in a row',    '⚡', '#d97706', 'subway_streak',  7),
  ('Bike Hero',        'Biked over 50 miles total',       '🚲', '#7c3aed', 'bike_km',        80.47),
  ('CO2 Saver',        'Saved 10 kg of CO₂',              '💨', '#0ea5e9', 'co2',            10),
  ('Tree Planter',     'Saved a tree-year of CO₂',        '🌳', '#16a34a', 'co2',            21),
  ('Climate Hero',     'Saved 100 kg of CO₂',             '🌍', '#0284c7', 'co2',            100),
  ('Carbon Crusher',   'Saved 500+ lbs of CO₂',           '💪', '#dc2626', 'co2',            226.8),
  ('Early Adopter',    'Joined GreenRoute early',         '🌱', '#16a34a', 'signup',         0),
  ('Point Collector',  'Earned 100 climate points',       '⭐', '#ca8a04', 'points',         100),
  ('Point Master',     'Earned 500 climate points',       '🏆', '#ca8a04', 'points',         500),
  ('Social Butterfly', 'Has 5+ friends on GreenRoute',    '🦋', '#0ea5e9', 'friends',        5)
on conflict (name) do update set
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  threshold_type = excluded.threshold_type,
  threshold_value = excluded.threshold_value;
