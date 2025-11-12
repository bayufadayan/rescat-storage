import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { env } from '../utils/env.js';
import { nameWithTsAndId, genId } from '../utils/id.js';
import { publicUrl } from '../utils/paths.js';

export function ensureBucket(bucket) {
    return env.ALLOWED_BUCKETS.includes(bucket);
}

export function ensureExtAllowed(originalName) {
    const ext = (originalName?.split('.').pop() || '').toLowerCase();
    return ext && env.ALLOWED_EXT.includes(ext);
}

export function ensureSizeLimit() {
    return env.MAX_FILE_MB * 1024 * 1024;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bucket = (req.body.bucket || '').trim() || 'preview-bounding-box';
        if (!ensureBucket(bucket)) {
            return cb(new Error('BUCKET_NOT_ALLOWED'));
        }
        const dir = path.join(env.UPLOAD_DIR_PUBLIC, bucket);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        if (!ensureExtAllowed(file.originalname)) {
            return cb(new Error('EXT_NOT_ALLOWED'));
        }
        const { filename } = nameWithTsAndId(file.originalname);
        cb(null, filename);
    }
});

function fileFilter(_req, file, cb) {
    if (!ensureExtAllowed(file.originalname)) {
        return cb(new Error('EXT_NOT_ALLOWED'), false);
    }
    cb(null, true);
}

export const uploadSingle = multer({
    storage,
    fileFilter,
    limits: { fileSize: ensureSizeLimit() }
}).single('file');

export function toMeta({ bucket, filename, originalName, size, mime, createdAt }) {
    const id = genId();
    return { id, bucket, filename, originalName, mime, size, createdAt };
}

export function buildPublicUrl(bucket, filename) {
    return publicUrl(bucket, filename);
}

/** ====== Tambahan util untuk delete fisik ====== */

function absFilePath(bucket, filename) {
    return path.join(env.UPLOAD_DIR_PUBLIC, bucket, filename);
}

/** Hapus satu file di disk; return true kalau terhapus atau memang tidak ada */
export async function deleteFilePhysical(bucket, filename) {
    const full = absFilePath(bucket, filename);
    try {
        await fsp.unlink(full);
        return true;
    } catch (e) {
        if (e?.code === 'ENOENT') return false; // sudah tidak ada
        // error lain tetap dilempar agar caller bisa log
        throw e;
    }
}

/** Daftar semua nama file (level 1) di bucket (abaikan error kalau folder belum ada) */
export async function listBucketNames(bucket) {
    const dir = path.join(env.UPLOAD_DIR_PUBLIC, bucket);
    try {
        const names = await fsp.readdir(dir);
        return names.filter(Boolean);
    } catch (e) {
        if (e?.code === 'ENOENT') return [];
        throw e;
    }
}

/** Kosongkan folder bucket di disk (tanpa menghapus foldernya). Return jumlah file yang diattempt. */
export async function emptyBucketPhysical(bucket) {
    const names = await listBucketNames(bucket);
    const dir = path.join(env.UPLOAD_DIR_PUBLIC, bucket);
    const ops = names.map((n) => fsp.unlink(path.join(dir, n)).catch(() => null));
    await Promise.allSettled(ops);
    return names.length;
}
