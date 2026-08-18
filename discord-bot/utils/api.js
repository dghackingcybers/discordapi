import { config } from "../config.js";

export async function fetchUserProfile(userId, options = {}) {
  const params = new URLSearchParams();
  if (options.guildId || config.guildId) {
    params.set("guildId", options.guildId || config.guildId);
  }
  if (options.views) params.set("views", String(options.views));

  const query = params.toString();
  const url = `${config.apiUrl}/user/${userId}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`API retornou ${response.status}`);
  }

  const data = await response.json();
  if (!data?.success) {
    throw new Error(data?.error || "Perfil não encontrado.");
  }

  return data.profile;
}
