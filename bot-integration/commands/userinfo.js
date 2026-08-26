const Discord = require("discord.js");
const config = require("../../config");
const {
  getUserinfoEmbed,
  buildUserinfoComponents,
  handleUserinfoSelect,
} = require("../../utils/userinfo");
const { togglePrivate, replyAvatarHistoryInteraction } = require("../../utils/avatarHistory");

const prefix = config.prefix?.[0] || "!";

module.exports = {
  name: "userinfo",
  description: "Pegar informações de usuários.",
  dm_permission: false,
  options: [
    {
      name: "usuário",
      description: "Usuário para pegar as informações.",
      type: Discord.ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: "ação",
      description: "icons = avatares antigos | private = privar perfil",
      type: Discord.ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "icons", value: "icons" },
        { name: "private", value: "private" },
      ],
    },
  ],
  run: async (client, interaction) => {
    const action = interaction.options.getString("ação");

    if (action === "private") {
      const enabled = await togglePrivate(interaction.user.id);

      return interaction.reply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor("#2f3136")
            .setDescription(
              enabled
                ? "Seu perfil foi **privado**. Outros usuários verão o aviso de privacidade ao consultar suas informações."
                : "Seu perfil foi **desprivado**. Seu histórico de ícones voltou a ficar visível para outros usuários.",
            ),
        ],
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("usuário") || interaction.user;

    if (action === "icons") {
      return replyAvatarHistoryInteraction({
        interaction,
        executor: interaction.user,
        targetUser: user,
        prefix,
        config,
      });
    }

    try {
      await interaction.deferReply();

      if (interaction.guild) {
        await interaction.guild.members.fetch({ limit: 100 }).catch(() => {});
      }

      const { profile, embed } = await getUserinfoEmbed(
        user,
        interaction.guildId,
        interaction.user.username,
      );

      const components = buildUserinfoComponents(profile, interaction.guild);

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      console.error("[userinfo]", error);

      const content = `Ocorreu um erro ao buscar as informações do usuário.\n\`${error.message}\``;

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [], components: [] });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  },
};

module.exports.handleUserinfoSelect = handleUserinfoSelect;
