const BOOST_ICON_HASH = "914556dc1a39a114738756a4fa4c40";
const NITRO_ICON_HASH = "2ba85e8022458202676085784aa23e828";

/** Ícones oficiais do Discord — 1 insígnia por nível de boost */
const BOOST_LEVELS = [
  { nivel: 1, meses: 1, suffix: "8a4d2", label: "1 mês" },
  { nivel: 2, meses: 2, suffix: "011f4", label: "2 meses" },
  { nivel: 3, meses: 3, suffix: "96c6a", label: "3 meses" },
  { nivel: 4, meses: 6, suffix: "012f4", label: "6 meses" },
  { nivel: 5, meses: 9, suffix: "01293", label: "9 meses" },
  { nivel: 6, meses: 12, suffix: "01283", label: "12 meses" },
  { nivel: 7, meses: 15, suffix: "01225", label: "15 meses" },
  { nivel: 8, meses: 18, suffix: "01274", label: "18 meses" },
  { nivel: 9, meses: 24, suffix: "012eb", label: "24 meses" },
];

/** Ícones oficiais do Discord — 1 insígnia por nível de nitro */
const NITRO_LEVELS = [
  { nivel: 1, meses: 1, suffix: "2b1f7", label: "1 mês" },
  { nivel: 2, meses: 3, suffix: "6a2dd", label: "3 meses" },
  { nivel: 3, meses: 6, suffix: "948f4", label: "6 meses" },
  { nivel: 4, meses: 12, suffix: "42885", label: "12 meses" },
  { nivel: 5, meses: 24, suffix: "16191", label: "24 meses" },
  { nivel: 6, meses: 36, suffix: "8fac9", label: "36 meses" },
  { nivel: 7, meses: 60, suffix: "4f235", label: "60 meses" },
  { nivel: 8, meses: 72, suffix: "87159", label: "72 meses" },
];

/** Emojis custom de boost (mapa do user) */
const BOOST_EMOJI_DEFAULTS = {
  1: "<:boost1month:1099752190182182962>",
  2: "<:boost2month:1099751907695788123>",
  3: "<:boost3month:1099751866436419604>",
  4: "<:boost6month:1099751803794497687>",
  5: "<:boost9month:1099751751936127076>",
  6: "<:boost12month:1099751676178604192>",
  7: "<:boost15month:1099751703735193640>",
  8: "<:boost18month:1099751723964305468>",
  9: "<:boost24month:1099752177322442772>",
};

/** Emojis custom de nitro (mapa do user) */
const NITRO_EMOJI_DEFAULTS = {
  1: "<:nitrobronze:1320372278420180993>",
  2: "<:nitrosilver:1320372281654116405>",
  3: "<:Badge_Nitro_Gold_6_Months:1320372697112379516>",
  4: "<:nitroplatinum:1320372272091103253>",
  5: "<:nitrodiamond:1320372276201521184>",
  6: "<:nitroemerald:1320372273332355083>",
  7: "<:nitroruby:1320372280303419434>",
  8: "<:nitrofire:1320372275182305381>",
};

const BOOST_UNICODE = ["🔺", "🔷", "⬡", "🔶", "🟣", "⭐", "✨", "🔮", "💎"];
const NITRO_UNICODE = ["🌑", "🌒", "🌓", "🌔", "🌕", "💚", "❤️", "🩷"];

function badgeIconUrl(hash, suffix) {
  return `https://cdn.discordapp.com/badge-icons/${hash}/${suffix}.png`;
}

function loadCustomEmojis(prefix, total, defaults = {}) {
  const emojis = { ...defaults };
  for (let i = 1; i <= total; i += 1) {
    const value = process.env[`${prefix}_${i}`];
    if (value) emojis[i] = value;
  }
  return emojis;
}

let customBoostEmojis = null;
let customNitroEmojis = null;

function getCustomBoostEmojis() {
  if (!customBoostEmojis) {
    customBoostEmojis = loadCustomEmojis("BOOST_EMOJI", 9, BOOST_EMOJI_DEFAULTS);
  }
  return customBoostEmojis;
}

