import path from 'path';
import { env } from './env.js';

export function bucketPath(bucket) {
    return path.join(env.UPLOAD_DIR_PUBLIC, bucket);
}

export function filePath(bucket, filename) {
    return path.join(bucketPath(bucket), filename);
}

export function publicUrl(bucket, filename) {
    // /files maps to UPLOAD_DIR_PUBLIC
    return `${env.BASE_URL}/files/${bucket}/${filename}`;
}
