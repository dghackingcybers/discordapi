import { Client, Events, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { config } from "./config.js";
import { handleInteraction } from "./handlers/interactions.js";

dotenv.config();

if (!config.token) {
  console.error("❌ DISCORD_BOT_TOKEN não definido no .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot online como ${readyClient.user.tag}`);
  console.log(`🔗 API: ${config.apiUrl}`);
});

client.on(Events.InteractionCreate, handleInteraction);

client.login(config.token);
