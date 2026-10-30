const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { awardBadges } = require('../lib/badges');
const { TripError, planTrip, verifyFinish, signToken, rewardFor } = require('../lib/tripVerification');

const CO2_PER_KM = { drive: 0.21, transit: 0.089, bike: 0.0 };

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('trips')
    .select('*')
    .eq('user_id', req.user.id)
    .order('taken_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Store a trip, add its points to the profile, and re-evaluate badges.
async function recordTrip(supabase, userId, trip) {
  const { data: row, error: tripError } = await supabase
    .from('trips')
    .insert({ user_id: userId, ...trip })
    .select()
    .single();
  if (tripError) throw tripError;

  const { data: profile } = await supabase
    .from('profiles')
    .select('climate_points, co2_saved_kg')
    .eq('id', userId)
    .single();

  const newPoints = (profile.climate_points || 0) + trip.points_earned;
  const newCo2 = parseFloat(((profile.co2_saved_kg || 0) + trip.co2_saved_kg).toFixed(3));

  await supabase
    .from('profiles')
    .update({ climate_points: newPoints, co2_saved_kg: newCo2 })
    .eq('id', userId);

  const newBadges = await awardBadges(supabase, userId);
  return { trip: row, points_earned: trip.points_earned, new_total_points: newPoints, new_badges: newBadges };
}

function sendError(res, err) {
  if (err instanceof TripError) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: err.message });
}

// Driving earns nothing, so it can still be logged on the client's word. Bike
// and transit trips earn points and must go through /start and /complete.
router.post('/', requireAuth, async (req, res) => {
  const { origin, destination, route_type, distance_km } = req.body;
  if (!origin || !destination || !route_type || !distance_km) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (route_type !== 'drive') {
    return res.status(400).json({ error: 'Start bike and transit trips from the map to earn points' });
  }

  const co2_emitted_kg = parseFloat((distance_km * CO2_PER_KM.drive).toFixed(3));
  try {
    res.json(await recordTrip(req.supabase, req.user.id, {
      origin, destination, route_type, distance_km, co2_emitted_kg, co2_saved_kg: 0, points_earned: 0,
    }));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/start', requireAuth, (req, res) => {
  try {
    const plan = planTrip(req.body, req.user.id);
    res.json({ trip_token: signToken(plan), started_at: plan.t0 });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/complete', requireAuth, async (req, res) => {
  try {
    const trip = verifyFinish(req.body.trip_token, req.body.position, req.user.id);
    const reward = rewardFor(trip);
    res.json(await recordTrip(req.supabase, req.user.id, {
      origin: trip.origin,
      destination: trip.destination,
      route_type: trip.mode,
      distance_km: trip.km,
      session_id: trip.sid,
      ...reward,
    }));
  } catch (err) {
    // The unique index on session_id means a start token can only be redeemed once.
    if (err.code === '23505') return res.status(409).json({ error: 'This trip was already logged' });
    sendError(res, err);
  }
});

module.exports = router;
