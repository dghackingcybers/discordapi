import { Client } from 'discord.js-selfbot-v13';
import dotenv from 'dotenv';
import { buildProfileCard, getBadges, resolvePublicFlags } from './utils/profileFormat.js';
import {
  resolveBoostBadgeSince,
  resolveGuildBoostSince,
  resolveNitroSince,
  resolveHasNitro,
  resolveHasBoost,
  fetchProfileForUser,
  fetchProfileById,
  fetchUserSafe,
  findMemberInMutualGuilds,
} from './utils/discordData.js';
import { fetchBotUserFlags } from './utils/botUserFlags.js';
import { extractProfileExtras } from './utils/profileExtras.js';
import {
  recordMessage,
  recordVoiceUpdate,
  recordUserUpdate,
  getUserLogs,
  findUserIdByUsername,
  indexUsername,
} from './utils/logStore.js';
import {
  recordAvatarUpdate,
  ensureAvatarRecorded,
  getAvatarHistory,
  bootstrapAvatarHistory,
} from './utils/avatarStore.js';
import { getViews, incrementViews, adjustViews } from './utils/viewStore.js';

dotenv.config();

const client = new Client();
const DISCORD_TOKEN = process.env.SELFBOT_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

client.on('ready', () => {
  console.log(`✅ Selfbot logado como ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  try {
    recordMessage(message, { deleted: false });
  } catch {
    // ignora
  }
});

client.on('messageDelete', (message) => {
  try {
    recordMessage(message, { deleted: true });
  } catch {
    // ignora
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  try {
    recordVoiceUpdate(oldState, newState);
  } catch {
    // ignora
  }
});

client.on('userUpdate', (oldUser, newUser) => {
  try {
    recordUserUpdate(oldUser, newUser);
    recordAvatarUpdate(oldUser, newUser);
  } catch {
    // ignora
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  try {
    if (oldMember?.user && newMember?.user) {
      recordAvatarUpdate(oldMember.user, newMember.user);
    }
  } catch {
    // ignora
  }
});

client.on('guildMemberAdd', (member) => {
  try {
    if (member?.user && !member.user.bot) {
      ensureAvatarRecorded(member.user, { archive: false }).catch(() => {});
    }
  } catch {
    // ignora
  }
});

async function getUserSubscriptions(userId, guildId = GUILD_ID) {
  try {
    let profile = await fetchProfileById(client, userId, guildId);
    const member = await findMemberInMutualGuilds(client, userId, profile, guildId);

    const user = await fetchUserSafe(client, userId, guildId, profile, member);
    if (!user) {
      return null;
    }

    if (!profile) {
      profile = await fetchProfileById(client, userId, guildId);
    }

    // Flags oficiais via token do BOT (não depende do cache do selfbot)
    const botUser = await fetchBotUserFlags(userId);
    if (botUser && profile) {
      profile.user = {
        ...(profile.user || {}),
        public_flags: (Number(profile.user?.public_flags ?? 0) | botUser.public_flags) >>> 0,
      };
    } else if (botUser && !profile) {
      profile = { user: { id: userId, public_flags: botUser.public_flags } };
    }

    if (botUser?.public_flags) {
      const current = Number(user.flags?.bitfield ?? user.flags ?? 0);
      const merged = (current | botUser.public_flags) >>> 0;
      if (user.flags && typeof user.flags.bitfield !== 'undefined') {
        user.flags.bitfield = merged;
      }
    }

    const hasNitro = resolveHasNitro(profile, user);
    const boostBadgeSince = resolveBoostBadgeSince(profile);
    const guildBoostSince = resolveGuildBoostSince(profile, member, guildId);
    const nitroSince = resolveNitroSince(profile, user);

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.displayAvatarURL({ extension: 'webp', size: 256 }),
      global_name: user.globalName || user.username,
      display_name: user.displayName || user.globalName || user.username,
      created_at: user.createdAt?.toISOString() ?? null,
      joined_at: member?.joinedAt?.toISOString() ?? null,
      nitro_status: hasNitro ? 'Tem Nitro' : 'Não tem Nitro',
      boost_status: resolveHasBoost(profile, member, guildId) ? 'Tem Boost' : 'Não tem Boost',
      nitro_since: nitroSince?.toISOString() ?? null,
      boost_since: boostBadgeSince?.toISOString() ?? null,
      boost_servidor_desde: guildBoostSince?.toISOString() ?? null,
      premium_type: user.premiumType ?? profile?.premium_type ?? 0,
      public_flags: resolvePublicFlags(user, profile),
      badges: getBadges(resolvePublicFlags(user, profile), {
        hasNitro,
        hasBoost: resolveHasBoost(profile, member, guildId),
        profile,
      }),
      _raw: { user, member, profile, guildId, botUser },
    };
  } catch (error) {
    console.error('❌ Erro em getUserSubscriptions:', error);
    return null;
  }
}

async function getUserPresence(userId, guildId = GUILD_ID) {
  try {
    const targetGuildId = guildId || GUILD_ID;
    const guild = client.guilds.cache.get(targetGuildId);

    if (!guild) {
      throw new Error('Guild não encontrada');
    }

    const member = await guild.members.fetch(userId);
    const presence = member.presence || null;

    let activities = [];
    let discordStatus = 'offline';
    let listeningToSpotify = false;
    let customStatus = null;

    if (presence) {
      discordStatus = presence.status;

      activities = presence.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        state: activity.state || 'Sem estado',
        details: activity.details || 'Sem detalhes',
        emoji: activity.emoji || null,
        session_id: activity.session_id,
        created_at: activity.startTimestamp || Date.now(),
        assets: activity.assets || null,
        application_id: activity.applicationId || null,
        buttons: activity.buttons || null,
      }));

      listeningToSpotify = activities.some((a) => a.name === 'Spotify');

      const customActivity = presence.activities.find((activity) => activity.type === 4);
      if (customActivity) {
        const emojiPart = customActivity.emoji?.name ? `${customActivity.emoji.name} ` : '';
        customStatus = `${emojiPart}${customActivity.state || customActivity.name || ''}`.trim();
      }
    }

    return {
      discord_status: discordStatus,
      custom_status: customStatus,
      activities,
      active_on_discord_web: presence?.clientStatus?.web || false,
      active_on_discord_desktop: presence?.clientStatus?.desktop || false,
      active_on_discord_mobile: presence?.clientStatus?.mobile || false,
      listening_to_spotify: listeningToSpotify,
      spotify: null,
    };
  } catch (error) {
    return {
      discord_status: 'offline',
      custom_status: null,
      activities: [],
      active_on_discord_web: false,
      active_on_discord_desktop: false,
      active_on_discord_mobile: false,
      listening_to_spotify: false,
      spotify: null,
    };
  }
}

async function getUserProfileCard(userId, options = {}) {
  const guildId = options.guildId || GUILD_ID;
  const subscriptions = await getUserSubscriptions(userId, guildId);

  if (!subscriptions?._raw) {
    return { success: false, error: 'Usuário não encontrado ou sem acesso ao perfil.' };
  }

  const { user, member, profile } = subscriptions._raw;
  const executor = options.executor ?? client.user;
  const presence = await getUserPresence(userId, guildId);

  // Contador persistente: incrementa só quando o bot pede (views>=1 / increment=true)
  const shouldIncrement =
    options.incrementViews === true ||
    options.increment === true ||
    Number(options.views) > 0;

  const viewCount = shouldIncrement
    ? incrementViews(userId, Number(options.views) > 0 ? Number(options.views) : 1)
    : getViews(userId);

  const profileCard = buildProfileCard({
    user,
    member,
    profile,
    executor,
    views: viewCount,
    guildId,
    customStatus: presence.custom_status,
  });

  return { success: true, profile: profileCard, views: viewCount };
}

async function getUserInfo(userId, options = {}) {
  try {
    const userSubscriptions = await getUserSubscriptions(userId, options.guildId);
    if (!userSubscriptions) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const { _raw, ...discordUser } = userSubscriptions;
    const userPresence = await getUserPresence(userId, options.guildId || GUILD_ID);
    const shouldIncrement =
      options.incrementViews === true ||
      options.increment === true ||
      Number(options.views) > 0;

    const viewCount = shouldIncrement
      ? incrementViews(userId, Number(options.views) > 0 ? Number(options.views) : 1)
      : getViews(userId);

    const profileCard = buildProfileCard({
      user: _raw.user,
      member: _raw.member,
      profile: _raw.profile,
      executor: options.executor ?? client.user,
      views: viewCount,
      guildId: options.guildId || GUILD_ID,
      customStatus: userPresence.custom_status,
    });

    return {
      data: {
        kv: {},
        discord_user: discordUser,
        profile: profileCard,
        embed: profileCard.embed,
        activities: userPresence.activities,
        discord_status: userPresence.discord_status,
        active_on_discord_web: userPresence.active_on_discord_web,
        active_on_discord_desktop: userPresence.active_on_discord_desktop,
        active_on_discord_mobile: userPresence.active_on_discord_mobile,
        listening_to_spotify: userPresence.listening_to_spotify,
        spotify: userPresence.spotify,
      },
      success: true,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getUserPanelSection(userId, section, options = {}) {
  const guildId = options.guildId || GUILD_ID;
  const page = Number(options.page) || 0;
  const cardResult = await getUserProfileCard(userId, { guildId, views: 0 });

  if (!cardResult?.success) {
    return { success: false, error: cardResult?.error || 'Perfil indisponível.' };
  }

  const profile = cardResult.profile;
  const name = profile.author?.name || profile.tag;

  if (section === 'icons') {
    let user = client.users.cache.get(userId);
    if (!user) {
      try {
        user = await client.users.fetch(userId);
      } catch {
        user = null;
      }
    }

    if (user) {
      await ensureAvatarRecorded(user, { archive: false }).catch(() => {});
    }

    const icons = getAvatarHistory(userId, page, 1);
    return {
      success: true,
      section,
      page,
      profile: { id: userId, name, thumbnail: profile.thumbnail },
      icons,
    };
  }

  switch (section) {
    case 'messages':
    case 'deleted_messages':
    case 'calls':
    case 'guilds_seen': {
      const logs = getUserLogs(userId, section, page, 10);
      return { success: true, section, page, profile: { id: userId, name }, logs };
    }
    case 'names': {
      const usernames = getUserLogs(userId, 'username_history', 0, 50);
      const displays = getUserLogs(userId, 'display_name_history', 0, 50);
      return {
        success: true,
        section,
        profile: { id: userId, name },
        usernames: usernames.items.map((item) => item.name),
        display_names: displays.items.map((item) => item.name),
      };
    }
    default:
      return { success: true, section, profile };
  }
}

async function lookupUserByUsername(query, preferredGuildId = GUILD_ID) {
  const handle = String(query || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

  if (!handle || handle.length < 2) {
    return { success: false, error: 'Username inválido.' };
  }

  // 1) índice / histórico da API
  const indexedId = findUserIdByUsername(handle);
  if (indexedId) {
    try {
      const user = await client.users.fetch(indexedId);
      return {
        success: true,
        id: user.id,
        username: user.username,
        global_name: user.globalName ?? null,
        source: 'history',
      };
    } catch {
      // continua
    }
  }

  // 2) cache do selfbot
  const cached = client.users.cache.find(
    (user) =>
      user.username?.toLowerCase() === handle ||
      user.globalName?.toLowerCase() === handle,
  );
  if (cached) {
    indexUsername(cached.id, cached.username);
    if (cached.globalName) indexUsername(cached.id, cached.globalName);
    return {
      success: true,
      id: cached.id,
      username: cached.username,
      global_name: cached.globalName ?? null,
      source: 'cache',
    };
  }

  // 3) busca em todos os servidores do selfbot (Search Guild Members)
  const guilds = [...client.guilds.cache.values()];
  if (preferredGuildId) {
    guilds.sort((a, b) => Number(b.id === preferredGuildId) - Number(a.id === preferredGuildId));
  }

  for (const guild of guilds.slice(0, 40)) {
    try {
      const found = await guild.members.fetch({ query: handle, limit: 25 });
      const list = [...found.values()];

      const exact = list.find(
        (member) =>
          member.user.username?.toLowerCase() === handle ||
          member.user.globalName?.toLowerCase() === handle ||
          member.displayName?.toLowerCase() === handle,
      );
      const match =
        exact ||
        list.find(
          (member) =>
            member.user.username?.toLowerCase().startsWith(handle) ||
            member.displayName?.toLowerCase().startsWith(handle),
        ) ||
        list[0];

      if (match?.user) {
        indexUsername(match.user.id, match.user.username);
        if (match.user.globalName) indexUsername(match.user.id, match.user.globalName);
        return {
          success: true,
          id: match.user.id,
          username: match.user.username,
          global_name: match.user.globalName ?? null,
          source: `guild:${guild.id}`,
        };
      }
    } catch {
      // próximo guild
    }
  }

  return { success: false, error: `Usuário @${handle} não encontrado.` };
}

export { client, getUserInfo, getUserProfileCard, getUserPanelSection, getAvatarHistory, lookupUserByUsername, getViews, adjustViews };

client.login(DISCORD_TOKEN);
