const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('profiles')
    .select('id, username, avatar_url, climate_points, co2_saved_kg')
    .order('climate_points', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });

  const ranked = data.map((p, i) => ({ ...p, rank: i + 1 }));
  res.json(ranked);
});

router.get('/friends', requireAuth, async (req, res) => {
  const { data: friendships } = await req.supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', req.user.id);

  const friendIds = friendships?.map(f => f.friend_id) || [];
  // Include self
  const ids = [...friendIds, req.user.id];

  const { data, error } = await req.supabase
    .from('profiles')
    .select('id, username, avatar_url, climate_points, co2_saved_kg')
    .in('id', ids)
    .order('climate_points', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ranked = data.map((p, i) => ({ ...p, rank: i + 1 }));
  res.json(ranked);
});

module.exports = router;
