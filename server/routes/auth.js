const express = require('express');
const router = express.Router();
const { supabaseAdmin, anonClient } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password, and username are required' });
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) return res.status(400).json({ error: 'Username already taken' });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return res.status(400).json({ error: error.message });

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: data.user.id,
    username,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ error: profileError.message });
  }

  const { data: session, error: signInError } = await anonClient().auth.signInWithPassword({ email, password });
  if (signInError) return res.status(500).json({ error: signInError.message });

  res.json({ user: data.user, session: session.session, profile: { id: data.user.id, username } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({ user: data.user, session: data.session, profile });
});

module.exports = router;
