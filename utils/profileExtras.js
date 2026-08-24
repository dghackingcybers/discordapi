function hexColor(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.startsWith("#")) return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `#${num.toString(16).padStart(6, "0")}`;
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
    bio: profile?.user?.bio ?? profile?.bio ?? guildMemberProfile.bio ?? null,
    pronouns: profile?.pronouns ?? userProfile.pronouns ?? null,
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
  };
}

export { extractProfileExtras, hexColor };
