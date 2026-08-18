import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  apiUrl: (process.env.API_URL || "https://discordapi-jzd1.onrender.com").replace(/\/$/, ""),
};
