// =====================================================
// ROTAS: Admin (ES Modules)
// Todas protegidas por X-Admin-Key
// =====================================================

import express from 'express';
import {
    createApiKey,
    getApiKey,
    revokeApiKey,
    setApiKeyPlan,
    listApiKeys,
    getApiKeyStats,
    PLANS,
} from '../utils/apiKeys.js';
import { cacheClear, cacheStats } from '../utils/cache.js';
import { getMongoStats } from '../utils/mongoStore.js';

const router = express.Router();

// =====================================================
// GET /admin/keys
// Lista todas as chaves
// =====================================================
router.get('/keys', async (req, res) => {
    const { plan, active, limit } = req.query;

    const keys = await listApiKeys({
        plan: plan || null,
        active: active === 'true' ? true : active === 'false' ? false : null,
        limit: Number(limit) || 100,
    });

    return res.json({
        success: true,
        total: keys.length,
        keys: keys.map((k) => ({
            key: k._id.slice(0, 12) + '...' + k._id.slice(-4), // ofuscado
            name: k.name,
            plan: k.plan,
            active: k.active,
            totalRequests: k.totalRequests,
            dailyRequests: k.dailyRequests,
            createdAt: k.createdAt,
            lastUsedAt: k.lastUsedAt,
        })),
    });
});

// =====================================================
// POST /admin/keys
// Cria uma chave manualmente
// =====================================================
router.post('/keys', async (req, res) => {
    try {
        const { plan = 'free', name, email } = req.body || {};

        if (!PLANS[plan]) {
            return res.status(400).json({
                success: false,
                error: `Plano inválido. Use: ${Object.keys(PLANS).join(', ')}`,
            });
        }

        const key = await createApiKey({ plan, name, ownerEmail: email });

        return res.json({
            success: true,
            apiKey: key,
            plan,
            message: 'Guarde a chave. Ela não será mostrada novamente.',
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================
// GET /admin/keys/:key
// Detalhes de uma chave específica
// =====================================================
router.get('/keys/:key', async (req, res) => {
    const key = await getApiKey(req.params.key);
    if (!key) {
        return res.status(404).json({ success: false, error: 'Chave não encontrada.' });
    }

    const planConfig = PLANS[key.plan] || PLANS.free;

    return res.json({
        success: true,
        key: {
            ...key,
            _id: key._id.slice(0, 12) + '...' + key._id.slice(-4),
        },
        limits: {
            requestsPerMinute: planConfig.reqPerMinute,
            requestsPerDay: planConfig.reqPerDay,
        },
    });
});

// =====================================================
// POST /admin/keys/:key/plan
// Muda o plano de uma chave
// =====================================================
router.post('/keys/:key/plan', async (req, res) => {
    const { plan } = req.body || {};

    if (!PLANS[plan]) {
        return res.status(400).json({
            success: false,
            error: `Plano inválido. Use: ${Object.keys(PLANS).join(', ')}`,
        });
    }

    const ok = await setApiKeyPlan(req.params.key, plan);
    if (!ok) {
        return res.status(404).json({ success: false, error: 'Chave não encontrada.' });
    }

    return res.json({ success: true, message: `Plano alterado para ${plan}.` });
});

// =====================================================
// DELETE /admin/keys/:key
// Revoga uma chave
// =====================================================
router.delete('/keys/:key', async (req, res) => {
    const ok = await revokeApiKey(req.params.key);
    if (!ok) {
        return res.status(404).json({ success: false, error: 'Chave não encontrada.' });
    }

    return res.json({ success: true, message: 'Chave revogada.' });
});

// =====================================================
// POST /admin/cache/clear
// Limpa o cache (opcional: por prefixo)
// =====================================================
router.post('/cache/clear', async (req, res) => {
    const { prefix } = req.body || {};
    const removed = await cacheClear(prefix || null);

    return res.json({
        success: true,
        removed,
        prefix: prefix || '(todos)',
    });
});

// =====================================================
// GET /admin/stats
// Stats detalhadas
// =====================================================
router.get('/stats', async (req, res) => {
    const [mongo, keys, cache] = await Promise.all([
        getMongoStats(),
        getApiKeyStats(),
        cacheStats(),
    ]);

    return res.json({
        success: true,
        mongo,
        keys,
        cache,
        timestamp: new Date().toISOString(),
    });
});

export default router;