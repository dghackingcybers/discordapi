// =====================================================
// AVATAR STORE - Histórico de avatares (ES Modules + Mongo)
// =====================================================

import fetch from 'node-fetch';
import {
    getUserEntries as mongoGetUserEntries,
    writeUserEntries as mongoWriteUserEntries,
    recordAvatarEntry,
    getArchivedRecord as mongoGetArchivedRecord,
    markArchivedRecord as mongoMarkArchivedRecord,
    persistArchiveMeta,
    connectMongo,
} from './mongoStore.js';

const MAX_ICONS_PER_USER = 500;
const userLocks = new Map();

// =====================================================
// HELPERS
// =====================================================

function normalizeHash(userOrHash) {
    if (typeof userOrHash === 'string') {
        const value = userOrHash.trim();
        if (!value || value === 'null' || value === 'undefined') return 'default';
        return value;
    }
    const raw = userOrHash?.avatar ?? userOrHash?.avatarHash ?? null;
    if (!raw) return 'default';
    return String(raw);
}

function buildAvatarUrl(userId, hash) {
    if (!hash || hash === 'default') {
        return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
    const extension = hash.startsWith('a_') ? 'gif' : 'png';
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

// =====================================================
// WRAPPERS DO MONGOSTORE
// =====================================================

async function getUserEntries(userId) {
    const list = await mongoGetUserEntries(userId);
    return dedupeEntries(list.map((entry) => ({ ...entry, userId })));
}

async function writeUserEntries(userId, entries) {
    const deduped = dedupeEntries(entries).slice(-MAX_ICONS_PER_USER);
    await mongoWriteUserEntries(userId, deduped);
}

async function getArchivedRecord(userId, hash) {
    return mongoGetArchivedRecord(userId, hash);
}

async function markArchivedRecord(userId, hash, data) {
    return mongoMarkArchivedRecord(userId, hash, {
        ...data,
        hash: normalizeHash(hash),
        userId,
        at: data?.at ?? Date.now(),
    });
}

// =====================================================
// ARQUIVAR NO CANAL (via REST com bot token)
// =====================================================

async function archiveAvatarToChannel(user, hash, sourceUrl) {
    const channelId = process.env.ARCHIVE_CHANNEL_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!channelId || !botToken || !hash || hash === 'default') return null;

    const normalizedHash = normalizeHash(hash);
    const existingRecord = await getArchivedRecord(user.id, normalizedHash);
    if (existingRecord?.archiveUrl) {
        return { ...existingRecord, reused: true };
    }

    const url = sourceUrl || buildAvatarUrl(user.id, normalizedHash);
    const buffer = await downloadAvatarBuffer(url);
    if (!buffer?.length) return null;

    const extension = hash.startsWith('a_') ? 'gif' : 'png';
    const filename = `${user.id}_${hash.slice(0, 10)}.${extension}`;

    const payload = {
        content: `-# ${user.username || user.globalName || 'user'} (\`${user.id}\`) | \`${hash}\``,
    };

    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    form.append('files[0]', new Blob([buffer]), filename);

    try {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}` },
            body: form,
        });

        if (!response.ok) {
            console.warn(`⚠️  [avatarStore] Falha ao arquivar: ${response.status}`);
            return null;
        }

        const message = await response.json();
        const attachment = message.attachments?.[0];
        if (!attachment?.url) return null;

        const result = {
            archiveUrl: attachment.url,
            archiveMessageId: message.id,
            archiveChannelId: channelId,
        };

        await markArchivedRecord(user.id, normalizedHash, result);
        return result;
    } catch (err) {
        console.warn('⚠️  [avatarStore] Erro ao arquivar:', err.message);
        return null;
    }
}

// =====================================================
// FUNÇÕES PRINCIPAIS
// =====================================================

async function ensureAvatarRecorded(user, { archive = false } = {}) {
    if (!user?.id || user.bot) return { saved: false, reason: 'skip' };

    return withUserLock(user.id, async () => {
        const hash = normalizeHash(user);
        const history = await getUserEntries(user.id);
        const existing = history.find((entry) => normalizeHash(entry.hash) === hash);
        const archivedRecord = await getArchivedRecord(user.id, hash);

        if (existing) {
            if (archivedRecord?.archiveUrl && !existing.archiveUrl) {
                await persistArchiveMeta(user.id, hash, archivedRecord).catch(() => {});
            }
            return { saved: false, reason: 'exists' };
        }

        const url = buildAvatarUrl(user.id, hash);

        let archiveResult = null;
        if (archive) {
            archiveResult = await archiveAvatarToChannel(user, hash, url).catch(() => null);
        }

        await recordAvatarEntry(user.id, hash, {
            url,
            archiveUrl: archiveResult?.archiveUrl || null,
            archiveMessageId: archiveResult?.archiveMessageId || null,
            archiveChannelId: archiveResult?.archiveChannelId || null,
        });

        return { saved: true, archived: !!archiveResult };
    });
}

function recordAvatarUpdate(oldUser, newUser) {
    if (!newUser?.id || newUser.bot) return;

    const oldHash = normalizeHash(oldUser);
    const newHash = normalizeHash(newUser);

    if (oldHash === newHash) return;

    // Só registra no Mongo — o canal #saveicon fica por conta do bot local.
    ensureAvatarRecorded(newUser, { archive: false }).catch((err) => {
        console.warn('⚠️  [avatarStore] recordAvatarUpdate:', err.message);
    });
}

async function getAvatarHistory(userId, page = 0, pageSize = 10) {
    const all = await getUserEntries(userId);
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
    try {
        await connectMongo();
    } catch (err) {
        console.error('❌ [AvatarStore] Falha ao conectar no Mongo:', err.message);
        return { scanned: 0, saved: 0 };
    }

    if (!client) return { scanned: 0, saved: 0 };

    let scanned = 0;
    let saved = 0;
    const processed = new Set();

    for (const guild of client.guilds.cache.values()) {
        for (const member of guild.members.cache.values()) {
            if (!member.user?.id || member.user.bot || processed.has(member.user.id)) continue;
            processed.add(member.user.id);
            scanned += 1;
            const result = await ensureAvatarRecorded(member.user, { archive: false });
            if (result.saved) saved += 1;
        }
    }

    console.log(`✅ [AvatarStore] Bootstrap (cache): ${scanned} usuários, ${saved} ícones novos.`);
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