import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { client, getUserInfo, getUserProfileCard, getUserPanelSection, getAvatarHistory, lookupUserByUsername } from './bot.js';
import { bootstrapAvatarHistory, ensureAvatarRecorded } from './utils/avatarStore.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

console.log("Server is starting...");

// Função para obter bio e pronome (status customizado)
async function getUserProfile(userId) {
  const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error("Usuário não encontrado ou token inválido");
  }

  const user = await response.json();

  // Simulando status personalizado
  const bio = "Biografia não disponível (Usuário offline ou sem presença)";
  const pronouns = "Pronome não disponível (Usuário offline ou sem presença)";

  return {
    bio,
    pronouns
  };
}

// 🔹 ROTA SIMPLIFICADA
app.get("/userProfile/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    }).then(res => res.json());

    if (!user || !user.id) {
      return res.status(404).json({ error: "Usuário não encontrado" });
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
    console.error("Erro ao buscar dados do Discord:", error);
    res.status(500).json({ error: "Erro ao buscar dados do Discord" });
  }
});

// 🔹 ROTA COMPLETA (formato Zany + dados Lanyard)
app.get("/userFullInfo/:userId", async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  try {
    const result = await getUserInfo(userId, { guildId, views });
    if (!result || !result.success) {
      return res.status(500).json({ error: result?.error || "Não foi possível obter os dados completos." });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 LOOKUP por username (@user) — ANTES de /user/:userId
app.get("/lookup/user", async (req, res) => {
  const q = req.query.q || req.query.username || req.query.user || "";
  const guildId = req.query.guildId || process.env.GUILD_ID;

  if (!client.readyAt) {
    return res.status(503).json({ success: false, error: "API ainda está ligando o selfbot." });
  }

  try {
    const result = await lookupUserByUsername(q, guildId);
    if (!result?.success) {
      return res.status(404).json(result || { success: false, error: "Não encontrado." });
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 🔹 ROTA CURTA (alias) — use /user/ID
app.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  if (!client.readyAt) {
    return res.status(503).json({ error: "API ainda está ligando o selfbot. Tente em alguns segundos." });
  }

  try {
    const result = await getUserProfileCard(userId, { guildId, views });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || "Perfil não encontrado." });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 ROTA NO ESTILO DO BOT ZANY (embed pronto)
app.get("/userProfileCard/:userId", async (req, res) => {
  const { userId } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const views = Number(req.query.views) || 0;

  try {
    const result = await getUserProfileCard(userId, { guildId, views });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || "Perfil não encontrado." });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Ícones antigos (histórico de avatares)
app.get("/user/:userId/avatars", async (req, res) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 0;
  const pageSize = Math.min(Number(req.query.limit) || 10, 50);

  try {
    let user = client.users.cache.get(userId);
    if (!user) {
      try {
        user = await client.users.fetch(userId);
      } catch {
        user = null;
      }
    }

    if (user) {
      await ensureAvatarRecorded(user, { archive: false });
    }

    const icons = getAvatarHistory(userId, page, pageSize);
    res.json({ success: true, userId, icons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Seção do painel (logs, nomes, etc.)
app.get("/user/:userId/panel/:section", async (req, res) => {
  const { userId, section } = req.params;
  const guildId = req.query.guildId || process.env.GUILD_ID;
  const page = Number(req.query.page) || 0;

  try {
    const result = await getUserPanelSection(userId, section, { guildId, page });
    if (!result?.success) {
      return res.status(404).json({ error: result?.error || "Seção indisponível." });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Lista de rotas
app.get("/", (req, res) => {
  res.json({
    status: "online",
    rotas: {
      perfil: "GET /user/:userId",
      lookup: "GET /lookup/user?q=username",
      perfil_zany: "GET /userProfileCard/:userId",
      completo: "GET /userFullInfo/:userId",
      basico: "GET /userProfile/:userId",
      painel: "GET /user/:userId/panel/:section?page=0",
      avatars: "GET /user/:userId/avatars?page=0",
    },
    exemplo: `http://localhost:${PORT}/user/1486900684623314955`,
  });
});

// 🔸 Sobe o HTTP imediatamente (evita 502 no healthcheck do Render)
let serverStarted = false;

if (!serverStarted) {
  serverStarted = true;

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Porta ${PORT} já está em uso. Feche a instância anterior ou mude PORT no .env`);
      process.exit(1);
    }

    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  });
}

client.on('ready', () => {
  console.log(`✅ Selfbot logado como ${client.user.tag}`);

  bootstrapAvatarHistory(client).catch((error) => {
    console.warn('⚠️ [AvatarStore] Bootstrap falhou:', error.message);
  });
});
