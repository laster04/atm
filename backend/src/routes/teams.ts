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
import { authenticate } from '../middleware/auth.js';
import { requireSeasonAccess, requireTeamAccess, requireTeamAdmin } from '../middleware/access.js';

const router = Router();

router.get('/my', authenticate, getMyTeams);
router.get('/season/:seasonId', getTeamsBySeasonId);
router.get('/available/:seasonId', getTeamsAvailableForSeason);
router.get('/:id', getTeamById);

// Entering/removing a team from a season, and deleting it outright, are league
// decisions, so they are guarded by the season rather than by the team.
router.post('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), createTeam);
router.post('/:id/seasons/:seasonId', authenticate, requireSeasonAccess('seasonId'), addTeamToSeason);
router.delete('/:id/seasons/:seasonId', authenticate, requireSeasonAccess('seasonId'), removeTeamFromSeason);
router.put('/:id', authenticate, requireTeamAccess(), updateTeam);
// Deleting a team or naming its manager is a league decision, so the team's own
// manager cannot do either.
router.delete('/:id', authenticate, requireTeamAdmin(), deleteTeam);
router.post('/:id/invite-manager', authenticate, requireTeamAdmin(), inviteManager);

export default router;
