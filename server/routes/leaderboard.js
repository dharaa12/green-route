const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const SELECT = 'id, username, avatar_url, climate_points, co2_saved_kg, user_badges(badges(icon))';

function rank(rows) {
  return rows.map((p, i) => {
    const { user_badges, ...rest } = p;
    return {
      ...rest,
      rank: i + 1,
      badge_icons: (user_badges || []).map(ub => ub.badges?.icon).filter(Boolean),
    };
  });
}

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('profiles')
    .select(SELECT)
    .order('co2_saved_kg', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(rank(data));
});

router.get('/friends', requireAuth, async (req, res) => {
  const { data: friendships } = await req.supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', req.user.id);

  const ids = [...(friendships?.map(f => f.friend_id) || []), req.user.id];

  const { data, error } = await req.supabase
    .from('profiles')
    .select(SELECT)
    .in('id', ids)
    .order('co2_saved_kg', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(rank(data));
});

module.exports = router;
