import fs from 'fs';
import path from 'path';
import {
    uploadSingle,
    ensureBucket,
    buildPublicUrl,
    deleteFilePhysical,
    emptyBucketPhysical
} from '../services/storage.js';

import {
    insert,
    list as idxList,
    getById,
    getByFilename,
    removeByFilename,
    removeById,
    removeManyById,
    removeByBucket as idxRemoveByBucket,
    clearAll,
    all as idxAll
} from '../services/fileIndex.js';

import { env } from '../utils/env.js';

function safeName(name) {
    return /^[0-9]{13}-[0-9a-f-]{36}\.[a-z0-9]+$/.test(name);
}

// POST /api/files
export async function uploadOne(req, res) {
    uploadSingle(req, res, async (err) => {
        if (err) {
            const code = String(err.message || err).toUpperCase();
            const status = (code === 'EXT_NOT_ALLOWED' || code === 'BUCKET_NOT_ALLOWED') ? 400 : 413;
            return res.status(status).json({ ok: false, error: code });
        }
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'NO_FILE' });
        }
        const bucket = (req.body.bucket || '').trim() || 'preview-bounding-box';
        if (!ensureBucket(bucket)) {
            return res.status(400).json({ ok: false, error: 'BUCKET_NOT_ALLOWED' });
        }
        const { filename, size, mimetype, originalname } = req.file;
        const createdAt = Date.now();
        const meta = {
            id: (globalThis.crypto?.randomUUID?.() ?? `${createdAt}-${Math.random()}`),
            bucket,
            filename,
            originalName: originalname,
            mime: mimetype,
            size,
            createdAt
        };
        await insert(meta);
        return res.json({
            ok: true,
            data: { ...meta, url: buildPublicUrl(bucket, filename) }
        });
    });
}

// GET /api/files
export async function listAll(req, res) {
    const bucket = (req.query.bucket || '').trim() || undefined;
    if (bucket && !ensureBucket(bucket)) {
        return res.status(400).json({ ok: false, error: 'BUCKET_NOT_ALLOWED' });
    }
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const cursor = req.query.cursor || undefined;
    const out = await idxList({ bucket, limit, cursor });
    return res.json({ ok: true, ...out });
}

// GET /api/files/:id
export async function getByIdCtrl(req, res) {
    const id = req.params.id;
    const meta = await getById(id);
    if (!meta) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, data: { ...meta, url: buildPublicUrl(meta.bucket, meta.filename) } });
}

// GET /api/files/by-name/:filename
export async function getByNameCtrl(req, res) {
    const name = req.params.filename;
    if (!safeName(name)) return res.status(400).json({ ok: false, error: 'BAD_NAME' });
    const meta = await getByFilename(name);
    if (!meta) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, data: { ...meta, url: buildPublicUrl(meta.bucket, meta.filename) } });
}

// DELETE /api/files/by-name/:filename
export async function deleteByNameCtrl(req, res) {
    const name = req.params.filename;
    if (!safeName(name)) return res.status(400).json({ ok: false, error: 'BAD_NAME' });
    const meta = await getByFilename(name);
    if (!meta) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    const full = path.join(env.UPLOAD_DIR_PUBLIC, meta.bucket, meta.filename);
    try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch { /* ignore */ }
    await removeByFilename(name);
    return res.json({ ok: true, deleted: name });
}

/** ========= Baru: GET by bucket name =========
 * GET /api/files/bucket/:bucket?limit=&cursor=
 * (alias dari listAll dengan filter bucket)
 */
export async function getByBucketCtrl(req, res) {
    const bucket = (req.params.bucket || '').trim();
    if (!ensureBucket(bucket)) {
        return res.status(400).json({ ok: false, error: 'BUCKET_NOT_ALLOWED' });
    }
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const cursor = req.query.cursor || undefined;
    const out = await idxList({ bucket, limit, cursor });
    return res.json({ ok: true, bucket, ...out });
}

/** ========= Baru: DELETE selected id(s) =========
 * DELETE /api/files/selected
 * body: { ids: string[] }
 */
export async function deleteSelectedIdsCtrl(req, res) {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) {
        return res.status(400).json({ ok: false, error: 'NO_IDS' });
    }

    // Ambil semua meta dulu supaya bisa hapus fisik
    const metas = await Promise.all(ids.map(async (id) => await getById(id)));
    const existMetas = metas.filter(Boolean);

    // Hapus fisik paralel (yang ada metanya saja)
    const diskResults = await Promise.allSettled(
        existMetas.map(m => deleteFilePhysical(m.bucket, m.filename))
    );

    // Update index sekaligus
    const { removed, missing } = await removeManyById(ids);

    // Satukan hasil (removedDisk true/false per meta)
    const items = existMetas.map((m, i) => ({
        id: m.id,
        bucket: m.bucket,
        filename: m.filename,
        removedDisk: (diskResults[i].status === 'fulfilled')
    }));

    return res.json({
        ok: true,
        requested: ids.length,
        removed: removed.length,
        missing, // id yang tidak ada di index
        items
    });
}

/** ========= Baru: DELETE by bucket (kosongin bucket) =========
 * DELETE /api/files/bucket/:bucket
 */
export async function deleteBucketCtrl(req, res) {
    const bucket = (req.params.bucket || '').trim();
    if (!ensureBucket(bucket)) {
        return res.status(400).json({ ok: false, error: 'BUCKET_NOT_ALLOWED' });
    }

    // Ambil semua meta di bucket dari index dan hapus index (sekali persist)
    const deletedMetas = await idxRemoveByBucket(bucket);

    // Hapus fisik paralel
    const diskResults = await Promise.allSettled(
        deletedMetas.map(m => deleteFilePhysical(m.bucket, m.filename))
    );

    // (Opsional) bersihkan sisa file tak terindeks di folder bucket
    // Agar benar-benar kosong:
    await emptyBucketPhysical(bucket).catch(() => null);

    return res.json({
        ok: true,
        bucket,
        count: deletedMetas.length,
        items: deletedMetas.map((m, i) => ({
            id: m.id,
            filename: m.filename,
            removedDisk: (diskResults[i]?.status === 'fulfilled')
        }))
    });
}

/** ========= Baru: DELETE all (semua bucket diizinkan) =========
 * DELETE /api/files?confirm=yes
 */
export async function deleteAllCtrl(req, res) {
    if ((req.query.confirm || '').toLowerCase() !== 'yes') {
        return res.status(400).json({ ok: false, error: 'CONFIRM_REQUIRED', hint: 'Add ?confirm=yes' });
    }

    // Ambil semua meta lalu clear index
    const allMetas = await idxAll();
    await clearAll();

    // Hapus fisik paralel
    const diskResults = await Promise.allSettled(
        allMetas.map(m => deleteFilePhysical(m.bucket, m.filename))
    );

    // Kosongkan semua folder bucket untuk jaga-jaga
    for (const b of env.ALLOWED_BUCKETS) {
        await emptyBucketPhysical(b).catch(() => null);
    }

    return res.json({
        ok: true,
        total: allMetas.length,
        items: allMetas.map((m, i) => ({
            id: m.id,
            bucket: m.bucket,
            filename: m.filename,
            removedDisk: (diskResults[i]?.status === 'fulfilled')
        }))
    });
}
