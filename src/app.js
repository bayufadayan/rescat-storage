import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import filesRoutes from './routes/filesRoutes.js';
import { env } from './utils/env.js';

const app = express();

// security & perf
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// logs
app.use(morgan('dev'));

// body parsers
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// CORS whitelist
app.use(
    cors({
        origin: function (origin, cb) {
            const allowed = [
                "https://app.rescat.life",
                "https://ml.rescat.life",
                "https://content.rescat.life",
                "http://127.0.0.1:5000",
                "http://127.0.0.1:8000",
                "http://localhost:5000",
                "http://localhost:8000",
            ];

            if (!origin) return cb(null, true); // allow curl/postman
            if (allowed.includes(origin)) return cb(null, true);

            console.warn("❌ CORS blocked:", origin);
            return cb(new Error("Not allowed by CORS"));
        },
        credentials: false,
    })
);

// optional preflight handler (biar aman di semua route)
app.options(/.*/, cors());

// static serving for public files at /files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/files', express.static(env.UPLOAD_DIR_PUBLIC, {
    etag: true,
    immutable: true,
    maxAge: '365d',
}));

// health check
app.get('/', (_req, res) => {
    res.status(200).json({ message: 'Backend is running successfully 🚀' });
});

// mount routes
app.use('/api/files', filesRoutes);

export default app;
