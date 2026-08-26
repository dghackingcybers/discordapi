const Discord = require("discord.js");
const config = require("../../config");

async function fetchProfile(userId, guildId) {
  const apiUrl = (config.apiUrl || process.env.API_URL || "https://discordapi-jzd1.onrender.com").replace(/\/$/, "");
  const params = new URLSearchParams({ views: "1" });
  if (guildId || config.guildId) params.set("guildId", guildId || config.guildId);

  const response = await fetch(`${apiUrl}/user/${userId}?${params.toString()}`, {
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`API retornou status ${response.status}`);
  }

  const data = await response.json();
  if (!data?.success || !data?.profile) {
    throw new Error(data?.error || "Perfil não encontrado.");
  }

  return data.profile;
}

async function getUserinfoEmbed(user, guildId, executorTag) {
  const profile = await fetchProfile(user.id, guildId);
  const embed = Discord.EmbedBuilder.from(profile.embed);

  if (executorTag) {
    embed.setFooter({
      text: `Comando executado por: ${executorTag} | Visualizações: ${profile.footer?.visualizacoes ?? 0}`,
      iconURL: profile.author?.icon_url,
    });
  }

  return { profile, embed };
}

function buildUserinfoComponents(profile, guild) {
  const targetId = profile.id;

  const moreMenu = new Discord.StringSelectMenuBuilder()
    .setCustomId(`ui_more:${targetId}`)
    .setPlaceholder("Mais informações.")
    .addOptions([
      { label: "Avatar", value: "avatar", description: "Visualize o avatar.", emoji: "🖼️" },
      { label: "Banner", value: "banner", description: "Visualize o banner.", emoji: "🏞️" },
      { label: "Evolução do Impulso", value: "boost", description: "Insígnias de boost.", emoji: "🚀" },
      { label: "Evolução do Nitro", value: "nitro", description: "Insígnias de nitro.", emoji: "💎" },
      { label: "Bio/Pronome", value: "bio", description: "Bio e pronome.", emoji: "📝" },
    ]);

  const rows = [new Discord.ActionRowBuilder().addComponents(moreMenu)];

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

  if (memberOptions.length > 0) {
    const membersMenu = new Discord.StringSelectMenuBuilder()
      .setCustomId("ui_member")
      .setPlaceholder("Ver informações de outros membros no servidor.")
      .addOptions(memberOptions);

    rows.push(new Discord.ActionRowBuilder().addComponents(membersMenu));
  }

  return rows;
}

function buildDetailEmbed(type, profile) {
  const name = profile.author?.name || profile.tag;

  switch (type) {
    case "avatar":
      return new Discord.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Avatar — ${name}`)
        .setImage(profile.avatar_url || profile.thumbnail)
        .setDescription(profile.avatar_url ? `[Abrir imagem](${profile.avatar_url})` : "Sem avatar.");

    case "banner":
      return new Discord.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Banner — ${name}`)
        .setDescription(profile.banner_url ? `[Abrir banner](${profile.banner_url})` : "Sem banner.")
        .setImage(profile.banner_url || null);

    case "boost": {
      const lines = (profile.emojis_boost || []).map((lvl) => {
        const emoji = lvl.emoji || lvl.emoji_unicode || "•";
        const current = profile.insignia_impulso_atual?.nivel === lvl.nivel ? " **← atual**" : "";
        return `${emoji} **${lvl.label}** (nível ${lvl.nivel})${current}`;
      });
      return new Discord.EmbedBuilder()
        .setColor(0xeb459e)
        .setTitle(`Evolução do Impulso — ${name}`)
        .setDescription(lines.join("\n") || "Sem boost.")
        .addFields(
          profile.impulsionando_desde
            ? { name: "Impulsionando desde", value: profile.impulsionando_desde.texto }
            : { name: "Boost", value: "Não impulsiona." },
        );
    }

    case "nitro": {
      const lines = (profile.emojis_nitro || []).map((lvl) => {
        const emoji = lvl.emoji || lvl.emoji_unicode || "•";
        const current = profile.insignia_nitro_atual?.nivel === lvl.nivel ? " **← atual**" : "";
        return `${emoji} **${lvl.label}** (nível ${lvl.nivel})${current}`;
      });
      return new Discord.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Evolução do Nitro — ${name}`)
        .setDescription(lines.join("\n") || "Sem nitro.")
        .addFields(
          profile.assinante_nitro_desde
            ? { name: "Nitro desde", value: profile.assinante_nitro_desde.texto }
            : { name: "Nitro", value: "Não possui Nitro." },
        );
    }

    case "bio":
      return new Discord.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Bio/Pronome — ${name}`)
        .addFields(
          { name: "Bio", value: profile.bio || "*Sem bio.*" },
          { name: "Pronome", value: profile.pronouns || "*Não informado.*" },
        );

    default:
      return new Discord.EmbedBuilder().setColor(0x5865f2).setDescription("Indisponível.");
  }
}

async function handleUserinfoSelect(interaction) {
  if (interaction.customId === "ui_member") {
    await interaction.deferUpdate();
    const memberId = interaction.values[0];
    const user = await interaction.client.users.fetch(memberId);
    const { profile, embed } = await getUserinfoEmbed(user, interaction.guildId, interaction.user.username);
    const components = buildUserinfoComponents(profile, interaction.guild);
    return interaction.editReply({ embeds: [embed], components });
  }

  if (interaction.customId.startsWith("ui_more:")) {
    const userId = interaction.customId.split(":")[1];
    const type = interaction.values[0];
    const profile = await fetchProfile(userId, interaction.guildId);
    const embed = buildDetailEmbed(type, profile);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

module.exports = {
  fetchProfile,
  getUserinfoEmbed,
  buildUserinfoComponents,
  buildDetailEmbed,
  handleUserinfoSelect,
};
