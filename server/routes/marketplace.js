const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('marketplace_items')
    .select('*')
    .eq('active', true)
    .order('points_cost', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/redeem', requireAuth, async (req, res) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  const { data: item, error: itemError } = await req.supabase
    .from('marketplace_items')
    .select('*')
    .eq('id', item_id)
    .eq('active', true)
    .single();
  if (itemError || !item) return res.status(404).json({ error: 'Item not found' });

  const { data: profile } = await req.supabase
    .from('profiles')
    .select('climate_points')
    .eq('id', req.user.id)
    .single();

  if ((profile.climate_points || 0) < item.points_cost) {
    return res.status(400).json({ error: 'Not enough climate points' });
  }

  const { error: redeemError } = await req.supabase
    .from('redemptions')
    .insert({ user_id: req.user.id, item_id });
  if (redeemError) return res.status(500).json({ error: redeemError.message });

  const newPoints = profile.climate_points - item.points_cost;
  await req.supabase
    .from('profiles')
    .update({ climate_points: newPoints })
    .eq('id', req.user.id);

  res.json({ success: true, points_spent: item.points_cost, new_total_points: newPoints });
});

module.exports = router;
