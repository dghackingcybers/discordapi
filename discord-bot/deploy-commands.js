import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { config } from "./config.js";
import { data as userinfoData } from "./commands/userinfo.js";

dotenv.config();

if (!config.token || !config.clientId || !config.guildId) {
  console.error("❌ Defina DISCORD_BOT_TOKEN, CLIENT_ID e GUILD_ID no .env");
  process.exit(1);
}

const commands = [userinfoData.toJSON()];

const rest = new REST({ version: "10" }).setToken(config.token);

try {
  console.log("Registrando comando /userinfo...");

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });
  console.log(`✅ Comando registrado no servidor ${config.guildId}`);
} catch (error) {
  console.error("❌ Erro ao registrar comandos:", error);
  process.exit(1);
}
