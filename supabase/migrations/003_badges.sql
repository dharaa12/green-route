-- Run in Supabase Dashboard → SQL Editor. Re-runnable.
-- Final badge set: the original seven plus Social Butterfly.

alter table badges add column if not exists color text;
alter table badges drop constraint if exists badges_threshold_type_check;
create unique index if not exists badges_name_key on badges (name);

delete from badges where name in (
  'Green Commuter', 'Subway Streak', 'Bike Hero', 'Tree Planter',
  'Carbon Crusher', 'Early Adopter', 'Century Saver'
);

insert into badges (name, description, icon, color, threshold_type, threshold_value) values
  ('First Step',       'Completed your first green trip', '🌱', null,      'green_trips', 1),
  ('Green Streak',     'Completed 10 green trips',        '🌿', null,      'green_trips', 10),
  ('Eco Warrior',      'Completed 50 green trips',        '🌳', null,      'green_trips', 50),
  ('CO2 Saver',        'Saved 10 kg of CO₂',              '💨', null,      'co2',         10),
  ('Climate Hero',     'Saved 100 kg of CO₂',             '🌍', null,      'co2',         100),
  ('Point Collector',  'Earned 100 climate points',       '⭐', null,      'points',      100),
  ('Point Master',     'Earned 500 climate points',       '🏆', null,      'points',      500),
  ('Social Butterfly', 'Has 5+ friends on GreenRoute',    '🦋', '#0ea5e9', 'friends',     5)
on conflict (name) do update set
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  threshold_type = excluded.threshold_type,
  threshold_value = excluded.threshold_value;
