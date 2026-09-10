// Local dev loads .env; hosted platforms inject env vars directly.
if (!process.env.SUPABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
}
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/transit', require('./routes/transit'));

app.get('/', (req, res) => res.json({ message: 'GreenRoute API running' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Run a real server locally; on Vercel the app is imported as a serverless handler.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
