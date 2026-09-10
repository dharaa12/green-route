-- Run in Supabase Dashboard → SQL Editor.
-- Replaces the badge catalog with the fuller set and new threshold types.
-- Deleting badges cascades to user_badges; the badge engine re-awards them.

alter table badges add column if not exists color text;
alter table badges drop constraint if exists badges_threshold_type_check;

delete from badges;

insert into badges (name, description, icon, color, threshold_type, threshold_value) values
  ('Early Adopter',    'Joined GreenRoute early',        '🌱', '#16a34a', 'signup',        0),
  ('Green Commuter',   'Took 20+ eco-friendly trips',    '🚈', '#2563eb', 'green_trips',   20),
  ('Subway Streak',    'Rode transit 7 days in a row',   '⚡', '#d97706', 'subway_streak', 7),
  ('Bike Hero',        'Biked over 50 miles total',      '🚲', '#7c3aed', 'bike_km',       80.47),
  ('Carbon Crusher',   'Saved 500+ lbs of CO₂',          '💪', '#dc2626', 'co2',           226.8),
  ('Tree Planter',     'Saved a tree-year of CO₂',       '🌳', '#16a34a', 'co2',           21),
  ('Century Saver',    'Earned 100 climate points',      '💯', '#dc2626', 'points',        100),
  ('Social Butterfly', 'Has 5+ friends on GreenRoute',   '🦋', '#0ea5e9', 'friends',       5);
