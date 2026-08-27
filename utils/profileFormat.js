import {
  resolveBoostBadgeSince,
  resolveGuildBoostSince,
  isBoostingGuild,
  resolveNitroSince,
  resolveHasNitro,
  resolveHasBoost,
} from "./discordData.js";
import { attachEmojiToTier, getBoostLevels, getNitroLevels, getTierEmoji } from "./badgeEmojis.js";
import { buildTierTimeline, BOOST_TIER_NAMES, NITRO_TIER_NAMES } from "./tierTimeline.js";
import { extractProfileExtras, resolveProfileBio, resolveProfilePronouns } from "./profileExtras.js";
import { collectProfileBadges } from "./profileBadges.js";

const NITRO_TIER_MONTHS = [1, 3, 6, 12, 24, 36, 60, 72];
const BOOST_TIER_MONTHS = [1, 2, 3, 6, 9, 12, 15, 18, 24];

/** Bits oficiais UserFlags — corrigido (antes estava mapeado errado e sumia badge) */
const BADGE_MAP = {
  1: { name: "STAFF", emoji: process.env.BADGE_EMOJI_STAFF || "👨‍💼" },
  2: { name: "PARTNER", emoji: process.env.BADGE_EMOJI_PARTNER || "🤝" },
  4: { name: "HYPESQUAD_EVENTS", emoji: process.env.BADGE_EMOJI_HYPESQUAD_EVENTS || "<:Badge_HypeSquad_Events:1531162722647937055>" },
  8: { name: "BUG_HUNTER", emoji: process.env.BADGE_EMOJI_BUG_HUNTER || "🐛" },
  64: { name: "HYPESQUAD_BRAVERY", emoji: process.env.BADGE_EMOJI_HYPESQUAD_1 || "<:BraveryLogo:1067078454526357554>" },
  128: { name: "HYPESQUAD_BRILLIANCE", emoji: process.env.BADGE_EMOJI_HYPESQUAD_2 || "<:BrillianceLogo:1067078476751974470>" },
  256: { name: "HYPESQUAD_BALANCE", emoji: process.env.BADGE_EMOJI_HYPESQUAD_3 || "<:BalanceLogo:1067078379356029059>" },
  512: { name: "EARLY_SUPPORTER", emoji: process.env.BADGE_EMOJI_EARLY_SUPPORTER || "<:EarlySupporter:1067078594863562803>" },
  16384: { name: "BUG_HUNTER_LEVEL_2", emoji: process.env.BADGE_EMOJI_BUG_HUNTER_2 || "🐛" },
  65536: { name: "VERIFIED_BOT", emoji: process.env.BADGE_EMOJI_VERIFIED_BOT || "✅" },
  131072: { name: "EARLY_VERIFIED_BOT_DEVELOPER", emoji: process.env.BADGE_EMOJI_VERIFIED_DEV || "<:Badge_Early_VerifiedBotDeveloper:1174406616410497186>" },
  262144: { name: "CERTIFIED_MODERATOR", emoji: process.env.BADGE_EMOJI_MOD || "🛡️" },
  4194304: { name: "ACTIVE_DEVELOPER", emoji: process.env.BADGE_EMOJI_ACTIVE_DEV || "<:1042433990952497212:1067078961445752913>" },
};

const BADGE_ICONS = {
  nitro: "https://cdn.discordapp.com/badge-icons/2ba85e8022458202676085784aa23e828/2b1f7.png",
  boost: "https://cdn.discordapp.com/badge-icons/914556dc1a39a114738756a4fa4c40/8a4d2.png",
};

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDurationPT(from, to = new Date()) {
  if (!from) return null;

  let start = from instanceof Date ? from : new Date(from);
  let end = to instanceof Date ? to : new Date(to);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return "0 segundos";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  let hours = end.getHours() - start.getHours();
  let minutes = end.getMinutes() - start.getMinutes();
  let seconds = end.getSeconds() - start.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes > 0 && parts.length < 3) {
    parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  }
  if (parts.length === 0) {
    parts.push(`${Math.max(seconds, 0)} ${seconds === 1 ? "segundo" : "segundos"}`);
  }

  return parts.join(" ");
}

