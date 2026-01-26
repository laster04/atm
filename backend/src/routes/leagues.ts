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

// Protected routes - /my must come before /:id to avoid being caught by the param route
router.get('/my', authenticate, getMyLeagues);

// Public route with param
router.get('/:id', getLeagueById);
router.post('/', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createLeague);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateLeague);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteLeague);

export default router;
