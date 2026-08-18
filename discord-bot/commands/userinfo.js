import { SlashCommandBuilder } from "discord.js";
import { fetchUserProfile } from "../utils/api.js";
import {
  buildUserInfoComponents,
  buildMainEmbed,
  buildDetailEmbed,
} from "../utils/components.js";

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Mostra informações detalhadas de um usuário.")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuário para consultar")
      .setRequired(false),
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("usuario") ?? interaction.user;

  try {
    if (interaction.guild) {
      await interaction.guild.members.fetch({ limit: 100 }).catch(() => {});
    }

    const profile = await fetchUserProfile(target.id, {
      guildId: interaction.guildId,
      views: 1,
    });

    const embed = buildMainEmbed(profile, interaction.user.username);
    const components = buildUserInfoComponents(profile, interaction.guild);

    await interaction.editReply({
      embeds: [embed],
      components,
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ Não foi possível buscar o perfil: ${error.message}`,
    });
  }
}

export async function showMemberInfo(interaction, memberId) {
  await interaction.deferUpdate();

  try {
    if (interaction.guild) {
      await interaction.guild.members.fetch({ limit: 100 }).catch(() => {});
    }

    const profile = await fetchUserProfile(memberId, {
      guildId: interaction.guildId,
      views: 1,
    });

    const embed = buildMainEmbed(profile, interaction.user.username);
    const components = buildUserInfoComponents(profile, interaction.guild);

    await interaction.editReply({
      embeds: [embed],
      components,
    });
  } catch (error) {
    await interaction.followUp({
      content: `❌ Erro ao buscar membro: ${error.message}`,
      ephemeral: true,
    });
  }
}

export async function showDetail(interaction, type, userId) {
  try {
    const profile = await fetchUserProfile(userId, {
      guildId: interaction.guildId,
    });

    const embed = buildDetailEmbed(type, profile);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ ${error.message}`,
      ephemeral: true,
    });
  }
}
