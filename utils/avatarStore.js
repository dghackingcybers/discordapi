import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const AVATARS_FILE = path.join(DATA_DIR, "avatars.json");
const MAX_ICONS_PER_USER = 500;
const BOOTSTRAP_CONCURRENCY = 6;

let avatarDb = null;
const userLocks = new Map();

function defaultAvatarDb() {
  return { users: {}, archivedIndex: {} };
}

function loadAvatarDb() {
  if (avatarDb) return avatarDb;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(AVATARS_FILE)) {
      avatarDb = JSON.parse(fs.readFileSync(AVATARS_FILE, "utf8"));
      if (!avatarDb.users) avatarDb.users = {};
      if (!avatarDb.archivedIndex) avatarDb.archivedIndex = {};
      return avatarDb;
    }
  } catch {
    // recria
  }

  avatarDb = defaultAvatarDb();
  return avatarDb;
}

function saveAvatarDb() {
  if (!avatarDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AVATARS_FILE, JSON.stringify(avatarDb, null, 2));
  } catch {
    // ignora falha de escrita (Render ephemeral disk)
  }
}

function normalizeHash(userOrHash) {
  if (typeof userOrHash === "string") {
    const value = userOrHash.trim();
    if (!value || value === "null" || value === "undefined") return "default";
    return value;
  }
  const raw = userOrHash?.avatar ?? userOrHash?.avatarHash ?? null;
  if (!raw) return "default";
  return String(raw);
}

function buildAvatarUrl(userId, hash) {
  if (!hash || hash === "default") {
    return `https://cdn.discordapp.com/embed/avatars/0.png`;
  }
  const extension = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${extension}?size=4096`;
}

function displayImageUrl(entry) {
  return entry.archiveUrl || entry.url || buildAvatarUrl(entry.userId, entry.hash);
}

function dedupeEntries(entries) {
  const byHash = new Map();

  for (const entry of entries) {
    const hash = normalizeHash(entry.hash);
    const existing = byHash.get(hash);
    if (!existing) {
      byHash.set(hash, entry);
      continue;
    }
    if (!existing.archiveUrl && entry.archiveUrl) {
      byHash.set(hash, {
        ...entry,
        detectedAt: Math.min(existing.detectedAt || Date.now(), entry.detectedAt || Date.now()),
      });
    }
  }

  return [...byHash.values()].sort((a, b) => (a.detectedAt || 0) - (b.detectedAt || 0));
}

async function withUserLock(userId, fn) {
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  userLocks.set(userId, previous.then(() => gate));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === gate) userLocks.delete(userId);
  }
}

async function downloadAvatarBuffer(url) {
  const response = await fetch(url, { timeout: 20000 });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function archiveRegistryKey(userId, hash) {
  return `${userId}:${normalizeHash(hash)}`;
}

function getArchivedRecord(userId, hash) {
  loadAvatarDb();
  return avatarDb.archivedIndex[archiveRegistryKey(userId, hash)] ?? null;
}

function markArchivedRecord(userId, hash, data) {
  loadAvatarDb();
  avatarDb.archivedIndex[archiveRegistryKey(userId, hash)] = {
    ...data,
    hash: normalizeHash(hash),
    userId,
    at: data?.at ?? Date.now(),
  };
  saveAvatarDb();
}

async function archiveAvatarToChannel(user, hash, sourceUrl) {
  const channelId = process.env.ARCHIVE_CHANNEL_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !botToken || !hash || hash === "default") return null;

  const normalizedHash = normalizeHash(hash);
  const existingRecord = getArchivedRecord(user.id, normalizedHash);
  if (existingRecord?.archiveUrl) {
    return { ...existingRecord, reused: true };
  }

  const url = sourceUrl || buildAvatarUrl(user.id, normalizedHash);
  const buffer = await downloadAvatarBuffer(url);
  if (!buffer?.length) return null;

  const extension = hash.startsWith("a_") ? "gif" : "png";
  const filename = `${user.id}_${hash.slice(0, 10)}.${extension}`;

  const payload = {
    content: `-# ${user.username || user.globalName || "user"} (\`${user.id}\`) | \`${hash}\``,
  };

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([buffer]), filename);

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: form,
    });

    if (!response.ok) return null;

    const message = await response.json();
    const attachment = message.attachments?.[0];
    if (!attachment?.url) return null;

    const result = {
      archiveUrl: attachment.url,
      archiveMessageId: message.id,
      archiveChannelId: channelId,
    };

    markArchivedRecord(user.id, normalizedHash, result);
    return result;
  } catch {
    return null;
  }
}

