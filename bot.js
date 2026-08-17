import { Client } from 'discord.js-selfbot-v13';
import dotenv from 'dotenv';
import { buildProfileCard, getBadges } from './utils/profileFormat.js';
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
  fetchMemberInGuild,
} from './utils/discordData.js';

dotenv.config();

const client = new Client();
const DISCORD_TOKEN = process.env.SELFBOT_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

client.on('ready', () => {
  console.log(`✅ Selfbot logado como ${client.user.tag}`);
});

async function getUserSubscriptions(userId, guildId = GUILD_ID) {
  try {
    let member = guildId ? await fetchMemberInGuild(client, guildId, userId) : null;
    let profile = await fetchProfileById(client, userId, guildId);

    if (!member) {
      member = await findMemberInMutualGuilds(client, userId, profile, guildId);
    }

    const user = await fetchUserSafe(client, userId, guildId, profile, member);
    if (!user) {
      console.error(`❌ Não foi possível resolver usuário ${userId}`);
      return null;
    }

    if (!profile) {
      profile = await fetchProfileById(client, userId, guildId);
    }

    const hasNitro = resolveHasNitro(profile, user);
    const boostBadgeSince = resolveBoostBadgeSince(profile, member);
    const guildBoostSince = resolveGuildBoostSince(profile, member);
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
      boost_status: resolveHasBoost(profile, member) ? 'Tem Boost' : 'Não tem Boost',
      nitro_since: nitroSince?.toISOString() ?? null,
      boost_since: boostBadgeSince?.toISOString() ?? null,
      boost_servidor_desde: guildBoostSince?.toISOString() ?? null,
      premium_type: user.premiumType ?? profile?.premium_type ?? 0,
      public_flags: user.publicFlags || 0,
      badges: getBadges(user.publicFlags || 0, {
        hasNitro,
        hasBoost: resolveHasBoost(profile, member),
      }),
      _raw: { user, member, profile },
    };
  } catch (error) {
    console.error('❌ Erro em getUserSubscriptions:', error);
    return null;
  }
}

async function getUserPresence(userId) {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) throw new Error('Guild não encontrada');

    const member = await guild.members.fetch(userId);
    const presence = member.presence || null;

    let activities = [];
    let discordStatus = 'offline';
    let listeningToSpotify = false;

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
    }

    return {
      discord_status: discordStatus,
      activities,
      active_on_discord_web: presence?.clientStatus?.web || false,
      active_on_discord_desktop: presence?.clientStatus?.desktop || false,
      active_on_discord_mobile: presence?.clientStatus?.mobile || false,
      listening_to_spotify: listeningToSpotify,
      spotify: null,
    };
  } catch (error) {
    console.warn('⚠️ Erro em getUserPresence:', error.message);
    return {
      discord_status: 'offline',
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

  const profileCard = buildProfileCard({
    user,
    member,
    profile,
    executor,
    views: options.views ?? 0,
  });

  return { success: true, profile: profileCard };
}

async function getUserInfo(userId, options = {}) {
  try {
    const userSubscriptions = await getUserSubscriptions(userId, options.guildId);
    if (!userSubscriptions) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const { _raw, ...discordUser } = userSubscriptions;
    const userPresence = await getUserPresence(userId);
    const profileCard = buildProfileCard({
      user: _raw.user,
      member: _raw.member,
      profile: _raw.profile,
      executor: options.executor ?? client.user,
      views: options.views ?? 0,
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
    console.error('❌ Erro ao compilar getUserInfo:', error);
    return { success: false, error: error.message };
  }
}

export { client, getUserInfo, getUserProfileCard };

client.login(DISCORD_TOKEN);
