import crypto from 'crypto';

export function genId() {
    // uuid v4
    return crypto.randomUUID();
}

export function nameWithTsAndId(originalName) {
    const ts = Date.now();
    const ext = (originalName?.split('.').pop() || '').toLowerCase();
    const id = genId();
    return { filename: `${ts}-${id}${ext ? '.' + ext : ''}`, ts, id };
}
