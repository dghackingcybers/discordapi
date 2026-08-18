import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";

const MORE_OPTIONS = [
  { value: "avatar", label: "Avatar", emoji: "🖼️", desc: "Visualize o avatar do usuário." },
  { value: "banner", label: "Banner", emoji: "🏞️", desc: "Visualize o banner do usuário." },
  { value: "boost", label: "Evolução do Impulso", emoji: "🚀", desc: "Progresso das insígnias de boost." },
  { value: "nitro", label: "Evolução do Nitro", emoji: "💎", desc: "Progresso das insígnias de nitro." },
  { value: "bio", label: "Bio/Pronome", emoji: "📝", desc: "Bio e pronome do perfil." },
];

export function buildUserInfoComponents(profile, guild) {
  const targetId = profile.id;

  const moreMenu = new StringSelectMenuBuilder()
    .setCustomId(`ui_more:${targetId}`)
    .setPlaceholder("Mais informações.")
    .addOptions(
      MORE_OPTIONS.map((opt) => ({
        label: opt.label,
        value: opt.value,
        description: opt.desc.slice(0, 100),
        emoji: opt.emoji,
      })),
    );

  const memberOptions = guild?.members?.cache
    ? [...guild.members.cache.values()]
        .filter((m) => !m.user.bot)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 25)
        .map((m) => ({
          label: m.displayName.slice(0, 100),
          value: m.id,
          description: `@${m.user.username}`.slice(0, 100),
        }))
    : [];

  const rows = [new ActionRowBuilder().addComponents(moreMenu)];

  if (memberOptions.length > 0) {
    const membersMenu = new StringSelectMenuBuilder()
      .setCustomId("ui_member")
      .setPlaceholder("Ver informações de outros membros no servidor.")
      .addOptions(memberOptions);

    rows.push(new ActionRowBuilder().addComponents(membersMenu));
  }

  return rows;
}

export function buildDetailEmbed(type, profile) {
  const name = profile.author?.name || profile.tag;

  switch (type) {
    case "avatar":
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Avatar — ${name}`)
        .setImage(profile.avatar_url || profile.thumbnail)
        .setDescription(profile.avatar_url ? `[Abrir imagem](${profile.avatar_url})` : "Sem avatar.");

    case "banner":
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Banner — ${name}`)
        .setDescription(
          profile.banner_url
            ? `[Abrir banner](${profile.banner_url})`
            : "Este usuário não possui banner.",
        )
        .setImage(profile.banner_url || null);

    case "boost": {
      const lines = (profile.emojis_boost || []).map((lvl) => {
        const current = profile.insignia_impulso_atual?.nivel === lvl.nivel ? " **← atual**" : "";
        const emoji = lvl.emoji ?? lvl.emoji_unicode ?? lvl.emoji_display;
        return `${emoji} **${lvl.label}** (nível ${lvl.nivel})${current}`;
      });
      return new EmbedBuilder()
        .setColor(0xeb459e)
        .setTitle(`Evolução do Impulso — ${name}`)
        .setDescription(lines.join("\n") || "Sem dados de boost.")
        .addFields(
          profile.impulsionando_desde
            ? { name: "Impulsionando desde", value: profile.impulsionando_desde.texto, inline: false }
            : { name: "Boost", value: "Usuário não está impulsionando.", inline: false },
        );
    }

    case "nitro": {
      const lines = (profile.emojis_nitro || []).map((lvl) => {
        const current = profile.insignia_nitro_atual?.nivel === lvl.nivel ? " **← atual**" : "";
        const emoji = lvl.emoji ?? lvl.emoji_unicode ?? lvl.emoji_display;
        return `${emoji} **${lvl.label}** (nível ${lvl.nivel})${current}`;
      });
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Evolução do Nitro — ${name}`)
        .setDescription(lines.join("\n") || "Sem dados de nitro.")
        .addFields(
          profile.assinante_nitro_desde
            ? { name: "Nitro desde", value: profile.assinante_nitro_desde.texto, inline: false }
            : { name: "Nitro", value: "Usuário não possui Nitro.", inline: false },
        );
    }

    case "bio":
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Bio/Pronome — ${name}`)
        .addFields(
          { name: "Bio", value: profile.bio || "*Sem bio.*", inline: false },
          { name: "Pronome", value: profile.pronouns || "*Não informado.*", inline: false },
        );

    default:
      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription("Informação não disponível.");
  }
}

export function buildMainEmbed(profile, executorTag) {
  const embed = EmbedBuilder.from(profile.embed);

  if (executorTag) {
    embed.setFooter({
      text: `Comando executado por: ${executorTag} | Visualizações: ${profile.footer?.visualizacoes ?? 0}`,
      iconURL: profile.author?.icon_url,
    });
  }

  return embed;
}
