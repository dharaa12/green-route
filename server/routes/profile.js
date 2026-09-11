const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { awardBadges } = require('../lib/badges');

router.get('/', requireAuth, async (req, res) => {
  const { data: profile, error } = await req.supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'Profile not found' });

  // Self-healing: catch up any badges earned since the last trip/friend action.
  await awardBadges(req.supabase, req.user.id).catch(() => {});

  const [{ data: allBadges }, { data: userBadges }] = await Promise.all([
    req.supabase.from('badges').select('*').order('threshold_value', { ascending: true }),
    req.supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', req.user.id),
  ]);
  const earned = new Map((userBadges || []).map(u => [u.badge_id, u.earned_at]));
  const badges = (allBadges || []).map(b => ({
    ...b,
    earned: earned.has(b.id),
    earned_at: earned.get(b.id) || null,
  }));

  res.json({ ...profile, badges });
});

module.exports = router;
