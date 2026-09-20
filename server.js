// =====================================================
// 1. DOTENV PRIMEIRO (antes de qualquer import que use process.env)
// =====================================================
import dotenv from 'dotenv';
dotenv.config();

// =====================================================
// 2. IMPORTS
// =====================================================
import express from 'express';
import fetch from 'node-fetch';

import apiKeysRoutes from './routes/apiKeys.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';
import { apiKeyAuth, adminAuth } from './utils/authMiddleware.js';
import { connectMongo } from './utils/mongoStore.js';

import {
  client,
  getUserInfo,
  getUserProfileCard,
  getUserPanelSection,
  getAvatarHistory,
  lookupUserByUsername,
  getViews,
  adjustViews,
} from './bot.js';
import { bootstrapAvatarHistory, ensureAvatarRecorded } from './utils/avatarStore.js';
import { fetchProfileById, fetchUserSafe } from './utils/discordData.js';
import { resolvePublicFlags } from './utils/profileFormat.js';
import { fetchBotUserFlags } from './utils/botUserFlags.js';

// =====================================================
// 3. CONECTA NO MONGO
// =====================================================
await connectMongo().catch((err) => {
  console.error('❌ [Server] Falha ao conectar no Mongo:', err.message);
});

// =====================================================
// 4. SETUP EXPRESS
// =====================================================
const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const VIEWS_ADMIN_KEY = process.env.VIEWS_ADMIN_KEY || process.env.API_ADMIN_KEY || '';

app.use(express.json());

// =====================================================
// 5. ROTAS NOVAS (API keys, stats, admin)
// =====================================================
app.use('/stats', statsRoutes);
app.use('/api-keys', apiKeysRoutes);
app.use('/admin', adminAuth, adminRoutes);

console.log('Server is starting...');

// =====================================================
// 6. HELPERS
// =====================================================
function isViewsAdmin(req) {
  const key = req.headers['x-admin-key'] || req.query.key || req.body?.key || '';
  if (!VIEWS_ADMIN_KEY) return true;
  return String(key) === String(VIEWS_ADMIN_KEY);
}

async function getUserProfile(userId) {
  const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error('Usuário não encontrado ou token inválido');
  }

  await response.json();

  return {
    bio: 'Biografia não disponível (Usuário offline ou sem presença)',
    pronouns: 'Pronome não disponível (Usuário offline ou sem presença)',
  };
}

// =====================================================
// 7. ROTAS EXISTENTES (com apiKeyAuth)
// =====================================================

// 🔹 ROTA SIMPLIFICADA
app.get('/userProfile/:userId', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    }).then((r) => r.json());

    if (!user || !user.id) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const profileData = await getUserProfile(userId);

    res.json({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      bio: profileData.bio,
      pronouns: profileData.pronouns,
    });
  } catch (error) {
    console.error('Erro ao buscar dados do Discord:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do Discord' });
  }
});

