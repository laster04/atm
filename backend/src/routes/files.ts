import { Router } from 'express';
import { getSignedLocalFile, parseLogoUpload, uploadLogo } from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Any signed-in user may upload: the file is only used once a save the user is
// allowed to make references it, and unused uploads are swept after a day.
router.post('/logo', authenticate, parseLogoUpload, uploadLogo);
router.get('/signed/*', getSignedLocalFile);

export default router;
