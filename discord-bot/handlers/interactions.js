import * as userinfo from "../commands/userinfo.js";

export async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "userinfo") {
      return userinfo.execute(interaction);
    }
    return;
  }

  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === "ui_member") {
    const memberId = interaction.values[0];
    return userinfo.showMemberInfo(interaction, memberId);
  }

  if (interaction.customId.startsWith("ui_more:")) {
    const userId = interaction.customId.split(":")[1];
    const type = interaction.values[0];
    return userinfo.showDetail(interaction, type, userId);
  }
}
