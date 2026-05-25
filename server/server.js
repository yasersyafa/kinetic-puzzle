// Minimal OAuth2 token-exchange server for Discord Activity.
// Phase 1: this server is OPTIONAL — game runs with discordSdk.ready() only.
// Phase 2: enable when adding user-scoped storage / leaderboards.
//
// Endpoint: POST /api/token  { code } -> { access_token }
// Env:      DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET (load via dotenv)

import 'dotenv/config';
import express from 'express';

const PORT = process.env.PORT || 3001;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('[server] DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET missing in env');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.post('/api/token', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'missing code' });

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn('[server] token exchange failed', data);
      return res.status(response.status).json(data);
    }
    return res.json({ access_token: data.access_token });
  } catch (e) {
    console.error('[server] token exchange threw', e);
    return res.status(500).json({ error: 'token_exchange_failed' });
  }
});

app.get('/health', (_req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`[server] OAuth token-exchange listening on :${PORT}`);
});
