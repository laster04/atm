import { Router } from 'express';
import {
  getTeamsBySeasonId,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam
} from '../controllers/teamController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/season/:seasonId', getTeamsBySeasonId);
router.get('/:id', getTeamById);

router.post('/season/:seasonId', authenticate, authorize('ADMIN'), createTeam);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteTeam);

router.put('/:id', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), updateTeam);

export default router;
