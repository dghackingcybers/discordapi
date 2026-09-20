// =====================================================
// RATE LIMITER - Por API key (ES Modules)
// =====================================================

import { PLANS } from './apiKeys.js';
import { cacheGet, cacheSet } from './cache.js';

/**
 * Verifica o rate limit de uma chave.
 * Retorna:
 *   { allowed: true, limit, remaining, reset }
 *   { allowed: false, limit, remaining: 0, reset, retryAfter }
 */
export async function checkRateLimit(apiKey, plan = 'free') {
    const planConfig = PLANS[plan] || PLANS.free;
    const now = Date.now();
    const windowKey = `ratelimit:${apiKey}:${Math.floor(now / 60000)}`; // janela de 1 min

    let count = await cacheGet(windowKey) || 0;
    count++;

    // TTL da janela = 60s
    await cacheSet(windowKey, count, 60);

    const limit = planConfig.reqPerMinute;
    const remaining = Math.max(0, limit - count);
    const reset = Math.ceil((Math.floor(now / 60000) + 1) * 60);

    if (count > limit) {
        return {
            allowed: false,
            limit,
            remaining: 0,
            reset,
            retryAfter: 60 - Math.floor((now % 60000) / 1000),
        };
    }

    return {
        allowed: true,
        limit,
        remaining,
        reset,
    };
}

/**
 * Verifica rate limit por IP (pra rotas públicas).
 */
export async function checkIpRateLimit(ip, limit = 30) {
    const now = Date.now();
    const windowKey = `ratelimit:ip:${ip}:${Math.floor(now / 60000)}`;

    let count = await cacheGet(windowKey) || 0;
    count++;
    await cacheSet(windowKey, count, 60);

    return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        reset: Math.ceil((Math.floor(now / 60000) + 1) * 60),
    };
}