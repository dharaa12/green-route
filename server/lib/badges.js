// Badge engine — recomputes a user's stats from the DB and awards any newly
// earned badges. Safe to call from anywhere (trip logged, friend added, signup).

function longestDailyStreak(dates) {
  const days = [...new Set(dates.map(d => new Date(d).toISOString().slice(0, 10)))].sort();
  let best = 0, run = 0, prev = null;
  for (const day of days) {
    run = prev && Date.parse(day) - Date.parse(prev) === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

async function computeStats(supabase, userId) {
  const [{ data: profile }, { data: trips }, { count: friends }] = await Promise.all([
    supabase.from('profiles').select('climate_points, co2_saved_kg').eq('id', userId).single(),
    supabase.from('trips').select('route_type, distance_km, taken_at').eq('user_id', userId),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  const t = trips || [];
  return {
    points: profile?.climate_points || 0,
    co2_kg: profile?.co2_saved_kg || 0,
    green_trips: t.filter(x => x.route_type !== 'drive').length,
    bike_km: t.filter(x => x.route_type === 'bike').reduce((s, x) => s + (x.distance_km || 0), 0),
    subway_streak: longestDailyStreak(t.filter(x => x.route_type === 'transit').map(x => x.taken_at)),
    friends: friends || 0,
  };
}

function qualifies(badge, s) {
  switch (badge.threshold_type) {
    case 'signup':        return true;
    case 'points':        return s.points >= badge.threshold_value;
    case 'co2':           return s.co2_kg >= badge.threshold_value;
    case 'trips':         // legacy alias
    case 'green_trips':   return s.green_trips >= badge.threshold_value;
    case 'bike_km':       return s.bike_km >= badge.threshold_value;
    case 'subway_streak': return s.subway_streak >= badge.threshold_value;
    case 'friends':       return s.friends >= badge.threshold_value;
    default:              return false;
  }
}

async function awardBadges(supabase, userId) {
  const [stats, { data: allBadges }, { data: earned }] = await Promise.all([
    computeStats(supabase, userId),
    supabase.from('badges').select('*'),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ]);
  const have = new Set((earned || []).map(e => e.badge_id));
  const toAward = (allBadges || []).filter(b => !have.has(b.id) && qualifies(b, stats));
  if (toAward.length) {
    await supabase.from('user_badges').insert(toAward.map(b => ({ user_id: userId, badge_id: b.id })));
  }
  return toAward;
}

module.exports = { awardBadges };
