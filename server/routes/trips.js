const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { awardBadges } = require('../lib/badges');

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

router.post('/', requireAuth, async (req, res) => {
  const { origin, destination, route_type, distance_km } = req.body;
  if (!origin || !destination || !route_type || !distance_km) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!(route_type in CO2_PER_KM)) {
    return res.status(400).json({ error: 'Invalid route_type' });
  }

  const co2_emitted_kg = parseFloat((distance_km * CO2_PER_KM[route_type]).toFixed(3));
  const co2_saved_kg = parseFloat((distance_km * CO2_PER_KM.drive - co2_emitted_kg).toFixed(3));
  const points_earned = Math.floor(co2_saved_kg * 10);

  const { data: trip, error: tripError } = await req.supabase
    .from('trips')
    .insert({ user_id: req.user.id, origin, destination, route_type, distance_km, co2_emitted_kg, co2_saved_kg, points_earned })
    .select()
    .single();
  if (tripError) return res.status(500).json({ error: tripError.message });

  // Update profile totals
  const { data: profile } = await req.supabase
    .from('profiles')
    .select('climate_points, co2_saved_kg')
    .eq('id', req.user.id)
    .single();

  const newPoints = (profile.climate_points || 0) + points_earned;
  const newCo2 = parseFloat(((profile.co2_saved_kg || 0) + co2_saved_kg).toFixed(3));

  await req.supabase
    .from('profiles')
    .update({ climate_points: newPoints, co2_saved_kg: newCo2 })
    .eq('id', req.user.id);

  const newBadges = await awardBadges(req.supabase, req.user.id);

  res.json({ trip, points_earned, new_total_points: newPoints, new_badges: newBadges });
});

module.exports = router;
