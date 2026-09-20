// =====================================================
// API KEYS - Gerenciamento de chaves + planos (ES Modules)
// =====================================================

import crypto from 'crypto';
import mongoose from 'mongoose';

// =====================================================
// PLANOS
// =====================================================
export const PLANS = {
    free: {
        name: 'Free',
        reqPerMinute: 30,
        reqPerDay: 1000,
        cacheTTL: 300,        // 5 min
    },
    pro: {
        name: 'Pro',
        reqPerMinute: 300,
        reqPerDay: 50000,
        cacheTTL: 60,         // 1 min
    },
    enterprise: {
        name: 'Enterprise',
        reqPerMinute: 3000,
        reqPerDay: Infinity,
        cacheTTL: 0,          // sem cache
    },
};

// =====================================================
// SCHEMA: api_keys
// =====================================================
const apiKeySchema = new mongoose.Schema({
    _id: { type: String, required: true },        // a própria chave
    name: { type: String, default: 'Sem nome' },
    plan: { type: String, default: 'free', enum: ['free', 'pro', 'enterprise'] },
    active: { type: Boolean, default: true },

    // Uso
    totalRequests: { type: Number, default: 0 },
    dailyRequests: { type: Number, default: 0 },
    dailyResetAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },

    // Metadata
    ownerEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
}, {
    _id: false,
    collection: 'api_keys',
    versionKey: false,
});

apiKeySchema.index({ plan: 1 });
apiKeySchema.index({ active: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// =====================================================
// FUNÇÕES
// =====================================================

/**
 * Gera uma chave nova.
 * Formato: `sk_live_` + 32 chars hex
 */
function generateKey() {
    return `sk_live_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Cria uma chave nova.
 */
export async function createApiKey({ plan = 'free', name = null, ownerEmail = null } = {}) {
    if (!PLANS[plan]) throw new Error(`Plano inválido: ${plan}`);

    const key = generateKey();

    await ApiKey.create({
        _id: key,
        name: name || `Chave ${plan}`,
        plan,
        ownerEmail,
    });

    return key;
}

/**
 * Busca uma chave.
 */
export async function getApiKey(key) {
    if (!key) return null;
    return ApiKey.findById(key).lean();
}

/**
 * Valida uma chave e retorna o objeto (ou null).
 */
export async function validateApiKey(key) {
    if (!key) return null;

    const doc = await ApiKey.findById(key).lean();
    if (!doc) return null;
    if (!doc.active) return null;

    return doc;
}

/**
 * Incrementa o contador de uso.
 * Reset automático do diário se passou de 24h.
 */
export async function incrementUsage(key) {
    const doc = await ApiKey.findById(key);
    if (!doc) return;

    doc.totalRequests++;
    doc.lastUsedAt = new Date();

    // Reset diário se passou
    if (doc.dailyResetAt && new Date(doc.dailyResetAt) < new Date()) {
        doc.dailyRequests = 0;
        doc.dailyResetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    doc.dailyRequests++;

    await doc.save();
}

/**
 * Revoga uma chave (soft delete).
 */
export async function revokeApiKey(key) {
    const result = await ApiKey.updateOne(
        { _id: key },
        {
            $set: {
                active: false,
                revokedAt: new Date(),
            },
        }
    );

    return result.modifiedCount > 0;
}

/**
 * Muda o plano de uma chave.
 */
export async function setApiKeyPlan(key, plan) {
    if (!PLANS[plan]) throw new Error(`Plano inválido: ${plan}`);

    const result = await ApiKey.updateOne(
        { _id: key },
        { $set: { plan } }
    );

    return result.modifiedCount > 0;
}

/**
 * Lista todas as chaves (admin).
 */
export async function listApiKeys({ limit = 100, plan = null, active = null } = {}) {
    const query = {};
    if (plan) query.plan = plan;
    if (active !== null) query.active = active;

    return ApiKey.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

/**
 * Stats gerais das chaves.
 */
export async function getApiKeyStats() {
    const total = await ApiKey.countDocuments();
    const active = await ApiKey.countDocuments({ active: true });
    const byPlan = await ApiKey.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    return {
        total,
        active,
        revoked: total - active,
        byPlan: byPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
    };
}