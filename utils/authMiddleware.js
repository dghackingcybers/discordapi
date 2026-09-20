// =====================================================
// AUTH MIDDLEWARE - Express (ES Modules)
// =====================================================

import { validateApiKey, incrementUsage } from './apiKeys.js';
import { checkRateLimit, checkIpRateLimit } from './rateLimiter.js';

// =====================================================
// MIDDLEWARE: Autentica por API key + Rate limit
// =====================================================
export async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key obrigatória. Envie no header X-API-Key.',
            hint: 'Crie uma chave em POST /api-keys/register',
        });
    }

    const keyDoc = await validateApiKey(apiKey);

    if (!keyDoc) {
        return res.status(401).json({
            success: false,
            error: 'API key inválida ou revogada.',
        });
    }

    const rateCheck = await checkRateLimit(apiKey, keyDoc.plan);

    res.set('X-RateLimit-Limit', String(rateCheck.limit));
    res.set('X-RateLimit-Remaining', String(rateCheck.remaining));
    res.set('X-RateLimit-Reset', String(rateCheck.reset));
    res.set('X-API-Key-Plan', keyDoc.plan);

    if (!rateCheck.allowed) {
        res.set('Retry-After', String(rateCheck.retryAfter || 60));
        return res.status(429).json({
            success: false,
            error: 'Rate limit excedido.',
            limit: rateCheck.limit,
            retryAfter: rateCheck.retryAfter || 60,
            plan: keyDoc.plan,
        });
    }

    incrementUsage(apiKey).catch(() => {});

    req.apiKey = keyDoc;

    next();
}

// =====================================================
// MIDDLEWARE: Rate limit por IP (rotas públicas)
// =====================================================
export function ipRateLimit(limit = 30) {
    return async (req, res, next) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';

        const check = await checkIpRateLimit(ip, limit);

        res.set('X-RateLimit-Limit', String(check.limit));
        res.set('X-RateLimit-Remaining', String(check.remaining));
        res.set('X-RateLimit-Reset', String(check.reset));

        if (!check.allowed) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit por IP excedido.',
                retryAfter: 60,
            });
        }

        next();
    };
}

// =====================================================
// MIDDLEWARE: Admin (X-Admin-Key)
// =====================================================
export function adminAuth(req, res, next) {
    const adminSecret = process.env.ADMIN_SECRET;
    const provided = req.headers['x-admin-key'] || req.query.admin_key;

    if (!adminSecret) {
        return res.status(500).json({
            success: false,
            error: 'ADMIN_SECRET não configurado no servidor.',
        });
    }

    if (provided !== adminSecret) {
        return res.status(401).json({
            success: false,
            error: 'Admin key inválida.',
        });
    }

    next();
}