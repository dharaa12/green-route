-- Run in Supabase Dashboard → SQL Editor. Re-runnable.
-- Adds map + display fields to marketplace_items and reseeds the partner catalog
-- with locations spread across the city.

alter table marketplace_items add column if not exists lat float;
alter table marketplace_items add column if not exists lng float;
alter table marketplace_items add column if not exists value_usd text;
alter table marketplace_items add column if not exists color text;

alter table redemptions drop constraint if exists redemptions_item_id_fkey;
alter table redemptions add constraint redemptions_item_id_fkey
  foreign key (item_id) references marketplace_items(id) on delete set null;

delete from marketplace_items;

insert into marketplace_items
  (name, description, partner_name, points_cost, category, value_usd, color, lat, lng) values
  ('15% off any salad',       'Show at checkout for 15% off any salad or warm bowl.',        'Sweetgreen',          5,  'food',     '$4–$7',  '#22c55e', 40.7411, -73.9897),
  ('Free drip coffee',        'One free 12oz drip coffee, any NYC location.',                'Blue Bottle Coffee',  6,  'food',     '$5',     '#f97316', 40.7222, -73.9954),
  ('Free matcha or tea',      'Any hot or iced matcha, kombucha, or tea.',                   'MatchaBar',           4,  'food',     '$5',     '#16a34a', 40.7440, -74.0010),
  ('Free pastry with coffee', 'Any pastry when you buy a coffee.',                           'La Colombe',          4,  'food',     '$4',     '#a16207', 40.7195, -74.0089),
  ('$2 off any pour-over',    '$2 off single-origin pour-over coffee.',                      'Devoción',            5,  'food',     '$3',     '#7c2d12', 40.7185, -73.9590),
  ('$2.90 ride credit',       'One free subway or bus ride on your OMNY account.',           'MTA',                 3,  'transit',  '$2.90',  '#0ea5e9', 40.7560, -73.9865),
  ('1 free day pass',         'A complimentary 24-hour Citi Bike day pass.',                 'Citi Bike',           8,  'transit',  '$19',    '#2563eb', 40.7180, -73.9570),
  ('10% off groceries',       '10% off your next grocery run, up to $15 off.',               'Whole Foods Market',  10, 'retail',   '$8+',    '#7c3aed', 40.7690, -73.9820),
  ('10% off sustainable goods','10% off everything, zero-waste refills included.',           'Package Free Shop',   9,  'retail',   '$6+',    '#9333ea', 40.7145, -73.9425),
  ('Free drop-in class',      'One complimentary drop-in yoga or sculpt class.',             'CorePower Yoga',      12, 'wellness', '$25',    '#db2777', 40.7730, -73.9560),
  ('$10 off a massage',       '$10 off any 60-minute in-home session.',                      'Zeel',                11, 'wellness', '$10',    '#e11d48', 40.7540, -73.9700),
  ('Free class pass',         'One free group fitness class at any Brooklyn location.',       'Equinox',             13, 'wellness', '$40',    '#be185d', 40.6785, -73.9760);
