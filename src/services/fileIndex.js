import fsp from 'fs/promises';
import path from 'path';

const INDEX_FILE = path.join('data', 'index.json');

let cache = new Map();   // id -> meta
let byName = new Map();  // filename -> meta
let loaded = false;

async function ensureLoaded() {
    if (loaded) return;
    try {
        await fsp.mkdir('data', { recursive: true });
        const raw = await fsp.readFile(INDEX_FILE, 'utf-8').catch(() => '[]');
        const arr = JSON.parse(raw);
        cache = new Map(arr.map(m => [m.id, m]));
        byName = new Map(arr.map(m => [m.filename, m]));
        loaded = true;
    } catch (_e) {
        cache = new Map();
        byName = new Map();
        loaded = true;
    }
}

async function persist() {
    const temp = INDEX_FILE + '.tmp';
    const arr = Array.from(cache.values()).sort((a, b) => b.createdAt - a.createdAt);
    await fsp.writeFile(temp, JSON.stringify(arr, null, 2));
    await fsp.rename(temp, INDEX_FILE);
}

export async function insert(meta) {
    await ensureLoaded();
    cache.set(meta.id, meta);
    byName.set(meta.filename, meta);
    await persist();
    return meta;
}

export async function getById(id) {
    await ensureLoaded();
    return cache.get(id) || null;
}

export async function getByFilename(name) {
    await ensureLoaded();
    return byName.get(name) || null;
}

/** List dengan paging (sudah ada) */
export async function list({ bucket, limit = 50, cursor } = {}) {
    await ensureLoaded();
    let arr = Array.from(cache.values());
    if (bucket) arr = arr.filter(m => m.bucket === bucket);
    if (cursor) arr = arr.filter(m => m.createdAt < Number(cursor));
    arr.sort((a, b) => b.createdAt - a.createdAt);
    const page = arr.slice(0, Math.min(limit, 200));
    const nextCursor = page.length ? page[page.length - 1].createdAt : null;
    return { items: page, nextCursor };
}

/** List semua (tanpa paging) – untuk operasi bulk */
export async function all({ bucket } = {}) {
    await ensureLoaded();
    let arr = Array.from(cache.values());
    if (bucket) arr = arr.filter(m => m.bucket === bucket);
    arr.sort((a, b) => b.createdAt - a.createdAt);
    return arr;
}

export async function removeByFilename(name) {
    await ensureLoaded();
    const meta = byName.get(name);
    if (!meta) return null;
    cache.delete(meta.id);
    byName.delete(name);
    await persist();
    return meta;
}

/** Baru: remove by single id */
export async function removeById(id) {
    await ensureLoaded();
    const meta = cache.get(id);
    if (!meta) return null;
    cache.delete(id);
    byName.delete(meta.filename);
    await persist();
    return meta;
}

/** Baru: remove many by ids (sekali persist) */
export async function removeManyById(ids = []) {
    await ensureLoaded();
    const removed = [];
    const missing = [];
    for (const id of ids) {
        const m = cache.get(id);
        if (!m) {
            missing.push(id);
            continue;
        }
        cache.delete(id);
        byName.delete(m.filename);
        removed.push(m);
    }
    await persist();
    return { removed, missing };
}

/** Baru: remove semua entry di bucket tertentu (sekali persist) */
export async function removeByBucket(bucket) {
    await ensureLoaded();
    const toRemove = Array.from(cache.values()).filter(m => m.bucket === bucket);
    for (const m of toRemove) {
        cache.delete(m.id);
        byName.delete(m.filename);
    }
    await persist();
    return toRemove; // daftar meta yang dihapus (untuk hapus fisik)
}

/** Baru: clear semua entry (sekali persist) */
export async function clearAll() {
    await ensureLoaded();
    const allItems = Array.from(cache.values());
    cache.clear();
    byName.clear();
    await persist();
    return allItems;
}