function getUserEntries(userId) {
  loadAvatarDb();
  const list = avatarDb.users[userId] ?? [];
  return dedupeEntries(list.map((entry) => ({ ...entry, userId })));
}

function writeUserEntries(userId, entries) {
  loadAvatarDb();
  avatarDb.users[userId] = dedupeEntries(entries);
  if (avatarDb.users[userId].length > MAX_ICONS_PER_USER) {
    avatarDb.users[userId] = avatarDb.users[userId].slice(-MAX_ICONS_PER_USER);
  }
  saveAvatarDb();
}

async function ensureAvatarRecorded(user, { archive = false } = {}) {
  if (!user?.id || user.bot) return { saved: false, reason: "skip" };

  return withUserLock(user.id, async () => {
    const hash = normalizeHash(user);
    const history = getUserEntries(user.id);
    const existing = history.find((entry) => normalizeHash(entry.hash) === hash);
    const archivedRecord = getArchivedRecord(user.id, hash);

    if (existing) {
      if (archivedRecord?.archiveUrl && !existing.archiveUrl) {
        const updated = history.map((entry) =>
          normalizeHash(entry.hash) === hash
            ? { ...entry, ...archivedRecord }
            : entry,
        );
        writeUserEntries(user.id, updated);
      }

      return { saved: false, reason: "exists" };
    }

    const url = buildAvatarUrl(user.id, hash);

    history.push({
      hash,
      url,
      detectedAt: Date.now(),
      archiveUrl: null,
      archiveMessageId: null,
      archiveChannelId: null,
    });

    writeUserEntries(user.id, history);
    return { saved: true, archived: false };
  });
}

function recordAvatarUpdate(oldUser, newUser) {
  if (!newUser?.id || newUser.bot) return;

  const oldHash = normalizeHash(oldUser);
  const newHash = normalizeHash(newUser);

  if (oldHash === newHash) return;

  // Só registra no JSON — o canal #saveicon fica por conta do bot local.
  ensureAvatarRecorded(newUser, { archive: false }).catch(() => {});
}

function getAvatarHistory(userId, page = 0, pageSize = 10) {
  const all = getUserEntries(userId);
  const start = page * pageSize;
  const slice = all.slice().reverse().slice(start, start + pageSize);

  return {
    total: all.length,
    page,
    pageSize,
    items: slice.map((entry) => ({
      hash: entry.hash,
      url: entry.url,
      archiveUrl: entry.archiveUrl ?? null,
      imageUrl: displayImageUrl(entry),
      detectedAt: entry.detectedAt,
      detectedAtISO: entry.detectedAt ? new Date(entry.detectedAt).toISOString() : null,
    })),
  };
}

async function runPool(items, worker, concurrency = 4) {
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runner()),
  );
}

async function bootstrapAvatarHistory(client) {
  const guildId = process.env.GUILD_ID;
  if (!guildId || !client) return { scanned: 0, saved: 0 };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn(`⚠️ [AvatarStore] Guild ${guildId} não encontrada para bootstrap.`);
    return { scanned: 0, saved: 0 };
  }

  let scanned = 0;
  let saved = 0;
  const processed = new Set();

  try {
    await guild.members.fetch();
  } catch (error) {
    console.warn("⚠️ [AvatarStore] Falha ao listar membros:", error.message);
    return { scanned: 0, saved: 0 };
  }

  const members = [...guild.members.cache.values()].filter((m) => m.user?.id && !m.user.bot);

  await runPool(
    members,
    async (member) => {
      if (processed.has(member.user.id)) return;
      processed.add(member.user.id);
      scanned += 1;

      const result = await ensureAvatarRecorded(member.user, { archive: false });
      if (result.saved) saved += 1;
    },
    BOOTSTRAP_CONCURRENCY,
  );

  for (const guild of client.guilds.cache.values()) {
    if (guild.id === guildId) continue;

    try {
      await guild.members.fetch();
    } catch {
      continue;
    }

    const extra = [...guild.members.cache.values()].filter((m) => m.user?.id && !m.user.bot);

    await runPool(
      extra,
      async (member) => {
        if (processed.has(member.user.id)) return;
        processed.add(member.user.id);
        scanned += 1;
        const result = await ensureAvatarRecorded(member.user, { archive: false });
        if (result.saved) saved += 1;
      },
      BOOTSTRAP_CONCURRENCY,
    );
  }

  console.log(`✅ [AvatarStore] Bootstrap: ${scanned} usuários, ${saved} ícones novos.`);
  return { scanned, saved };
}

export {
  ensureAvatarRecorded,
  recordAvatarUpdate,
  getAvatarHistory,
  bootstrapAvatarHistory,
  buildAvatarUrl,
  displayImageUrl,
};
