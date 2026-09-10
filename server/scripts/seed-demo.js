/*
 * Seeds demo users with trip history, points, badges, and friendships so the
 * leaderboard / profile look populated. Idempotent — re-running wipes and
 * rebuilds the demo accounts (email domain @demo.greenroute).
 *
 *   node server/scripts/seed-demo.js                 # just the demo users
 *   node server/scripts/seed-demo.js --friend <name> # also befriend an existing user
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CO2_PER_KM = { drive: 0.21, transit: 0.089, bike: 0.0 };
const DEMO_DOMAIN = 'demo.greenroute';

const PEOPLE = [
  { username: 'sam_chen',      name: 'Sam Chen' },
  { username: 'quinn_torres',  name: 'Quinn Torres' },
  { username: 'casey_park',    name: 'Casey Park' },
  { username: 'jordan_kim',    name: 'Jordan Kim' },
  { username: 'morgan_lee',    name: 'Morgan Lee' },
  { username: 'riley_zhang',   name: 'Riley Zhang' },
  { username: 'avery_johnson', name: 'Avery Johnson' },
  { username: 'devon_wright',  name: 'Devon Wright' },
  { username: 'harper_diaz',   name: 'Harper Diaz' },
  { username: 'noah_bennett',  name: 'Noah Bennett' },
];

const PLACES = [
  'Astoria, Queens', 'Williamsburg, Brooklyn', 'Harlem', 'Upper West Side',
  'Financial District', 'Midtown Manhattan', 'Long Island City', 'Park Slope',
  'Bushwick', 'Chelsea', 'East Village', 'Downtown Brooklyn', 'Sunnyside',
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const round3 = n => Math.round(n * 1000) / 1000;

function makeTrip(userId, { mode, daysAgo } = {}) {
  mode = mode || pick(['bike', 'transit', 'transit', 'transit', 'bike', 'drive']);
  const distance_km = round3(mode === 'bike' ? rand(3, 18) : rand(1.5, 16));
  const co2_emitted_kg = round3(distance_km * CO2_PER_KM[mode]);
  const co2_saved_kg = Math.max(0, round3(distance_km * CO2_PER_KM.drive - co2_emitted_kg));
  const points_earned = Math.max(0, Math.floor(co2_saved_kg * 10));
  let o = pick(PLACES), d = pick(PLACES);
  while (d === o) d = pick(PLACES);
  const ago = daysAgo == null ? Math.floor(rand(0, 26)) : daysAgo;
  const taken_at = new Date(Date.now() - ago * 864e5 - rand(0, 12) * 36e5).toISOString();
  return { user_id: userId, origin: o, destination: d, route_type: mode,
    distance_km, co2_emitted_kg, co2_saved_kg, points_earned, taken_at };
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find(u => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function upsertUser(person) {
  const email = `${person.username}@${DEMO_DOMAIN}`;
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: `demo-${person.username}-pw`, email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  await sb.from('profiles').upsert({ id: user.id, username: person.username });
  await sb.from('trips').delete().eq('user_id', user.id);
  await sb.from('user_badges').delete().eq('user_id', user.id);
  return user.id;
}

async function seedTrips(userId, { power }) {
  const trips = Array.from({ length: Math.floor(power ? rand(22, 34) : rand(6, 16)) }, () => makeTrip(userId));
  // Power users also get a genuine 7-day transit streak.
  if (power) {
    for (let d = 1; d <= 7; d++) trips.push(makeTrip(userId, { mode: 'transit', daysAgo: d }));
  }
  await sb.from('trips').insert(trips);

  const totalPoints = trips.reduce((s, t) => s + t.points_earned, 0);
  const totalCo2 = round3(trips.reduce((s, t) => s + t.co2_saved_kg, 0));
  await sb.from('profiles').update({ climate_points: totalPoints, co2_saved_kg: totalCo2 }).eq('id', userId);

  return { totalPoints, totalCo2 };
}

async function befriend(a, b) {
  await sb.from('friendships').upsert([
    { user_id: a, friend_id: b }, { user_id: b, friend_id: a },
  ]);
}

(async () => {
  const friendArg = process.argv.indexOf('--friend');
  const friendUsername = friendArg > -1 ? process.argv[friendArg + 1] : null;

  const ids = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const id = await upsertUser(p);
    const { totalPoints, totalCo2 } = await seedTrips(id, { power: i < 5 });
    ids.push(id);
    console.log(`  ${p.username.padEnd(16)} ${String(totalPoints).padStart(4)} pts  ${totalCo2.toFixed(1)} kg`);
  }

  // each demo user gets 5-6 demo friends (enough for Social Butterfly)
  for (const id of ids) {
    const others = ids.filter(x => x !== id).sort(() => Math.random() - 0.5).slice(0, 5 + Math.round(Math.random()));
    for (const o of others) await befriend(id, o);
  }

  if (friendUsername) {
    const { data: target } = await sb.from('profiles').select('id').eq('username', friendUsername).maybeSingle();
    if (target) {
      for (const id of ids.slice(0, 6)) await befriend(target.id, id);
      console.log(`\nBefriended ${friendUsername} with 6 demo users.`);
    } else {
      console.log(`\n--friend: no user "${friendUsername}" found, skipped.`);
    }
  }

  // award badges once everything (trips + friendships) is in place
  const { awardBadges } = require('../lib/badges');
  for (const id of ids) await awardBadges(sb, id);

  console.log(`\nDone. ${PEOPLE.length} demo users seeded.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
