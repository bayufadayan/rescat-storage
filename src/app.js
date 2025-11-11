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
app.use(cors({
    origin: function (origin, cb) {
        if (!origin) return cb(null, true); // allow curl/postman
        if (env.ALLOWED_ORIGINS.length === 0 || env.ALLOWED_ORIGINS.includes(origin)) {
            return cb(null, true);
        }
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: false
}));

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
