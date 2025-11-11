import fs from 'fs';
import path from 'path';
import { uploadSingle, ensureBucket, buildPublicUrl } from '../services/storage.js';
import { insert, list as idxList, getById, getByFilename, removeByFilename } from '../services/fileIndex.js';
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
            id: crypto.randomUUID ? crypto.randomUUID() : `${createdAt}-${Math.random()}`,
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
            data: {
                ...meta,
                url: buildPublicUrl(bucket, filename)
            }
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
    } catch { }
    await removeByFilename(name);
    return res.json({ ok: true, deleted: name });
}
