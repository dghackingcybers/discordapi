/**
 * public_flags via Bot token (GET /users/:id) — mais confiável que o cache do selfbot.
 */

async function fetchBotUserFlags(userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !userId) return null;

  try {
    const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!response.ok) {
      console.warn("⚠️ Bot GET /users falhou:", response.status);
      return null;
    }

    const data = await response.json();
    return {
      public_flags: Number(data.public_flags ?? 0) || 0,
      id: data.id,
      username: data.username,
      global_name: data.global_name,
      avatar: data.avatar,
      banner: data.banner,
      accent_color: data.accent_color,
      premium_type: data.premium_type ?? null,
    };
  } catch (error) {
    console.warn("⚠️ fetchBotUserFlags:", error.message);
    return null;
  }
}

export { fetchBotUserFlags };
