/**
 * Stubs para icons/private — expanda depois com banco de dados se quiser.
 */

async function togglePrivate(userId) {
  void userId;
  return false;
}

async function replyAvatarHistoryInteraction({ interaction, targetUser }) {
  await interaction.reply({
    embeds: [
      {
        color: 0x2f3136,
        description: `Histórico de ícones de **${targetUser.username}** ainda não está disponível nesta versão.\nConfigure a API para registrar avatares antigos.`,
      },
    ],
    ephemeral: true,
  });
}

module.exports = {
  togglePrivate,
  replyAvatarHistoryInteraction,
};
