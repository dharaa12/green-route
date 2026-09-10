const { createClient } = require('@supabase/supabase-js');

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };

// Service-role client: bypasses RLS, used for admin actions and all
// server-side DB access (routes filter by req.user.id manually).
// It must never be given a user session, or RLS would start applying to it.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  clientOpts
);

// A throwaway anon-key client for a single password sign-in, so signInWithPassword
// never mutates the shared admin client's auth state.
function anonClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, clientOpts);
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = header.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  req.supabase = supabaseAdmin;
  next();
}

module.exports = { requireAuth, supabaseAdmin, anonClient };
