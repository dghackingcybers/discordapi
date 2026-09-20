// =====================================================
// ROTAS: API Keys (ES Modules)
// =====================================================

import express from 'express';
import {
    createApiKey,
    getApiKey,
    revokeApiKey,
    PLANS,
} from '../utils/apiKeys.js';
import { ipRateLimit } from '../utils/authMiddleware.js';

const router = express.Router();

// =====================================================
// POST /api-keys/register
// Cria uma chave Free automaticamente (público, limitado por IP)
// =====================================================
router.post('/register', ipRateLimit(2), async (req, res) => {
    // Limite: 2 chaves por minuto por IP (pra evitar abuso)
    // Em produção, considerar 2 por DIA por IP

    try {
        const { name, email } = req.body || {};

        const key = await createApiKey({
            plan: 'free',
            name: name || 'Chave Free',
            ownerEmail: email || null,
        });

        return res.json({
            success: true,
            apiKey: key,
            plan: 'free',
            limits: {
                requestsPerMinute: PLANS.free.reqPerMinute,
                requestsPerDay: PLANS.free.reqPerDay,
                cacheTTLSeconds: PLANS.free.cacheTTL,
            },
            message: 'Guarde sua chave em local seguro. Ela não será mostrada novamente.',
        });
    } catch (err) {
        console.error('❌ [routes/apiKeys] register:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================
// GET /api-keys/me
// Info da própria chave
// =====================================================
router.get('/me', async (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API key obrigatória.' });
    }

    const key = await getApiKey(apiKey);
    if (!key) {
        return res.status(404).json({ success: false, error: 'Chave não encontrada.' });
    }

    const planConfig = PLANS[key.plan] || PLANS.free;

    return res.json({
        success: true,
        key: {
            name: key.name,
            plan: key.plan,
            active: key.active,
            createdAt: key.createdAt,
            lastUsedAt: key.lastUsedAt,
            totalRequests: key.totalRequests,
            dailyRequests: key.dailyRequests,
        },
        limits: {
            requestsPerMinute: planConfig.reqPerMinute,
            requestsPerDay: planConfig.reqPerDay,
            cacheTTLSeconds: planConfig.cacheTTL,
        },
    });
});

// =====================================================
// DELETE /api-keys/me
// Revoga a própria chave
// =====================================================
router.delete('/me', async (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API key obrigatória.' });
    }

    const ok = await revokeApiKey(apiKey);
    if (!ok) {
        return res.status(404).json({ success: false, error: 'Chave não encontrada.' });
    }

    return res.json({ success: true, message: 'Chave revogada com sucesso.' });
});

export default router;