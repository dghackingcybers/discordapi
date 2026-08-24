function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Data global da insígnia de boost (premium_guild_since).
 * Nunca usar member.premiumSince aqui — isso é por servidor.
 */
function resolveBoostBadgeSince(profile) {
  const candidates = [
    profile?.premium_guild_since,
    profile?.user?.premium_guild_since,
    profile?.user_profile?.premium_guild_since,
  ];

  for (const value of candidates) {
    const date = toDate(value);
    if (date) return date;
  }

  return null;
}

/** Boost apenas no servidor do comando (guildId) */
function resolveGuildBoostSince(profile, member = null, guildId = null) {
  const memberGuildId = member?.guild?.id ?? member?.guildId ?? null;

  if (member?.premiumSince && (!guildId || memberGuildId === guildId)) {
    return toDate(member.premiumSince);
  }

  if (guildId && profile?.guild_member?.guild_id === guildId) {
    return toDate(profile.guild_member.premium_since);
  }

  return null;
}

function isBoostingGuild(profile, member = null, guildId = null) {
  return Boolean(resolveGuildBoostSince(profile, member, guildId));
}

function resolveNitroSince(profile, user = null) {
  const candidates = [
    profile?.premium_since,
    profile?.user?.premium_since,
    user?.premiumSince,
  ];

  for (const value of candidates) {
    const date = toDate(value);
    if (date) return date;
  }

  return null;
}

function resolveHasNitro(profile, user = null) {
  const premiumType = user?.premiumType ?? profile?.premium_type ?? profile?.user?.premium_type ?? 0;
  return Boolean(premiumType && premiumType !== 0) || Boolean(resolveNitroSince(profile, user));
}

function resolveHasBoost(profile, member = null, guildId = null) {
  return Boolean(resolveBoostBadgeSince(profile) || resolveGuildBoostSince(profile, member, guildId));
}

async function fetchMemberInGuild(client, guildId, userId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  try {
    return await guild.members.fetch(userId);
  } catch {
    try {
      return await guild.members.fetch({ user: userId, force: true });
    } catch {
      return null;
    }
  }
}

async function fetchProfileById(client, userId, guildId) {
  let guildProfile = null;
  let globalProfile = null;

  if (guildId) {
    try {
      guildProfile = await client.api.users(userId).profile.get({
        query: {
          with_mutual_guilds: true,
          with_mutual_friends: false,
          with_mutual_friends_count: false,
          guild_id: guildId,
        },
      });
    } catch (error) {
      console.warn(`⚠️ Perfil do servidor indisponível (${guildId}):`, error.message);
    }
  }

  try {
    globalProfile = await client.api.users(userId).profile.get({
      query: {
        with_mutual_guilds: true,
        with_mutual_friends: false,
        with_mutual_friends_count: false,
        ...(guildId ? { guild_id: guildId } : {}),
      },
    });
  } catch (error) {
    console.warn('⚠️ Perfil global indisponível:', error.message);
  }

  return mergeProfiles(guildProfile, globalProfile);
}

async function fetchUserSafe(client, userId, guildId, profile = null, member = null) {
  const cached = client.users.cache.get(userId);
  if (cached) return cached;

  if (member?.user) return member.user;

  if (profile?.user) {
    try {
      const userFromProfile = client.users._add(profile.user, false);
      if (profile.user.banner && !userFromProfile.banner) {
        userFromProfile.banner = profile.user.banner;
      }
      return userFromProfile;
    } catch {
      // segue para outros fallbacks
    }
  }

  if (guildId) {
    const guildMember = await fetchMemberInGuild(client, guildId, userId);
    if (guildMember?.user) return guildMember.user;
  }

  try {
    return await client.users.fetch(userId);
  } catch (error) {
    console.warn('⚠️ users.fetch falhou, tentando servidores em comum:', error.message);
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      const guildMember = await guild.members.fetch(userId);
      if (guildMember?.user) return guildMember.user;
    } catch {
      // tenta próximo servidor
    }
  }

  return null;
}

function mergeProfiles(guildProfile, globalProfile) {
  if (!guildProfile) return globalProfile ?? null;
  if (!globalProfile) return guildProfile;

  return {
    ...globalProfile,
    ...guildProfile,
    user: { ...globalProfile.user, ...guildProfile.user },
    premium_since: globalProfile.premium_since ?? guildProfile.premium_since,
    premium_guild_since: globalProfile.premium_guild_since ?? guildProfile.premium_guild_since,
    premium_type: guildProfile.premium_type ?? globalProfile.premium_type,
    guild_member: guildProfile.guild_member ?? globalProfile.guild_member,
    mutual_guilds: guildProfile.mutual_guilds ?? globalProfile.mutual_guilds,
  };
}

async function fetchProfileForUser(user, guildId, client) {
  if (!user?.id) return null;
  return fetchProfileById(client, user.id, guildId);
}

async function findMemberInMutualGuilds(client, userId, profile, preferredGuildId) {
  const guildIds = new Set();

  if (preferredGuildId) guildIds.add(preferredGuildId);
  if (profile?.guild_member?.guild_id) guildIds.add(profile.guild_member.guild_id);
  if (profile?.guild_id) guildIds.add(profile.guild_id);

  for (const guild of profile?.mutual_guilds ?? []) {
    if (guild?.id) guildIds.add(guild.id);
  }

  for (const guildId of client.guilds.cache.keys()) {
    guildIds.add(guildId);
  }

  let bestMember = null;

  for (const guildId of guildIds) {
    const member = await fetchMemberInGuild(client, guildId, userId);
    if (!member) continue;

    if (!bestMember) {
      bestMember = member;
      continue;
    }

    const currentSince = toDate(member.premiumSince)?.getTime() ?? Infinity;
    const bestSince = toDate(bestMember.premiumSince)?.getTime() ?? Infinity;
    if (currentSince < bestSince) bestMember = member;
  }

  return bestMember;
}

export {
  toDate,
  resolveBoostBadgeSince,
  resolveGuildBoostSince,
  isBoostingGuild,
  resolveNitroSince,
  resolveHasNitro,
  resolveHasBoost,
  fetchMemberInGuild,
  fetchProfileById,
  fetchProfileForUser,
  fetchUserSafe,
  findMemberInMutualGuilds,
};
