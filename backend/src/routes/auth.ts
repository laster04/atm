import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  activateAccount,
  resendActivationEmail,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/activate/:token', activateAccount);
router.post('/resend-activation', resendActivationEmail);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.get('/users', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), getUsers);
router.post('/users', authenticate, authorize('ADMIN'), createUser);
router.put('/users/:id', authenticate, authorize('ADMIN'), updateUser);
router.delete('/users/:id', authenticate, authorize('ADMIN'), deleteUser);

export default router;
