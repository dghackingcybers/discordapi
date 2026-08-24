import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const MAX_PER_USER = 200;

let store = null;

function defaultStore() {
  return {
    messages: {},
    deleted_messages: {},
    calls: {},
    username_history: {},
    display_name_history: {},
    guilds_seen: {},
  };
}

function loadStore() {
  if (store) return store;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STORE_FILE)) {
      store = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      return store;
    }
  } catch {
    // recria store
  }

  store = defaultStore();
  return store;
}

function saveStore() {
  if (!store) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch {
    // ignora falha de escrita
  }
}

function pushEntry(bucket, userId, entry) {
  loadStore();
  if (!store[bucket][userId]) store[bucket][userId] = [];
  store[bucket][userId].unshift(entry);
  if (store[bucket][userId].length > MAX_PER_USER) {
    store[bucket][userId] = store[bucket][userId].slice(0, MAX_PER_USER);
  }
  saveStore();
}

function pushNameHistory(bucket, userId, name) {
  if (!name) return;
  loadStore();
  const list = store[bucket][userId] ?? [];
  if (list[0]?.name === name) return;
  pushEntry(bucket, userId, { name, at: Date.now() });
}

function recordMessage(message, { deleted = false } = {}) {
  if (!message?.author?.id || message.author.bot) return;

  const entry = {
    id: message.id,
    content: (message.content || "").slice(0, 500),
    channelId: message.channel?.id ?? null,
    channelName: message.channel?.name ?? "DM",
    guildId: message.guild?.id ?? null,
    guildName: message.guild?.name ?? "DM",
    at: message.createdTimestamp ?? Date.now(),
    link: message.guild
      ? `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`
      : null,
  };

  pushEntry(deleted ? "deleted_messages" : "messages", message.author.id, entry);
  pushNameHistory("username_history", message.author.id, message.author.username);
  pushNameHistory(
    "display_name_history",
    message.author.id,
    message.member?.displayName ?? message.author.globalName ?? message.author.username,
  );

  if (message.guild?.id) {
    pushEntry("guilds_seen", message.author.id, {
      id: message.guild.id,
      name: message.guild.name,
      vanity_url_code: message.guild.vanityURLCode ?? null,
      at: Date.now(),
    });
  }
}

function recordVoiceUpdate(oldState, newState) {
  const userId = newState?.id ?? oldState?.id;
  if (!userId) return;

  const joined = !oldState?.channelId && newState?.channelId;
  const left = oldState?.channelId && !newState?.channelId;
  if (!joined && !left) return;

  const channel = newState.channel ?? oldState.channel;
  const guild = newState.guild ?? oldState.guild;
  if (!channel || !guild) return;

  const members = channel.members
    ? [...channel.members.values()].map((member) => ({
        id: member.id,
        username: member.user?.username,
        tag: member.user?.tag,
      }))
    : [];

  pushEntry("calls", userId, {
    type: joined ? "join" : "leave",
    channelId: channel.id,
    channelName: channel.name,
    guildId: guild.id,
    guildName: guild.name,
    members,
    at: Date.now(),
  });

  pushEntry("guilds_seen", userId, {
    id: guild.id,
    name: guild.name,
    vanity_url_code: guild.vanityURLCode ?? null,
    at: Date.now(),
  });
}

function recordUserUpdate(oldUser, newUser) {
  if (!newUser?.id) return;
  if (oldUser?.username && oldUser.username !== newUser.username) {
    pushNameHistory("username_history", newUser.id, newUser.username);
  }
  const oldDisplay = oldUser?.globalName ?? oldUser?.username;
  const newDisplay = newUser.globalName ?? newUser.username;
  if (oldDisplay && oldDisplay !== newDisplay) {
    pushNameHistory("display_name_history", newUser.id, newDisplay);
  }
}

function getUserLogs(userId, type, page = 0, pageSize = 10) {
  loadStore();
  const bucket = store[type]?.[userId] ?? [];
  const start = page * pageSize;
  const items = bucket.slice(start, start + pageSize);

  if (type === "guilds_seen") {
    const unique = new Map();
    for (const item of bucket) {
      if (!unique.has(item.id)) unique.set(item.id, item);
    }
    const all = [...unique.values()];
    return {
      total: all.length,
      page,
      pageSize,
      items: all.slice(start, start + pageSize),
    };
  }

  return {
    total: bucket.length,
    page,
    pageSize,
    items,
  };
}

export {
  loadStore,
  recordMessage,
  recordVoiceUpdate,
  recordUserUpdate,
  getUserLogs,
};
