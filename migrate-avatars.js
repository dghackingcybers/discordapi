// =====================================================
// MIGRAÇÃO: data/avatars.json → MongoDB
// =====================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
    connectMongo,
    writeUserEntries,
    markArchivedRecord,
} from './utils/mongoStore.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_FILE = path.join(__dirname, 'data', 'avatars.json');

const BATCH_SIZE = 500;
const LOG_EVERY = 500;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

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
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=4096`;
}

async function runPool(items, concurrency, worker) {
    let index = 0;
    async function runner() {
        while (index < items.length) {
            const current = index;
            index++;
            try {
                await worker(items[current], current);
            } catch (err) {
                // ignora erro individual
            }
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runner())
    );
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🚀 MIGRAÇÃO: avatars.json → MongoDB (API)');
    console.log('═'.repeat(60));

    if (!fs.existsSync(AVATARS_FILE)) {
        console.error(`❌ Arquivo não encontrado: ${AVATARS_FILE}`);
        process.exit(1);
    }

    console.log('\n📡 Conectando no MongoDB...');
    await connectMongo();

    console.log('\n📦 Lendo avatars.json...');
    const raw = JSON.parse(fs.readFileSync(AVATARS_FILE, 'utf8'));
    const users = raw.users || {};
    const archivedIndex = raw.archivedIndex || {};

    const userIds = Object.keys(users);
    console.log(`   ✅ ${userIds.length} usuários`);
    console.log(`   ✅ ${Object.keys(archivedIndex).length} registros arquivados`);

    let totalIcons = 0;
    for (const id of userIds) {
        totalIcons += Array.isArray(users[id]) ? users[id].length : 0;
    }
    console.log(`   ✅ ${totalIcons} ícones`);

    console.log('\n⏳ Começando em 5 segundos... (Ctrl+C pra cancelar)');
    await sleep(5000);

    const startTime = Date.now();

    // 1. Migra usuários
    let migrated = 0;
    let iconsMigrated = 0;
    let errors = 0;

    console.log('\n🔄 Migrando usuários...\n');

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);

        await runPool(batch, 5, async (userId) => {
            const list = Array.isArray(users[userId]) ? users[userId] : [];
            if (!list.length) return;

            const entries = [];
            const seen = new Set();

            for (const entry of list) {
                const hash = normalizeHash(entry.hash);
                if (!hash || hash === 'default' || seen.has(hash)) continue;
                seen.add(hash);

                entries.push({
                    hash,
                    url: entry.url || buildAvatarUrl(userId, hash),
                    detectedAt: entry.detectedAt || Date.now(),
                    archiveUrl: entry.archiveUrl || null,
                    archiveMessageId: entry.archiveMessageId || null,
                    archiveChannelId: entry.archiveChannelId || null,
                });
            }

            if (!entries.length) return;

            try {
                await writeUserEntries(userId, entries);
                migrated++;
                iconsMigrated += entries.length;
            } catch (err) {
                errors++;
                if (errors <= 5) console.error(`   ❌ ${userId}:`, err.message);
            }
        });

        const processed = Math.min(i + BATCH_SIZE, userIds.length);
        if (processed % LOG_EVERY === 0 || processed === userIds.length) {
            const pct = ((processed / userIds.length) * 100).toFixed(1);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            console.log(`   [${pct}%] ${processed}/${userIds.length} | ${iconsMigrated} ícones | ${errors} erros | ${elapsed}s`);
        }
    }

    // 2. Migra archivedIndex
    console.log('\n🔄 Migrando registros arquivados...\n');

    const archivedKeys = Object.keys(archivedIndex);
    let archivedMigrated = 0;

    for (let i = 0; i < archivedKeys.length; i += BATCH_SIZE) {
        const batch = archivedKeys.slice(i, i + BATCH_SIZE);

        await runPool(batch, 5, async (key) => {
            const [userId, hash] = key.split(':');
            if (!userId || !hash) return;

            const record = archivedIndex[key];
            if (!record?.archiveUrl) return;

            try {
                await markArchivedRecord(userId, hash, {
                    archiveUrl: record.archiveUrl,
                    archiveMessageId: record.archiveMessageId || null,
                    archiveChannelId: record.archiveChannelId || null,
                    at: record.at || Date.now(),
                });
                archivedMigrated++;
            } catch (err) {
                errors++;
            }
        });

        const processed = Math.min(i + BATCH_SIZE, archivedKeys.length);
        if (processed % LOG_EVERY === 0 || processed === archivedKeys.length) {
            const pct = ((processed / archivedKeys.length) * 100).toFixed(1);
            console.log(`   [${pct}%] ${processed}/${archivedKeys.length} arquivados | ${errors} erros`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ MIGRAÇÃO COMPLETA');
    console.log('═'.repeat(60));
    console.log(`   👥 Usuários migrados:     ${migrated}`);
    console.log(`   🖼️  Ícones migrados:       ${iconsMigrated}`);
    console.log(`   📦 Arquivados migrados:   ${archivedMigrated}`);
    console.log(`   ❌ Erros:                 ${errors}`);
    console.log(`   ⏱️  Tempo total:           ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('═'.repeat(60));
    console.log('\n💡 O avatars.json NÃO foi alterado.');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ Erro fatal:', err);
    process.exit(1);
});