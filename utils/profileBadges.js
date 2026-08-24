/**
 * Insígnias do perfil Discord (profile.badges) + flags antigas.
 * Emojis custom: BADGE_EMOJI_QUEST, BADGE_EMOJI_ACTIVE_DEV, etc. no .env / Render
 */

const PROFILE_BADGE_DEFAULTS = {
  quest_completed: process.env.BADGE_EMOJI_QUEST || "<:Badge_Completed_a_Quest:1541392759532036179>",
  completed_a_quest: process.env.BADGE_EMOJI_QUEST || "<:Badge_Completed_a_Quest:1541392759532036179>",
  hypesquad_house_1: process.env.BADGE_EMOJI_HYPESQUAD_1 || "🔶",
  hypesquad_house_2: process.env.BADGE_EMOJI_HYPESQUAD_2 || "🔥",
  hypesquad_house_3: process.env.BADGE_EMOJI_HYPESQUAD_3 || "💚",
  active_developer: process.env.BADGE_EMOJI_ACTIVE_DEV || "🖥️",
  premium_early_supporter: process.env.BADGE_EMOJI_EARLY_SUPPORTER || "<:EarlySupporter:1067078594863562803>",
  early_supporter: process.env.BADGE_EMOJI_EARLY_SUPPORTER || "<:EarlySupporter:1067078594863562803>",
  verified_developer: process.env.BADGE_EMOJI_VERIFIED_DEV || "🛠️",
  bug_hunter_level_1: process.env.BADGE_EMOJI_BUG_HUNTER || "🐛",
  bug_hunter_level_2: process.env.BADGE_EMOJI_BUG_HUNTER_2 || "🐛",
  certified_moderator: process.env.BADGE_EMOJI_MOD || "🛡️",
  legacy_username: process.env.BADGE_EMOJI_LEGACY_USER || "📛",
  originally_known_as: process.env.BADGE_EMOJI_LEGACY_USER || "📛",
};

const SKIP_PROFILE_BADGE_IDS = [
  "guild_booster",
  "guild_booster_lvl",
  "premium_tenure",
  "subscriber",
];

function envBadgeKey(badgeId) {
  return `BADGE_EMOJI_${String(badgeId).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function shouldSkipProfileBadge(id) {
  const normalized = String(id || "").toLowerCase();
  return SKIP_PROFILE_BADGE_IDS.some((prefix) => normalized.includes(prefix));
}

function resolveProfileBadgeEmoji(badge) {
  const id = String(badge?.id ?? "").toLowerCase();
  if (!id || shouldSkipProfileBadge(id)) return null;

  const fromEnv = process.env[envBadgeKey(id)];
  if (fromEnv) return fromEnv;

  if (PROFILE_BADGE_DEFAULTS[id]) return PROFILE_BADGE_DEFAULTS[id];

  for (const [key, emoji] of Object.entries(PROFILE_BADGE_DEFAULTS)) {
    if (id.includes(key)) return emoji;
  }

  return badge?.description ? `🏅` : null;
}

function collectProfileBadges(profile) {
  const raw = profile?.badges ?? profile?.user?.badges ?? profile?.user_profile?.badges ?? [];
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const result = [];

  for (const badge of raw) {
    const id = String(badge?.id ?? "").toLowerCase();
    if (!id || seen.has(id)) continue;

    const emoji = resolveProfileBadgeEmoji(badge);
    if (!emoji) continue;

    seen.add(id);
    result.push({
      name: id.toUpperCase(),
      emoji,
      source: "profile",
      description: badge.description ?? null,
    });
  }

  return result;
}

export { collectProfileBadges, resolveProfileBadgeEmoji, PROFILE_BADGE_DEFAULTS };