function formatDateTimePT(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateField(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const duration = formatDurationPT(d);
  return {
    datetime: formatDateTimePT(d),
    iso: d.toISOString(),
    duracao: duration,
    texto: `${formatDateTimePT(d)} (**${duration}**).`,
  };
}

function getTierProgress(sinceDate, tierMonths) {
  if (!sinceDate) return null;

  const start = sinceDate instanceof Date ? sinceDate : new Date(sinceDate);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  if (now < start) return null;

  let currentIndex = -1;
  for (let i = tierMonths.length - 1; i >= 0; i -= 1) {
    if (now >= addMonths(start, tierMonths[i])) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1) {
    return {
      atual: {
        nivel: 0,
        meses: 0,
        duracao: formatDurationPT(start),
        texto: formatDurationPT(start),
      },
      proxima: {
        nivel: 1,
        meses: tierMonths[0],
        restante: formatDurationPT(now, addMonths(start, tierMonths[0])),
        texto: formatDurationPT(now, addMonths(start, tierMonths[0])),
      },
    };
  }

  const currentTierStart =
    currentIndex === 0 ? start : addMonths(start, tierMonths[currentIndex - 1]);

  const current = {
    nivel: currentIndex + 1,
    meses: tierMonths[currentIndex],
    duracao: formatDurationPT(currentTierStart),
    texto: formatDurationPT(currentTierStart),
    duracao_total: formatDurationPT(start),
  };

  const nextTierMonths = tierMonths[currentIndex + 1];
  if (nextTierMonths == null) {
    return {
      atual: current,
      proxima: {
        nivel: null,
        meses: null,
        restante: null,
        texto: "Nível máximo atingido.",
      },
    };
  }

  const nextTierDate = addMonths(start, nextTierMonths);
  const restante = formatDurationPT(now, nextTierDate);

  return {
    atual: current,
    proxima: {
      nivel: currentIndex + 2,
      meses: nextTierMonths,
      restante,
      texto: restante,
    },
  };
}

const BADGE_ALIASES = {
  HYPESQUAD_BRAVERY: ["HYPESQUAD_HOUSE_1", "HYPESQUAD_BRAVERY"],
  HYPESQUAD_BRILLIANCE: ["HYPESQUAD_HOUSE_2", "HYPESQUAD_BRILLIANCE"],
  HYPESQUAD_BALANCE: ["HYPESQUAD_HOUSE_3", "HYPESQUAD_BALANCE"],
  HYPESQUAD_HOUSE_1: ["HYPESQUAD_HOUSE_1", "HYPESQUAD_BRAVERY"],
  HYPESQUAD_HOUSE_2: ["HYPESQUAD_HOUSE_2", "HYPESQUAD_BRILLIANCE"],
  HYPESQUAD_HOUSE_3: ["HYPESQUAD_HOUSE_3", "HYPESQUAD_BALANCE"],
  EARLY_SUPPORTER: ["EARLY_SUPPORTER"],
  VERIFIED_DEVELOPER: ["VERIFIED_DEVELOPER", "EARLY_VERIFIED_BOT_DEVELOPER"],
  ACTIVE_DEVELOPER: ["ACTIVE_DEVELOPER"],
  QUEST_COMPLETED: ["QUEST_COMPLETED", "COMPLETED_A_QUEST"],
  LEGACY_USERNAME: ["LEGACY_USERNAME"],
};

function getBadges(flags, { hasNitro = false, hasBoost = false, profile = null } = {}) {
  const badges = [];
  const seen = new Set();
  const seenEmojis = new Set();

  const push = (badge) => {
    const key = badge.name || badge.emoji;
    if (!key || seen.has(key)) return;
    if (badge.emoji && seenEmojis.has(badge.emoji)) return;
    const aliases = BADGE_ALIASES[key] || [key];
    if (aliases.some((a) => seen.has(a))) return;
    for (const a of aliases) seen.add(a);
    seen.add(key);
    if (badge.emoji) seenEmojis.add(badge.emoji);
    badges.push(badge);
  };

  if (hasNitro) {
    push({ name: "NITRO", emoji: "💎", icon: BADGE_ICONS.nitro });
  }
  if (hasBoost) {
    push({ name: "BOOST", emoji: "🚀", icon: BADGE_ICONS.boost });
  }

  for (const badge of collectProfileBadges(profile)) {
    push(badge);
  }

  for (const [bit, badge] of Object.entries(BADGE_MAP)) {
    if (flags & Number(bit)) {
      push(badge);
    }
  }

  return badges;
}

function buildAuthorName(user) {
  const globalName = user.globalName || user.global_name || user.displayName || user.display_name;
  const username = user.username;
  if (globalName && globalName !== username) {
    return `${username} (${globalName})`;
  }
  return globalName || username;
}

function resolveBannerUrl(user, profile) {
  const bannerHash =
    user?.banner ??
    profile?.user?.banner ??
    profile?.banner ??
    null;

  if (!bannerHash || !user?.id) return null;

  const extension = String(bannerHash).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${user.id}/${bannerHash}.${extension}?size=4096`;
}

function buildInsigniasTexto(badges, nitroProgress, boostProgress, hasNitro, hasBoost) {
  const parts = [];

  if (hasNitro) {
    const emoji = getTierEmoji(nitroProgress?.atual);
    parts.push(emoji !== "•" ? emoji : "💎");
  }

  if (hasBoost) {
    const emoji = getTierEmoji(boostProgress?.atual);
    parts.push(emoji !== "•" ? emoji : "🚀");
  }

  for (const badge of badges) {
    if (["NITRO", "BOOST"].includes(badge.name)) continue;
    if (badge.emoji && !parts.includes(badge.emoji)) {
      parts.push(badge.emoji);
    }
  }

  return parts.join(" ") || "Nenhuma";
}

function buildProfileCard({ user, member, profile, executor = null, views = 0, guildId = null, customStatus = null }) {
  const flags = user.publicFlags ?? user.public_flags ?? 0;
  const targetGuildId = guildId ?? member?.guild?.id ?? profile?.guild_member?.guild_id ?? null;

  const hasNitro = resolveHasNitro(profile, user);
  const hasBoostBadge = Boolean(resolveBoostBadgeSince(profile));
  const boostingThisGuild = isBoostingGuild(profile, member, targetGuildId);
  const hasBoost = hasBoostBadge || boostingThisGuild;

  const nitroSince = resolveNitroSince(profile, user);
  const boostSince = resolveBoostBadgeSince(profile);
  const guildBoostSince = resolveGuildBoostSince(profile, member, targetGuildId);
  const boostTierSince = boostSince ?? guildBoostSince;

  const createdAt = user.createdAt ?? (user.createdTimestamp ? new Date(user.createdTimestamp) : null);
  const joinedAt = member?.joinedAt ?? member?.joined_at ?? profile?.guild_member?.joined_at ?? null;

  const badges = getBadges(flags, { hasNitro, hasBoost, profile });

  const contaCriada = formatDateField(createdAt);
  const entrouServidor = formatDateField(joinedAt);
  const nitroDesde = formatDateField(nitroSince);
  const impulsionandoDesde = formatDateField(boostSince);
  const impulsionandoServidorDesde = formatDateField(guildBoostSince);

  const nitroProgressRaw = getTierProgress(nitroSince, NITRO_TIER_MONTHS);
  const boostProgressRaw = getTierProgress(boostTierSince, BOOST_TIER_MONTHS);

  const nitroProgress = attachEmojiToTier(nitroProgressRaw, "nitro", profile);
  const boostProgress = attachEmojiToTier(boostProgressRaw, "boost", profile);

  const evolucao_impulso = buildTierTimeline(boostTierSince, BOOST_TIER_MONTHS, BOOST_TIER_NAMES).map((tier, index) => ({
    ...tier,
    ...(getBoostLevels()[index] ?? {}),
  }));

  const evolucao_nitro = buildTierTimeline(nitroSince, NITRO_TIER_MONTHS, NITRO_TIER_NAMES).map((tier, index) => ({
    ...tier,
    ...(getNitroLevels()[index] ?? {}),
  }));

  const extras = extractProfileExtras(profile, user, member);

  const bio = resolveProfileBio(profile, member) ?? extras.bio;
  const pronouns = resolveProfilePronouns(profile) ?? extras.pronouns;
  const statusCustomizado = customStatus ?? null;

  const insigniasTexto = buildInsigniasTexto(badges, nitroProgress, boostProgress, hasNitro, hasBoost);

  const avatarUrl =
    user.displayAvatarURL?.({ extension: "webp", size: 4096 }) ??
    user.displayAvatarURL?.({ extension: "webp", size: 256 }) ??
    user.avatarURL ??
    user.avatar ??
    null;

  const bannerUrl = resolveBannerUrl(user, profile);

  const authorName = buildAuthorName(user);
  const mention = `<@${user.id}>`;

  const card = {
    author: {
      name: authorName,
      icon_url: avatarUrl,
    },
    mention,
    tag: user.username,
    id: user.id,
    thumbnail: avatarUrl,
    insignias: badges,
    insignias_texto: insigniasTexto,
    conta_criada_em: contaCriada,
    entrou_no_servidor_em: entrouServidor,
    assinante_nitro_desde: nitroDesde,
    impulsionando_desde: impulsionandoDesde,
    impulsionando_servidor_desde: impulsionandoServidorDesde,
    impulsiona_servidor_atual: boostingThisGuild,
    impulsiona_globalmente: hasBoostBadge,
    evolucao_impulso,
    evolucao_nitro,
    extras,
    perfil_privado_discord: extras.perfil_privado_discord,
    guild_id_consulta: targetGuildId,
    boost_nivel_maximo: boostProgress?.proxima?.texto === "Nível máximo atingido.",
    insignia_impulso_atual: boostProgress?.atual ?? null,
    proxima_insignia_impulso: boostProgress?.proxima ?? null,
    insignia_nitro_atual: nitroProgress?.atual ?? null,
    proxima_insignia_nitro: nitroProgress?.proxima ?? null,
    emojis_boost: getBoostLevels(),
    emojis_nitro: getNitroLevels(),
    avatar_url: avatarUrl,
    banner_url: bannerUrl,
    bio,
    pronouns,
    status_customizado: statusCustomizado,
    footer: {
      executado_por: executor?.username ?? executor?.tag ?? "Desconhecido",
      visualizacoes: views,
      timestamp: new Date().toISOString(),
    },
  };

  card.embed = buildDiscordEmbed(card);
  return card;
}

function buildDiscordEmbed(card) {
  // Layout limpo estilo Zany: topo curto + datas essenciais + progresso 2x2
  const nbagang = process.env.EMOJI_NBAGANG || "<:nbagang:1542110144161390632>";
  const calendar = process.env.EMOJI_NBACALENDAR || "<:nbacalendar:1542113271941693552>";
  const boostMark = card.insignia_impulso_atual
    ? getTierEmoji(card.insignia_impulso_atual)
    : nbagang;
  const nitroMark = card.insignia_nitro_atual
    ? getTierEmoji(card.insignia_nitro_atual)
    : nbagang;

  const fields = [
    { name: `${nbagang} Menção`, value: card.mention, inline: true },
    { name: `${nbagang} Tag`, value: `\`${card.tag}\``, inline: true },
    { name: `${nbagang} ID`, value: `\`${card.id}\``, inline: true },
    { name: `${nbagang} Insígnias`, value: card.insignias_texto || "—", inline: false },
  ];

  if (card.conta_criada_em) {
    fields.push({
      name: `${calendar} Conta criada em`,
      value: card.conta_criada_em.texto,
      inline: false,
    });
  }

  if (card.assinante_nitro_desde) {
    fields.push({
      name: `${nitroMark} Assinante Nitro desde`,
      value: card.assinante_nitro_desde.texto,
      inline: false,
    });
  }

  if (card.impulsionando_desde) {
    fields.push({
      name: `${boostMark} Impulsionando desde`,
      value: card.impulsionando_desde.texto,
      inline: false,
    });
  }

  if (card.insignia_impulso_atual) {
    const boostEmoji = getTierEmoji(card.insignia_impulso_atual);
    const nextBoostEmoji = getTierEmoji(card.proxima_insignia_impulso);

    fields.push(
      {
        name: "Insígnia de impulso atual",
        value: `${boostEmoji} ${card.insignia_impulso_atual.texto}`,
        inline: true,
      },
      {
        name: "Próxima insígnia de impulso",
        value: card.proxima_insignia_impulso?.texto === "Nível máximo atingido."
          ? `${boostEmoji} ${card.proxima_insignia_impulso.texto}`
          : `${nextBoostEmoji} ${card.proxima_insignia_impulso?.texto ?? "—"}`,
        inline: true,
      },
    );
  }

  if (card.insignia_nitro_atual) {
    const nitroEmoji = getTierEmoji(card.insignia_nitro_atual);
    const nextNitroEmoji = getTierEmoji(card.proxima_insignia_nitro);

    fields.push(
      {
        name: "Insígnia de nitro atual",
        value: `${nitroEmoji} ${card.insignia_nitro_atual.texto}`,
        inline: true,
      },
      {
        name: "Próxima insígnia de nitro",
        value: card.proxima_insignia_nitro?.texto === "Nível máximo atingido."
          ? `${nitroEmoji} ${card.proxima_insignia_nitro.texto}`
          : `${nextNitroEmoji} ${card.proxima_insignia_nitro?.texto ?? "—"}`,
        inline: true,
      },
    );
  }

  return {
    color: 0x702af3,
    author: card.author,
    thumbnail: card.thumbnail ? { url: card.thumbnail } : undefined,
    fields,
    footer: {
      text: `Comando executado por: ${card.footer.executado_por} | Visualizações: ${card.footer.visualizacoes}`,
      icon_url: card.author.icon_url,
    },
    timestamp: card.footer.timestamp,
  };
}

export {
  formatDurationPT,
  formatDateTimePT,
  formatDateField,
  getTierProgress,
  getBadges,
  buildProfileCard,
  buildDiscordEmbed,
  NITRO_TIER_MONTHS,
  BOOST_TIER_MONTHS,
};
