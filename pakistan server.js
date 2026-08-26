import { Client } from 'discord.js-selfbot-v13';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Criar uma instância do cliente
const client = new Client();

// Obter o token da conta de usuário
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

client.on('ready', () => {
  console.log(`Selfbot logado com sucesso como ${client.user.tag}`);
});

// Função para pegar informações de assinaturas de Nitro e Boost
async function getUserSubscriptions(userId) {
  try {
    const user = await client.users.fetch(userId);  // Buscando usuário pelo ID

    // Obter status do Nitro e Boost
    const hasNitro = user.premiumType && user.premiumType !== 0; // Nitro Classic ou Nitro
    const hasBoost = user.premium_since !== null; // Boost ativo

    // Verificar data do Boost e formatar corretamente
    const boostSince = hasBoost ? new Date(user.premium_since).toLocaleString() : "Desconhecido";

    const userInfo = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.displayAvatarURL(),
      global_name: user.username,  // Nome global
      display_name: user.username,  // Nome de exibição
      nitro_status: hasNitro ? "Tem Nitro" : "Não tem Nitro",
      boost_status: hasBoost ? "Tem Boost" : "Não tem Boost",
      boost_since: boostSince,
      public_flags: user.publicFlags || null,  // Flags públicas, se disponíveis
    };

    return userInfo;
  } catch (error) {
    console.error("Erro ao acessar dados do usuário:", error);
  }
}

// Função para pegar atividades e status de presença (bio, pronome)
async function getUserPresence(userId) {
  try {
    const user = await client.users.fetch(userId);  // Buscando usuário pelo ID

    const presence = user.presence || null;
    let activities = [];
    let discordStatus = "offline";
    let listeningToSpotify = false;

    if (presence) {
      // Status de presença (idle, online, etc)
      discordStatus = presence.status;

      // Atividades (incluindo status customizado)
      activities = presence.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        state: activity.state || "Sem estado",
        details: activity.details || "Sem detalhes",
        emoji: activity.emoji || null,
        session_id: activity.session_id,
        created_at: activity.startTimestamp || Date.now(),
      }));

      // Verificar se está ouvindo Spotify
      listeningToSpotify = presence.activities.some(activity => activity.name === "Spotify");

    }

    const presenceInfo = {
      discord_status: discordStatus,
      activities: activities,
      active_on_discord_web: presence?.clientStatus?.web || false,
      active_on_discord_desktop: presence?.clientStatus?.desktop || false,
      active_on_discord_mobile: presence?.clientStatus?.mobile || false,
      listening_to_spotify: listeningToSpotify,
      spotify: null,  // Spotify pode ser adicionado se houver atividade de Spotify
    };

    return presenceInfo;
  } catch (error) {
    console.error("Erro ao acessar presença do usuário:", error);
  }
}

// Função principal para compilar as informações como na API do Lanyard
async function getUserInfo(userId) {
  try {
    const userSubscriptions = await getUserSubscriptions(userId);
    const userPresence = await getUserPresence(userId);

    const userData = {
      data: {
        kv: {},  // Pode ser preenchido com outros dados, se necessário
        discord_user: userSubscriptions,
        activities: userPresence.activities,
        discord_status: userPresence.discord_status,
        active_on_discord_web: userPresence.active_on_discord_web,
        active_on_discord_desktop: userPresence.active_on_discord_desktop,
        active_on_discord_mobile: userPresence.active_on_discord_mobile,
        listening_to_spotify: userPresence.listening_to_spotify,
        spotify: userPresence.spotify,
      },
      success: true,
    };

    console.log(userData);  // Exibe os dados no console

    return userData;
  } catch (error) {
    console.error("Erro ao compilar informações do usuário:", error);
  }
}

// Defina o ID do usuário que você deseja consultar
const userId = '233287596812402689';  // Substitua pelo ID do usuário que você deseja consultar
getUserInfo(userId);

// Fazer login no Discord com o token da conta do usuário
client.login(DISCORD_TOKEN);