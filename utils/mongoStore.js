// =====================================================
// MONGOSTORE - Conexão + Schemas de Avatar (ES Modules)
// =====================================================

import mongoose from 'mongoose';
import dns from 'node:dns';

// Força DNS público (evita ECONNREFUSED no Windows/Render)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// =====================================================
// CONEXÃO
// =====================================================
let isConnected = false;

export async function connectMongo() {
    if (isConnected) return mongoose.connection;

    const uri = process.env.MONGO_URL;
    if (!uri) throw new Error('MONGO_URL não configurada no .env');

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
        });

        isConnected = true;
        console.log('✅ [MongoStore] Conectado ao MongoDB');
        console.log('   📦 Database:', mongoose.connection.name);

        mongoose.connection.on('error', (err) => {
            console.error('❌ [MongoStore] Erro na conexão:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  [MongoStore] Desconectado');
            isConnected = false;
        });

        return mongoose.connection;
    } catch (err) {
        console.error('❌ [MongoStore] Falha ao conectar:', err.message);
        throw err;
    }
}

// =====================================================
// SCHEMA: avatar_users (API)
// =====================================================
const avatarEntrySchema = new mongoose.Schema({
    hash: { type: String, required: true },
    url: { type: String, default: null },
    detectedAt: { type: Number, default: Date.now },
    archiveUrl: { type: String, default: null },
    archiveMessageId: { type: String, default: null },
    archiveChannelId: { type: String, default: null },
}, { _id: false });

const avatarUserSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    entries: { type: [avatarEntrySchema], default: [] },
    updatedAt: { type: Number, default: Date.now },
}, { _id: false, collection: 'avatar_users', versionKey: false });

avatarUserSchema.index({ updatedAt: -1 });

const AvatarUser = mongoose.model('ApiAvatarUser', avatarUserSchema);

// =====================================================
// SCHEMA: avatar_archived (API)
// =====================================================
const archivedSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    hash: { type: String, required: true },
    archiveUrl: { type: String, default: null },
    archiveMessageId: { type: String, default: null },
    archiveChannelId: { type: String, default: null },
    at: { type: Number, default: Date.now },
}, { _id: false, collection: 'avatar_archived', versionKey: false });

const ArchivedAvatar = mongoose.model('ApiArchivedAvatar', archivedSchema);

// =====================================================
// FUNÇÕES
// =====================================================

export async function getUserEntries(userId) {
    const doc = await AvatarUser.findById(userId).lean();
    if (!doc?.entries?.length) return [];
    return doc.entries.sort((a, b) => (a.detectedAt || 0) - (b.detectedAt || 0));
}

export async function writeUserEntries(userId, entries) {
    const byHash = new Map();
    for (const e of entries) {
        const h = String(e.hash || 'default').trim();
        if (!byHash.has(h)) byHash.set(h, e);
    }
    const deduped = [...byHash.values()]
        .sort((a, b) => (a.detectedAt || 0) - (b.detectedAt || 0))
        .slice(-500);

    await AvatarUser.updateOne(
        { _id: userId },
        {
            $set: {
                entries: deduped,
                updatedAt: Date.now(),
            },
        },
        { upsert: true }
    );
}

export async function recordAvatarEntry(userId, hash, extra = {}) {
    const existing = await AvatarUser.findOne({
        _id: userId,
        'entries.hash': hash,
    }).lean();

    if (existing) return { saved: false, reason: 'exists' };

    await AvatarUser.updateOne(
        { _id: userId },
        {
            $push: {
                entries: {
                    hash,
                    url: extra.url || null,
                    detectedAt: Date.now(),
                    archiveUrl: extra.archiveUrl || null,
                    archiveMessageId: extra.archiveMessageId || null,
                    archiveChannelId: extra.archiveChannelId || null,
                },
            },
            $set: { updatedAt: Date.now() },
        },
        { upsert: true }
    );

    return { saved: true };
}

export async function getArchivedRecord(userId, hash) {
    const key = `${userId}:${String(hash || 'default').trim()}`;
    return ArchivedAvatar.findById(key).lean();
}

export async function markArchivedRecord(userId, hash, data) {
    const key = `${userId}:${String(hash || 'default').trim()}`;

    await ArchivedAvatar.updateOne(
        { _id: key },
        {
            $set: {
                userId,
                hash: String(hash || 'default').trim(),
                archiveUrl: data.archiveUrl,
                archiveMessageId: data.archiveMessageId || null,
                archiveChannelId: data.archiveChannelId || null,
                at: data.at || Date.now(),
            },
        },
        { upsert: true }
    );
}

export async function persistArchiveMeta(userId, hash, meta) {
    if (!meta?.archiveUrl) return;

    const userDoc = await AvatarUser.findById(userId);
    if (!userDoc) return;

    const idx = userDoc.entries.findIndex(
        (e) => String(e.hash).trim() === String(hash).trim()
    );
    if (idx < 0) return;

    userDoc.entries[idx].archiveUrl = meta.archiveUrl;
    userDoc.entries[idx].archiveMessageId = meta.archiveMessageId || userDoc.entries[idx].archiveMessageId;
    userDoc.entries[idx].archiveChannelId = meta.archiveChannelId || userDoc.entries[idx].archiveChannelId;
    userDoc.updatedAt = Date.now();

    await userDoc.save();
}

export async function getMongoStats() {
    const [usersCount, archivedCount] = await Promise.all([
        AvatarUser.countDocuments(),
        ArchivedAvatar.countDocuments(),
    ]);

    const totalIconsAgg = await AvatarUser.aggregate([
        { $project: { count: { $size: '$entries' } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
    ]);

    return {
        usersTracked: usersCount,
        archivedCount,
        totalIcons: totalIconsAgg[0]?.total || 0,
    };
}

export { mongoose, AvatarUser, ArchivedAvatar };