function hexColor(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.startsWith("#")) return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `#${num.toString(16).padStart(6, "0")}`;
}

function isDiscordPrivateProfile(profile) {
  if (!profile) return false;

  const userProfile = profile.user_profile ?? profile.user?.user_profile ?? {};
  const flags = userProfile.flags ?? profile.flags ?? 0;

  return Boolean(
    userProfile.private ||
    profile.private_profile ||
    profile.is_private ||
    (flags & 1) ||
    (flags & 2),
  );
}

function resolveProfileBio(profile, member = null) {
  const guildMember = profile?.guild_member ?? member ?? {};

  return (
    profile?.user?.bio ??
    profile?.bio ??
    guildMember.bio ??
    profile?.user_profile?.bio ??
    profile?.about_me ??
    null
  );
}

function resolveProfilePronouns(profile) {
  const userProfile = profile?.user_profile ?? profile?.user?.user_profile ?? {};
  return profile?.pronouns ?? userProfile.pronouns ?? profile?.user?.pronouns ?? null;
}

function extractProfileExtras(profile, user, member = null) {
  const userProfile = profile?.user_profile ?? profile?.user?.user_profile ?? {};
  const guildMemberProfile = profile?.guild_member ?? member ?? {};

  const themeColors = userProfile.theme_colors ?? profile?.theme_colors ?? null;
  const primary = Array.isArray(themeColors) ? themeColors[0] : null;
  const accent = Array.isArray(themeColors) ? themeColors[1] : null;

  const connections = (userProfile.connected_accounts ?? profile?.connected_accounts ?? []).map((account) => ({
    type: account.type,
    name: account.name,
    verified: !!account.verified,
    url: account.metadata?.url ?? account.url ?? null,
    created_at: account.metadata?.created_at ?? null,
    games_count: account.metadata?.game_count ?? account.metadata?.games_count ?? null,
  }));

  const displayStyles = userProfile.display_name_styles ?? profile?.display_name_styles ?? null;

  return {
    bio: resolveProfileBio(profile, member),
    pronouns: resolveProfilePronouns(profile),
    perfil_privado_discord: isDiscordPrivateProfile(profile),
    theme_primary: hexColor(primary),
    theme_accent: hexColor(accent),
    banner_color: hexColor(user?.bannerColor ?? user?.accentColor ?? profile?.user?.banner_color),
    display_name_styles: displayStyles,
    display_font: displayStyles?.font ?? displayStyles?.font_id ?? "gg sans",
    display_effect: displayStyles?.effect ?? displayStyles?.effect_id ?? "Desconhecido",
    display_primary: hexColor(displayStyles?.colors?.[0] ?? displayStyles?.primary_color),
    display_secondary: hexColor(displayStyles?.colors?.[1] ?? displayStyles?.secondary_color),
    server_tag: guildMemberProfile.tag?.name ?? profile?.guild_tag?.name ?? null,
    server_tag_url: guildMemberProfile.tag?.url ?? profile?.guild_tag?.url ?? null,
    connections,
    mutual_guilds: (profile?.mutual_guilds ?? []).map((guild) => ({
      id: guild.id,
      name: guild.name ?? guild.nick ?? "Servidor",
      icon: guild.icon ?? null,
    })),
    mutual_friends_count: profile?.mutual_friends_count ?? profile?.user_profile?.mutual_friends_count ?? null,
  };
}

export {
  extractProfileExtras,
  hexColor,
  isDiscordPrivateProfile,
  resolveProfileBio,
  resolveProfilePronouns,
};
