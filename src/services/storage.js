import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
    filename: (req, file, cb) => {
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
    return {
        id,
        bucket,
        filename,
        originalName,
        mime,
        size,
        createdAt
    };
}

export function buildPublicUrl(bucket, filename) {
    return publicUrl(bucket, filename);
}
