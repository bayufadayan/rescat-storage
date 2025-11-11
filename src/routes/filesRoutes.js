import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { uploadOne, listAll, getByIdCtrl, getByNameCtrl, deleteByNameCtrl } from '../controllers/filesController.js';

const router = Router();

// rate-limit khusus upload
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
});

// routes
router.post('/', uploadLimiter, uploadOne);
router.get('/', listAll);
router.get('/:id', getByIdCtrl);
router.get('/by-name/:filename', getByNameCtrl);
router.delete('/by-name/:filename', deleteByNameCtrl);

export default router;
