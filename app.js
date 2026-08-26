import express from 'express';
import dotenv from 'dotenv';
import { Client } from 'discord.js-selfbot-v13';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const client = new Client();

client.on('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  // ROTAS EXPRESS DEVEM SER CRIADAS AQUI

  app.get("/userFullInfo/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await getUserInfo(userId);
      if (!result.success) {
        return res.status(500).json({ error: result.error || "Erro ao buscar informações" });
      }
      res.json(result);
    } catch (err) {
      console.error("Erro:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "online", bot: client.user?.tag || null });
  });

  // Inicia o servidor após bot estar pronto
  app.listen(PORT, () => {
    console.log(`🚀 API rodando: http://localhost:${PORT}`);
  });
});

// Badge helper
function getBadges(flags) {
  const badgeMap = {
    1: "STAFF",
    2: "PARTNER",
    4: "HYPESQUAD",
    8: "BUG_HUNTER",
    64: "EARLY_SUPPORTER",
    128: "TEAM_USER",
    512: "SYSTEM",
    16384: "BUG_HUNTER_LEVEL_2",
    131072: "VERIFIED_BOT",
    262144: "EARLY_VERIFIED_BOT_DEVELOPER"
  };
  return Object.entries(badgeMap).filter(([bit]) => flags & bit).map(([, name]) => name);
}

// Info principal
async function getUserInfo(userId) {
  try {
    const user = await client.users.fetch(userId);
    const presence = user.presence || null;

    const hasNitro = user.premiumType && user.premiumType !== 0;
    const hasBoost = user.premium_since !== null;

    const discordUser = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      avatar_decoration_data: user.avatarDecoration || null,
      banner: user.banner || null,
      bot: user.bot || false,
      global_name: user.globalName || user.username,
      display_name: user.displayName || user.username,
      public_flags: user.publicFlags || 0,
      nitro_status: hasNitro ? "Tem Nitro" : "Não tem Nitro",
      boost_status: hasBoost ? "Tem Boost" : "Não tem Boost",
      boost_since: hasBoost ? new Date(user.premium_since).toISOString() : null,
      badges: getBadges(user.publicFlags || 0)
    };

    const activities = presence?.activities?.map((activity) => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      state: activity.state || null,
      details: activity.details || null,
      emoji: activity.emoji || null,
      session_id: activity.session_id || null,
      timestamps: activity.timestamps || null,
      assets: activity.assets || null,
      application_id: activity.applicationId || null,
      created_at: activity.createdTimestamp || null,
      platform: activity.platform || "unknown",
      buttons: activity.buttons || null,
      flags: activity.flags || 0
    })) || [];

    return {
      data: {
        kv: {},
        discord_user: discordUser,
        activities,
        discord_status: presence?.status || "offline",
        active_on_discord_web: !!presence?.clientStatus?.web,
        active_on_discord_desktop: !!presence?.clientStatus?.desktop,
        active_on_discord_mobile: !!presence?.clientStatus?.mobile,
        listening_to_spotify: activities.some(a => a.name === "Spotify"),
        spotify: null
      },
      success: true
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Login do selfbot
client.login(DISCORD_TOKEN);
