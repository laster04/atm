import { Router } from 'express';
import { register, login, getMe, updateProfile, getUsers } from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.get('/users', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), getUsers);

export default router;