// 🔹 ROTA COMPLETA
app.get('/userFullInfo/:userId', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  try {
    const result = await getUserInfo(userId, { guildId, views });
    if (!result || !result.success) {
      return res.status(500).json({ error: result?.error || 'Não foi possível obter os dados completos.' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 LOOKUP por username
app.get('/lookup/user', apiKeyAuth, async (req, res) => {
  const q = req.query.q || req.query.username || req.query.user || '';
  const guildId = req.query.guildId || process.env.GUILD_ID;

  if (!client.readyAt) {
    return res.status(503).json({ success: false, error: 'API ainda está ligando o selfbot.' });
  }

  try {
    const result = await lookupUserByUsername(q, guildId);
    if (!result?.success) {
      return res.status(404).json(result || { success: false, error: 'Não encontrado.' });
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 🔹 Views (não precisa de apiKeyAuth — usa X-Admin-Key próprio)
app.get('/views/:userId', (req, res) => {
  const { userId } = req.params;
  return res.json({ success: true, id: userId, views: getViews(userId) });
});

app.post('/views/:userId', (req, res) => {
  if (!isViewsAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Não autorizado.' });
  }

  const { userId } = req.params;
  const action = req.body?.action || req.query.action || 'add';
  const amountRaw = req.body?.amount ?? req.query.amount ?? 1;
  const amount = Number(amountRaw);

  if (!Number.isFinite(amount)) {
    return res.status(400).json({ success: false, error: 'Quantidade inválida.' });
  }

  const views = adjustViews(userId, { action, amount });
  return res.json({ success: true, id: userId, action, amount, views });
});

// 🔹 PERFIL
app.get('/user/:userId', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  if (!client.readyAt) {
    return res.status(503).json({ error: 'API ainda está ligando o selfbot. Tente em alguns segundos.' });
  }

  try {
    const result = await getUserProfileCard(userId, { guildId, views });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || 'Perfil não encontrado.' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 RAW BADGES
app.get('/user/:userId/raw-badges', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;

  if (!client.readyAt) {
    return res.status(503).json({ error: 'API ainda está ligando o selfbot.' });
  }

  try {
    const profile = await fetchProfileById(client, userId, guildId);
    const user = await fetchUserSafe(client, userId, guildId, profile, null);
    const botUser = await fetchBotUserFlags(userId);
    const flags = resolvePublicFlags(user, {
      ...profile,
      user: {
        ...(profile?.user || {}),
        public_flags: ((profile?.user?.public_flags || 0) | (botUser?.public_flags || 0)) >>> 0,
      },
    });

    res.json({
      user_id: userId,
      private_profile: Boolean(profile?.private),
      flags,
      bot_public_flags: botUser?.public_flags ?? null,
      user_flags_bitfield: Number(user?.flags?.bitfield ?? user?.flags ?? 0),
      profile_user_public_flags: Number(profile?.user?.public_flags ?? 0),
      badges: (profile?.badges ?? []).map((b) => ({
        id: b.id,
        description: b.description,
        icon: b.icon,
      })),
      badge_ids: (profile?.badges ?? []).map((b) => b.id),
      premium_type: profile?.premium_type ?? profile?.user?.premium_type ?? null,
      premium_since: profile?.premium_since ?? null,
      premium_guild_since: profile?.premium_guild_since ?? null,
      legacy_username: profile?.legacy_username ?? null,
      mutual_guilds: profile?.mutual_guilds?.length ?? 0,
      hint: profile?.private
        ? 'Perfil PRIVADO...'
        : (profile?.badges?.length ? null : 'badges[] vazio...'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 PROFILE CARD
app.get('/userProfileCard/:userId', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  try {
    const result = await getUserProfileCard(userId, { guildId, views });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || 'Perfil não encontrado.' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 AVATARES
app.get('/user/:userId/avatars', apiKeyAuth, async (req, res) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 0;
  const pageSize = Math.min(Number(req.query.limit) || 10, 50);

  try {
    let user = client.users.cache.get(userId);
    if (!user) {
      try { user = await client.users.fetch(userId); } catch { user = null; }
    }

    if (user) {
      await ensureAvatarRecorded(user, { archive: false });
    }

    const icons = await getAvatarHistory(userId, page, pageSize);
    res.json({ success: true, userId, icons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 PAINEL
app.get('/user/:userId/panel/:section', apiKeyAuth, async (req, res) => {
  const { userId, section } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const page = Number(req.query.page) || 0;

  try {
    const result = await getUserPanelSection(userId, section, { guildId, page });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || 'Seção indisponível.' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// 8. LISTA DE ROTAS
// =====================================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    rotas: {
      stats: 'GET /stats',
      register_key: 'POST /api-keys/register',
      my_key: 'GET /api-keys/me',
      revoke_key: 'DELETE /api-keys/me',
      admin_keys: 'GET /admin/keys (X-Admin-Key)',
      perfil: 'GET /user/:userId (X-API-Key)',
      lookup: 'GET /lookup/user?q=username (X-API-Key)',
      painel: 'GET /user/:userId/panel/:section (X-API-Key)',
      avatars: 'GET /user/:userId/avatars (X-API-Key)',
    },
    exemplo: `http://localhost:${PORT}/user/1486900684623314955`,
  });
});

// =====================================================
// 9. SOBE O SERVIDOR
// =====================================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já em uso.`);
    process.exit(1);
  }
  console.error('❌ Erro ao iniciar servidor:', error);
  process.exit(1);
});

client.on('ready', () => {
  console.log(`✅ Selfbot logado como ${client.user.tag}`);
  bootstrapAvatarHistory(client).catch((error) => {
    console.warn('⚠️ [AvatarStore] Bootstrap falhou:', error.message);
  });
});