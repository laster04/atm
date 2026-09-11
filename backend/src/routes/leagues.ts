import { Router } from 'express';
import {
  getAllLeagues,
  getMyLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
  inviteManager,
} from '../controllers/leagueController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireLeagueAccess } from '../middleware/access.js';

const router = Router();

// Public routes
router.get('/', getAllLeagues);

// Protected routes - /my must come before /:id to avoid being caught by the param route
router.get('/my', authenticate, getMyLeagues);

// Public route with param
router.get('/:id', getLeagueById);
// Any signed-in user may start a league and becomes its manager (free tier).
// Quota limits belong in createLeague, not in a role check.
router.post('/', authenticate, createLeague);
router.put('/:id', authenticate, requireLeagueAccess(), updateLeague);
router.delete('/:id', authenticate, requireLeagueAccess(), deleteLeague);
router.post('/:id/invite-manager', authenticate, authorize('ADMIN'), inviteManager);

export default router;
