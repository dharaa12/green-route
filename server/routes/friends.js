const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.post('/add', requireAuth, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  const { data: friend } = await req.supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();
  if (!friend) return res.status(404).json({ error: 'User not found' });
  if (friend.id === req.user.id) return res.status(400).json({ error: "Can't add yourself" });

  const { error } = await req.supabase
    .from('friendships')
    .insert({ user_id: req.user.id, friend_id: friend.id });

  if (error?.code === '23505') return res.status(400).json({ error: 'Already friends' });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, friend });
});

module.exports = router;
