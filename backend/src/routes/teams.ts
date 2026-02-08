import { Router } from 'express';
import {
  getMyTeams,
  getTeamsBySeasonId,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  inviteManager,
  addTeamToSeason,
  removeTeamFromSeason,
  getTeamsAvailableForSeason
} from '../controllers/teamController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/my', authenticate, getMyTeams);
router.get('/season/:seasonId', getTeamsBySeasonId);
router.get('/available/:seasonId', getTeamsAvailableForSeason);
router.get('/:id', getTeamById);

router.post('/season/:seasonId', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), createTeam);
router.post('/:id/seasons/:seasonId', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), addTeamToSeason);
router.delete('/:id/seasons/:seasonId', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), removeTeamFromSeason);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), updateTeam);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TEAM_MANAGER'), deleteTeam);
router.post('/:id/invite-manager', authenticate, authorize('ADMIN'), inviteManager);

export default router;
