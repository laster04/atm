import { Router } from 'express';
import {
  getAllLeagues,
  getMyLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
} from '../controllers/leagueController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', getAllLeagues);
router.get('/:id', getLeagueById);

// Protected routes
router.get('/my', authenticate, getMyLeagues);
router.post('/', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createLeague);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateLeague);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteLeague);

export default router;
