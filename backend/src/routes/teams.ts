import { Router } from 'express';
import {
  getMyTeams,
  getPublicTeams,
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
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireSeasonAccess, requireTeamAccess, requireTeamAdmin, requireVisible } from '../middleware/access.js';

const router = Router();

// Public directory of every team; the manager lists stay season-scoped below.
router.get('/', optionalAuth, getPublicTeams);
router.get('/my', authenticate, getMyTeams);
router.get('/season/:seasonId', optionalAuth, requireVisible('season', 'seasonId'), getTeamsBySeasonId);
// Every team not yet in the season, with its manager's address: a tool for the
// people setting the season up, not a public list.
router.get('/available/:seasonId', authenticate, requireSeasonAccess('seasonId'), getTeamsAvailableForSeason);
router.get('/:id', optionalAuth, getTeamById);

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