function getCustomNitroEmojis() {
  if (!customNitroEmojis) {
    customNitroEmojis = loadCustomEmojis("NITRO_EMOJI", 8, NITRO_EMOJI_DEFAULTS);
  }
  return customNitroEmojis;
}

function buildLevelEntry(levelDef, hash, customEmojis, unicodeMap) {
  const iconUrl = badgeIconUrl(hash, levelDef.suffix);
  const customEmoji = customEmojis[levelDef.nivel] ?? null;
  const emojiUnicode = unicodeMap[levelDef.nivel - 1] ?? "💎";

  return {
    nivel: levelDef.nivel,
    meses: levelDef.meses,
    label: levelDef.label,
    icon_url: iconUrl,
    emoji: customEmoji,
    emoji_unicode: emojiUnicode,
    emoji_display: customEmoji ?? emojiUnicode,
  };
}

function getBoostLevels() {
  return BOOST_LEVELS.map((level) =>
    buildLevelEntry(level, BOOST_ICON_HASH, getCustomBoostEmojis(), BOOST_UNICODE),
  );
}

function getNitroLevels() {
  return NITRO_LEVELS.map((level) =>
    buildLevelEntry(level, NITRO_ICON_HASH, getCustomNitroEmojis(), NITRO_UNICODE),
  );
}

function getLevelByNumber(levels, nivel) {
  if (!nivel || nivel < 1) return levels[0] ?? null;
  return levels.find((item) => item.nivel === nivel) ?? levels[levels.length - 1] ?? null;
}

function parseBadgeLevelFromProfile(profile, type) {
  const badges = profile?.badges ?? profile?.user?.badges ?? [];

  const match = badges.find((badge) => {
    const id = String(badge?.id ?? "").toLowerCase();
    if (type === "boost") return id.includes("guild_booster");
    return (
      id.includes("premium_tenure") ||
      id === "premium" ||
      id.includes("nitro")
    );
  });

  if (!match?.id) return null;

  const id = String(match.id).toLowerCase();
  const lvlMatch = id.match(/lvl(\d+)/i);
  if (lvlMatch) {
    const level = Number(lvlMatch[1]);
    return Number.isFinite(level) ? level : null;
  }

  // premium_tenure_6_month / premium_tenure_24_month_v2
  const monthMatch = id.match(/(\d+)_month/);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    if (!Number.isFinite(months)) return null;
    const tiers = type === "boost" ? BOOST_LEVELS : NITRO_LEVELS;
    let best = 1;
    for (const tier of tiers) {
      if (months >= tier.meses) best = tier.nivel;
    }
    return best;
  }

  return null;
}

function attachEmojiToTier(tierData, type, profile = null) {
  if (!tierData) return null;

  const levels = type === "boost" ? getBoostLevels() : getNitroLevels();
  const profileLevel = parseBadgeLevelFromProfile(profile, type);

  const enrich = (entry, fallbackLevel) => {
    if (!entry) return entry;
    const levelInfo = getLevelByNumber(levels, entry.nivel || fallbackLevel || 1);
    if (!levelInfo) return entry;

    return {
      ...entry,
      ...levelInfo,
      texto: entry.texto ?? entry.duracao ?? entry.restante ?? null,
      emoji_display: levelInfo.emoji ?? levelInfo.emoji_unicode,
    };
  };

  return {
    atual: enrich(tierData.atual, profileLevel),
    proxima: tierData.proxima?.texto === "Nível máximo atingido."
      ? {
          ...tierData.proxima,
          ...getLevelByNumber(levels, levels.length),
          texto: "Nível máximo atingido.",
          emoji_display: getLevelByNumber(levels, levels.length)?.emoji_display,
        }
      : enrich(tierData.proxima, (tierData.atual?.nivel ?? profileLevel ?? 0) + 1),
  };
}

function getTierEmoji(tier) {
  if (!tier) return "•";
  return tier.emoji_display ?? tier.emoji ?? tier.emoji_unicode ?? "•";
}

export {
  BOOST_LEVELS,
  NITRO_LEVELS,
  BOOST_EMOJI_DEFAULTS,
  NITRO_EMOJI_DEFAULTS,
  getBoostLevels,
  getNitroLevels,
  getLevelByNumber,
  attachEmojiToTier,
  getTierEmoji,
  badgeIconUrl,
};
