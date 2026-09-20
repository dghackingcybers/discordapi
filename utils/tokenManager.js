import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'data', 'token_state.json');

const COOLDOWN_BASE_MS = 5 * 60 * 1000;
const COOLDOWN_MIN_MS = 5 * 1000;
const COOLDOWN_JITTER_MS = 30 * 1000;
const MAX_FAILS_BEFORE_INVALID = 5;

class TokenManager {
    constructor() {
        this.tokens = [];
        this.currentIndex = 0;
        this.loadFromEnv();
        this.loadState();
    }

    loadFromEnv() {
        const raw = process.env.DISCORD_SELF_TOKENS || '';
        const legacy = process.env.DISCORD_SELF_TOKEN || process.env.DISCORD_TOKEN || process.env.SELFBOT_TOKEN || '';
        const list = [];

        for (const t of raw.split(',')) {
            const token = t.trim();
            if (token && token !== 'SEU_TOKEN_AQUI') list.push(token);
        }

        if (legacy.trim() && !list.includes(legacy.trim())) {
            list.push(legacy.trim());
        }

        const unique = [...new Set(list)];

        this.tokens = unique.map((token, index) => ({
            token,
            index,
            failCount: 0,
            cooldownUntil: null,
            successCount: 0,
            disabled: false,
            lastError: null,
        }));

        console.log(`🔑 [TokenManager] ${this.tokens.length} token(s) self carregado(s)`);
    }

    loadState() {
        try {
            if (!fs.existsSync(STATE_FILE)) return;
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            if (!state.tokens) return;

            for (const token of this.tokens) {
                const saved = state.tokens[token.token];
                if (!saved) continue;

                token.failCount = saved.failCount || 0;
                token.cooldownUntil = saved.cooldownUntil || null;
                token.successCount = saved.successCount || 0;
                token.disabled = saved.disabled || false;

                if (token.cooldownUntil && Date.now() >= token.cooldownUntil) {
                    token.cooldownUntil = null;
                }
            }

            console.log('📄 [TokenManager] Estado carregado do disco');
        } catch (err) {
            console.warn('⚠️  [TokenManager] Erro ao carregar estado:', err.message);
        }
    }

    saveState() {
        try {
            const dir = path.dirname(STATE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const tokens = {};
            for (const t of this.tokens) {
                tokens[t.token] = {
                    failCount: t.failCount,
                    cooldownUntil: t.cooldownUntil,
                    successCount: t.successCount,
                    disabled: t.disabled,
                };
            }

            fs.writeFileSync(STATE_FILE, JSON.stringify({ tokens }, null, 2));
        } catch (err) {
            console.warn('⚠️  [TokenManager] Erro ao salvar estado:', err.message);
        }
    }

    isAvailable(tokenObj) {
        if (!tokenObj || tokenObj.disabled) return false;
        if (!tokenObj.cooldownUntil) return true;
        return Date.now() >= tokenObj.cooldownUntil;
    }

    getNextToken() {
        const total = this.tokens.length;
        if (total === 0) return null;

        for (let i = 0; i < total; i++) {
            const idx = (this.currentIndex + i) % total;
            const tokenObj = this.tokens[idx];

            if (this.isAvailable(tokenObj)) {
                this.currentIndex = (idx + 1) % total;
                return tokenObj;
            }
        }

        const available = this.tokens.filter((t) => !t.disabled && t.cooldownUntil);
        if (available.length === 0) return null;

        available.sort((a, b) => a.cooldownUntil - b.cooldownUntil);
        const earliest = available[0];

        return {
            ...earliest,
            allCooldown: true,
            waitMs: Math.max(0, earliest.cooldownUntil - Date.now()),
        };
    }

    markSuccess(tokenObj) {
        if (!tokenObj) return;
        const t = this.tokens.find((x) => x.token === tokenObj.token);
        if (!t) return;

        t.failCount = 0;
        t.cooldownUntil = null;
        t.successCount++;
        t.lastError = null;
        this.saveState();
    }

    markRateLimited(tokenObj, retryAfterMs = null) {
        if (!tokenObj) return;
        const t = this.tokens.find((x) => x.token === tokenObj.token);
        if (!t) return;

        t.failCount++;

        const fromDiscord = retryAfterMs && retryAfterMs > 0
            ? retryAfterMs + 1000
            : COOLDOWN_BASE_MS;

        const base = Math.max(COOLDOWN_MIN_MS, fromDiscord);

        const jitter = Math.floor(Math.random() * COOLDOWN_JITTER_MS);
        t.cooldownUntil = Date.now() + base + jitter;
        t.lastError = 'rate-limit';

        console.log(`⏳ [TokenManager] Token #${t.index} em cooldown por ${Math.ceil((base + jitter) / 1000)}s`);
        this.saveState();
    }

    markInvalid(tokenObj, reason = 'unknown') {
        if (!tokenObj) return;
        const t = this.tokens.find((x) => x.token === tokenObj.token);
        if (!t) return;

        t.failCount++;
        t.lastError = `invalid:${reason}`;

        if (t.failCount >= MAX_FAILS_BEFORE_INVALID) {
            t.disabled = true;
            console.warn(`🚫 [TokenManager] Token #${t.index} desabilitado (${reason})`);
        } else {
            t.cooldownUntil = Date.now() + 60 * 1000;
        }

        this.saveState();
    }

    getStats() {
        const now = Date.now();

        return {
            total: this.tokens.length,
            available: this.tokens.filter((t) => this.isAvailable(t)).length,
            inCooldown: this.tokens.filter(
                (t) => !t.disabled && t.cooldownUntil && t.cooldownUntil > now
            ).length,
            disabled: this.tokens.filter((t) => t.disabled).length,
            tokens: this.tokens.map((t) => ({
                index: t.index,
                available: this.isAvailable(t),
                cooldownUntil: t.cooldownUntil,
                cooldownSecondsLeft: t.cooldownUntil
                    ? Math.max(0, Math.ceil((t.cooldownUntil - now) / 1000))
                    : 0,
                failCount: t.failCount,
                successCount: t.successCount,
                disabled: t.disabled,
                lastError: t.lastError,
            })),
        };
    }

    hasTokens() {
        return this.tokens.some((t) => !t.disabled);
    }
}

export const tokenManager = new TokenManager();
export { TokenManager };