function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
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

  if (guildId && profile?.guild_member && !profile.guild_member.guild_id) {
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
    profile?.user_profile?.premium_since,
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

function mergeBadges(a = [], b = []) {
  const map = new Map();

  for (const badge of [...a, ...b]) {
    const id = String(badge?.id ?? badge?.name ?? "").toLowerCase();
    if (!id) continue;
    map.set(id, badge);
  }

  return [...map.values()];
}

function mergeProfiles(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;

  const mergedUser = { ...a.user, ...b.user };

  return {
    ...a,
    ...b,
    private: Boolean(a.private || b.private),
    user: {
      ...mergedUser,
      bio: pickValue(mergedUser.bio, b.user?.bio, a.user?.bio),
      primary_guild: pickValue(b.user?.primary_guild, a.user?.primary_guild),
    },
    bio: pickValue(b.bio, a.bio, b.user?.bio, a.user?.bio, b.user_profile?.bio, a.user_profile?.bio),
    pronouns: pickValue(b.pronouns, a.pronouns, b.user_profile?.pronouns, a.user_profile?.pronouns),
    premium_since: pickValue(a.premium_since, b.premium_since),
    premium_guild_since: pickValue(a.premium_guild_since, b.premium_guild_since),
    premium_type: pickValue(b.premium_type, a.premium_type, b.user?.premium_type, a.user?.premium_type),
    guild_member: { ...a.guild_member, ...b.guild_member },
    guild_member_profile: { ...a.guild_member_profile, ...b.guild_member_profile },
    mutual_guilds: b.mutual_guilds?.length ? b.mutual_guilds : a.mutual_guilds,
    mutual_friends_count: pickValue(b.mutual_friends_count, a.mutual_friends_count),
    user_profile: { ...a.user_profile, ...b.user_profile },
    badges: mergeBadges(a.badges, b.badges),
    connected_accounts: b.connected_accounts?.length ? b.connected_accounts : a.connected_accounts ?? [],
  };
}

async function fetchProfileById(client, userId, guildId) {
  const query = {
    with_mutual_guilds: true,
    with_mutual_friends_count: true,
    type: "modal",
    ...(guildId ? { guild_id: guildId } : {}),
  };

  try {
    return await client.api.users(userId).profile.get({ query });
  } catch (error) {
    console.warn("⚠️ Perfil indisponível:", error.message);
  }

  if (!guildId) return null;

  try {
    return await client.api.users(userId).profile.get({
      query: {
        with_mutual_guilds: true,
        with_mutual_friends_count: true,
        type: "modal",
      },
    });
  } catch (error) {
    console.warn("⚠️ Perfil global indisponível:", error.message);
    return null;
  }
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
      if (profile.user.primary_guild && !userFromProfile.primaryGuild) {
        userFromProfile.primaryGuild = profile.user.primary_guild;
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
    console.warn("⚠️ users.fetch falhou:", error.message);
  }

  return null;
}

async function fetchProfileForUser(user, guildId, client) {
  if (!user?.id) return null;
  return fetchProfileById(client, user.id, guildId);
}

async function findMemberInMutualGuilds(client, userId, profile, preferredGuildId) {
  const guildIds = [];

  const pushId = (id) => {
    if (id && !guildIds.includes(id)) guildIds.push(id);
  };

  pushId(preferredGuildId);
  pushId(profile?.guild_member?.guild_id);
  pushId(profile?.guild_id);

  for (const guild of profile?.mutual_guilds ?? []) {
    pushId(guild?.id);
    if (guildIds.length >= 6) break;
  }

  if (preferredGuildId) {
    const member = await fetchMemberInGuild(client, preferredGuildId, userId);
    if (member) return member;
  }

  let bestMember = null;

  for (const guildId of guildIds) {
    if (guildId === preferredGuildId) continue;
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
  mergeProfiles,
};
