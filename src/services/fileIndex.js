import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// Index metadata sederhana: data/index.json
const INDEX_FILE = path.join('data', 'index.json');

let cache = new Map(); // id -> meta
let byName = new Map(); // filename -> meta
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
    } catch (e) {
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

export async function removeByFilename(name) {
    await ensureLoaded();
    const meta = byName.get(name);
    if (!meta) return null;
    cache.delete(meta.id);
    byName.delete(name);
    await persist();
    return meta;
}
