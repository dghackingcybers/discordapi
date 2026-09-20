// =====================================================
// ROTAS: Stats (ES Modules)
// =====================================================

import express from 'express';
import {
    getMongoStats,
} from '../utils/mongoStore.js';
import {
    getApiKeyStats,
} from '../utils/apiKeys.js';
import {
    cacheStats,
} from '../utils/cache.js';

const router = express.Router();

// =====================================================
// GET /stats
// Stats globais (público)
// =====================================================
router.get('/', async (req, res) => {
    try {
        const [mongo, keys, cache] = await Promise.all([
            getMongoStats(),
            getApiKeyStats(),
            cacheStats(),
        ]);

        return res.json({
            success: true,
            avatars: {
                usersTracked: mongo.usersTracked,
                totalIcons: mongo.totalIcons,
                archivedIcons: mongo.archivedCount,
            },
            api: {
                keysTotal: keys.total,
                keysActive: keys.active,
                keysRevoked: keys.revoked,
                keysByPlan: keys.byPlan,
            },
            cache: {
                total: cache.total,
                active: cache.active,
                expired: cache.expired,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('❌ [routes/stats]', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

export default router;