// =====================================================
// CACHE - Cache com TTL no MongoDB (ES Modules)
// =====================================================

import mongoose from 'mongoose';

// =====================================================
// SCHEMA: cache
// TTL automático pelo MongoDB (expira sozinho)
// =====================================================
const cacheSchema = new mongoose.Schema({
    _id: { type: String, required: true },        // chave única (ex: "user:123")
    data: { type: mongoose.Schema.Types.Mixed },  // dados cacheados
    expiresAt: { type: Date, required: true },    // TTL
    createdAt: { type: Date, default: Date.now },
}, {
    _id: false,
    collection: 'cache',
    versionKey: false,
});

// TTL index: MongoDB apaga automaticamente quando expiresAt passar
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CacheModel = mongoose.model('ApiCache', cacheSchema);

// =====================================================
// FUNÇÕES
// =====================================================

/**
 * Busca item no cache.
 * Retorna null se não existir ou expirado.
 */
export async function cacheGet(key) {
    try {
        const doc = await CacheModel.findById(key).lean();
        if (!doc) return null;

        // Verifica se expirou (redundância — TTL já cuida, mas garante)
        if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
            await CacheModel.deleteOne({ _id: key }).catch(() => {});
            return null;
        }

        return doc.data;
    } catch (err) {
        console.warn('⚠️  [Cache] Erro no get:', err.message);
        return null;
    }
}

/**
 * Salva item no cache.
 * @param {string} key - chave única
 * @param {*} data - dados a salvar
 * @param {number} ttlSeconds - tempo de vida em segundos
 */
export async function cacheSet(key, data, ttlSeconds = 300) {
    try {
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        await CacheModel.updateOne(
            { _id: key },
            {
                $set: {
                    data,
                    expiresAt,
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        return true;
    } catch (err) {
        console.warn('⚠️  [Cache] Erro no set:', err.message);
        return false;
    }
}

/**
 * Remove item do cache.
 */
export async function cacheDel(key) {
    try {
        await CacheModel.deleteOne({ _id: key });
        return true;
    } catch (err) {
        console.warn('⚠️  [Cache] Erro no del:', err.message);
        return false;
    }
}

/**
 * Limpa todo o cache (ou por prefixo).
 */
export async function cacheClear(prefix = null) {
    try {
        if (prefix) {
            const result = await CacheModel.deleteMany({
                _id: { $regex: `^${prefix}` },
            });
            return result.deletedCount;
        }

        const result = await CacheModel.deleteMany({});
        return result.deletedCount;
    } catch (err) {
        console.warn('⚠️  [Cache] Erro no clear:', err.message);
        return 0;
    }
}

/**
 * Stats do cache.
 */
export async function cacheStats() {
    try {
        const total = await CacheModel.countDocuments();
        const expired = await CacheModel.countDocuments({
            expiresAt: { $lt: new Date() },
        });
        return { total, expired, active: total - expired };
    } catch (err) {
        return { total: 0, expired: 0, active: 0 };
    }
}