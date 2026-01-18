import { Router } from 'express';
import {
  getMyTeams,
  getTeamsBySeasonId,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam
} from '../controllers/teamController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/my', authenticate, getMyTeams);
router.get('/season/:seasonId', getTeamsBySeasonId);
router.get('/:id', getTeamById);

router.post('/season/:seasonId', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), createTeam);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), updateTeam);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), deleteTeam);

export default router;
