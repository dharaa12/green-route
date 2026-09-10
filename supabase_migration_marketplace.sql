-- Run in Supabase Dashboard → SQL Editor.
-- Adds map coordinates + display fields to marketplace_items and reseeds the
-- partner catalog. Safe to re-run.

alter table marketplace_items add column if not exists lat float;
alter table marketplace_items add column if not exists lng float;
alter table marketplace_items add column if not exists value_usd text;
alter table marketplace_items add column if not exists color text;

-- Let redemptions survive a catalog refresh.
alter table redemptions drop constraint if exists redemptions_item_id_fkey;
alter table redemptions add constraint redemptions_item_id_fkey
  foreign key (item_id) references marketplace_items(id) on delete set null;

delete from marketplace_items;

insert into marketplace_items
  (name, description, partner_name, points_cost, category, value_usd, color, lat, lng) values
  ('15% off any salad',      'Show this coupon at checkout for 15% off any salad or warm bowl.', 'Sweetgreen',          5,  'food',     '$4–$7',  '#22c55e', 40.7411, -73.9897),
  ('Free drip coffee',       'One free 12oz drip coffee, any location.',                          'Blue Bottle Coffee',  6,  'food',     '$5',     '#f97316', 40.7220, -73.9977),
  ('Free matcha or tea',     'Any hot or iced matcha, kombucha, or tea.',                         'MatchaBar',           4,  'food',     '$5',     '#16a34a', 40.7295, -73.9880),
  ('Free pastry with coffee','Any pastry when you buy a coffee.',                                 'La Colombe',          4,  'food',     '$4',     '#a16207', 40.7205, -74.0050),
  ('1 free day pass',        'Redeem for a complimentary 24-hour Citi Bike day pass.',            'Citi Bike',           8,  'transit',  '$19',    '#2563eb', 40.7295, -73.9965),
  ('$2.90 ride credit',      'One free subway or bus ride loaded to your OMNY account.',          'MTA',                 3,  'transit',  '$2.90',  '#0ea5e9', 40.7527, -73.9772),
  ('10% off groceries',      '10% off your next grocery purchase, up to $15 off.',                'Whole Foods Market',  10, 'retail',   '$8+',    '#7c3aed', 40.7419, -74.0009),
  ('10% off sustainable goods','10% off everything in store, zero-waste refills included.',       'Package Free Shop',   9,  'retail',   '$6+',    '#9333ea', 40.7248, -73.9971),
  ('Free drop-in class',     'One complimentary drop-in yoga or sculpt class.',                   'CorePower Yoga',      12, 'wellness', '$25',    '#db2777', 40.7358, -73.9911),
  ('$10 off a massage',      '$10 off any 60-minute session.',                                    'Zeel',                11, 'wellness', '$10',    '#e11d48', 40.7380, -73.9855);
