// central env reader + defaults
const str = (v, d = '') => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d);
const num = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
};
const list = (v) => str(v, '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

export const env = {
    PORT: str(process.env.PORT, '8080'),
    BASE_URL: str(process.env.BASE_URL, 'http://localhost:8080'),
    UPLOAD_DIR_PUBLIC: str(process.env.UPLOAD_DIR_PUBLIC, 'public'),
    ALLOWED_BUCKETS: list(process.env.ALLOWED_BUCKETS || 'preview-bounding-box,roi-face-cat,result'),
    ALLOWED_EXT: list(process.env.ALLOWED_EXT || 'jpg,jpeg,png,webp,pdf').map(s => s.toLowerCase()),
    MAX_FILE_MB: num(process.env.MAX_FILE_MB, 8),
    ALLOWED_ORIGINS: list(process.env.ALLOWED_ORIGINS || ''),
};
