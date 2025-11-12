import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    uploadOne,
    listAll,
    getByIdCtrl,
    getByNameCtrl,
    deleteByNameCtrl,
    getByBucketCtrl,
    deleteSelectedIdsCtrl,
    deleteBucketCtrl,
    deleteAllCtrl
} from '../controllers/filesController.js';

const router = Router();

// rate-limit khusus upload
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
});

// --- Create / Read ---
router.post('/', uploadLimiter, uploadOne);
router.get('/', listAll); // ?bucket=&limit=&cursor=
router.get('/bucket/:bucket', getByBucketCtrl);
router.get('/by-name/:filename', getByNameCtrl);
router.get('/:id', getByIdCtrl);

// --- Delete ---
router.delete('/by-name/:filename', deleteByNameCtrl);
router.delete('/selected', deleteSelectedIdsCtrl); // body: { ids: [] }
router.delete('/bucket/:bucket', deleteBucketCtrl);
router.delete('/', deleteAllCtrl); // ?confirm=yes

export default router;
