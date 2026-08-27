/**
 * Insígnias do perfil Discord (profile.badges) + flags.
 * Badges novas do Discord (2026) entram aqui depois.
 */

const PROFILE_BADGE_DEFAULTS = {
  // ── mapa enviado pelo user ─────────────────────────────────
  early_supporter: process.env.BADGE_EMOJI_EARLY_SUPPORTER || "<:EarlySupporter:1067078594863562803>",
  premium_early_supporter: process.env.BADGE_EMOJI_EARLY_SUPPORTER || "<:EarlySupporter:1067078594863562803>",
  verified_developer: process.env.BADGE_EMOJI_VERIFIED_DEV || "<:Badge_Early_VerifiedBotDeveloper:1174406616410497186>",
  early_verified_bot_developer: process.env.BADGE_EMOJI_VERIFIED_DEV || "<:Badge_Early_VerifiedBotDeveloper:1174406616410497186>",
  quest_completed: process.env.BADGE_EMOJI_QUEST || "<:Badge_Completed_a_Quest:1541392759532036179>",
  completed_a_quest: process.env.BADGE_EMOJI_QUEST || "<:Badge_Completed_a_Quest:1541392759532036179>",
  legacy_username: process.env.BADGE_EMOJI_LEGACY_USER || "<:rzlegacy:1122335064894738452>",
  originally_known_as: process.env.BADGE_EMOJI_LEGACY_USER || "<:rzlegacy:1122335064894738452>",
  hypesquad_house_1: process.env.BADGE_EMOJI_HYPESQUAD_1 || "<:BraveryLogo:1067078454526357554>",
  hypesquad_house_2: process.env.BADGE_EMOJI_HYPESQUAD_2 || "<:BrillianceLogo:1067078476751974470>",
  hypesquad_house_3: process.env.BADGE_EMOJI_HYPESQUAD_3 || "<:BalanceLogo:1067078379356029059>",
  active_developer: process.env.BADGE_EMOJI_ACTIVE_DEV || "<:1042433990952497212:1067078961445752913>",

  // ── extras comuns ──────────────────────────────────────────
  hypesquad: process.env.BADGE_EMOJI_HYPESQUAD_EVENTS || "<:Badge_HypeSquad_Events:1531162722647937055>",
  bug_hunter_level_1: process.env.BADGE_EMOJI_BUG_HUNTER || "🐛",
  bug_hunter_level_2: process.env.BADGE_EMOJI_BUG_HUNTER_2 || "🐛",
  certified_moderator: process.env.BADGE_EMOJI_MOD || "🛡️",
  partner: process.env.BADGE_EMOJI_PARTNER || "🤝",
  staff: process.env.BADGE_EMOJI_STAFF || "👨‍💼",
  verified_bot: process.env.BADGE_EMOJI_VERIFIED_BOT || "✅",
  // Orbs / leaf badge (2025+)
  orb_profile_badge: process.env.BADGE_EMOJI_ORB || "<a:Orb_Shine:1414047706485362790>",
  orbs: process.env.BADGE_EMOJI_ORB || "<a:Orb_Shine:1414047706485362790>",
  orb_apprentice: process.env.BADGE_EMOJI_ORB || "<a:Orb_Shine:1414047706485362790>",
};

/** Só nitro/boost tenure — NÃO usar includes("premium") (mata Early Supporter) */
const SKIP_EXACT = new Set(["premium", "nitro", "nitro_subscriber"]);
const SKIP_PREFIXES = ["guild_booster", "premium_tenure"];

function envBadgeKey(badgeId) {
  return `BADGE_EMOJI_${String(badgeId).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function shouldSkipProfileBadge(id) {
  const normalized = String(id || "").toLowerCase();
  if (!normalized) return true;
  if (SKIP_EXACT.has(normalized)) return true;
  return SKIP_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}_`) || normalized.startsWith(prefix),
  );
}

function resolveProfileBadgeEmoji(badge) {
  const id = String(badge?.id ?? "").toLowerCase();
  if (!id || shouldSkipProfileBadge(id)) return null;

  const fromEnv = process.env[envBadgeKey(id)];
  if (fromEnv) return fromEnv;

  if (PROFILE_BADGE_DEFAULTS[id]) return PROFILE_BADGE_DEFAULTS[id];

  for (const [key, emoji] of Object.entries(PROFILE_BADGE_DEFAULTS)) {
    if (id.includes(key) || id.replace(/_/g, "").includes(key.replace(/_/g, ""))) {
      return emoji;
    }
  }

  return badge?.description ? "🏅" : null;
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

export { collectProfileBadges, resolveProfileBadgeEmoji, PROFILE_BADGE_DEFAULTS, shouldSkipProfileBadge };
