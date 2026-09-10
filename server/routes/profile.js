const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { data: profile, error } = await req.supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'Profile not found' });

  const { data: userBadges } = await req.supabase
    .from('user_badges')
    .select('earned_at, badges(*)')
    .eq('user_id', req.user.id);

  res.json({ ...profile, badges: userBadges?.map(ub => ({ ...ub.badges, earned_at: ub.earned_at })) || [] });
});

module.exports = router;
