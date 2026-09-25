import { Router } from 'express';
import {
  getAllSeasons,
  getMySeasons,
  getSeasonById,
  getSeasonsByLeague,
  createSeason,
  updateSeason,
  deleteSeason,
  archiveSeason,
  getSeasonStandings,
  getTeamStanding,
  getArchivedStandings,
  getCopyableTeams,
  copyTeamsToSeason
} from '../controllers/seasonController.js';
import {
  previewRoundSummary,
  sendRoundSummary,
  listSentDigests,
  listUnsentGames,
  previewResultsEmail,
  sendResultsEmail,
  sendTestResultsEmail,
} from '../controllers/digestController.js';
import {
  getGroupsBySeason,
  createGroup,
  updateGroup,
  deleteGroup,
  assignTeamToGroup,
  getStandingsByGroup
} from '../controllers/seasonGroupController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireSeasonAccess, requireVisible } from '../middleware/access.js';

const router = Router();

router.get('/', optionalAuth, getAllSeasons);
router.get('/my', authenticate, getMySeasons);
router.get('/league/:leagueId', optionalAuth, requireVisible('league', 'leagueId'), getSeasonsByLeague);
router.get('/:id', optionalAuth, requireVisible('season'), getSeasonById);
router.get('/:id/standings', optionalAuth, requireVisible('season'), getSeasonStandings);
// Registered before '/:id/standings/:teamId' so it is not read as a team id.
router.get('/:id/standings/by-group', optionalAuth, requireVisible('season'), getStandingsByGroup);
router.get('/:id/standings/:teamId', optionalAuth, requireVisible('season'), getTeamStanding);
router.get('/:id/archived-standings', optionalAuth, requireVisible('season'), getArchivedStandings);
router.get('/:id/copyable-teams', authenticate, getCopyableTeams);

// createSeason checks access against the target league from the request body.
router.post('/', authenticate, createSeason);
router.post('/:id/archive', authenticate, requireSeasonAccess(), archiveSeason);
router.post('/:id/copy-teams', authenticate, requireSeasonAccess(), copyTeamsToSeason);
router.put('/:id', authenticate, requireSeasonAccess(), updateSeason);
router.delete('/:id', authenticate, requireSeasonAccess(), deleteSeason);

// Divisions and groups inside a season.
router.get('/:seasonId/groups', optionalAuth, requireVisible('season', 'seasonId'), getGroupsBySeason);
router.post('/:seasonId/groups', authenticate, requireSeasonAccess('seasonId'), createGroup);
router.put('/:seasonId/groups/:id', authenticate, requireSeasonAccess('seasonId'), updateGroup);
router.delete('/:seasonId/groups/:id', authenticate, requireSeasonAccess('seasonId'), deleteGroup);
router.put('/:seasonId/teams/:teamId/group', authenticate, requireSeasonAccess('seasonId'), assignTeamToGroup);

// Round summary emails. Building the preview and sending both belong to whoever
// runs the season, never to a team manager inside it.
router.get('/:id/digests', authenticate, requireSeasonAccess(), listSentDigests);
router.get('/:id/rounds/:round/summary', authenticate, requireSeasonAccess(), previewRoundSummary);
router.post('/:id/rounds/:round/summary', authenticate, requireSeasonAccess(), sendRoundSummary);
// Results email for hand-picked finished games that have not been mailed yet.
router.get('/:id/results-email', authenticate, requireSeasonAccess(), listUnsentGames);
router.post('/:id/results-email/preview', authenticate, requireSeasonAccess(), previewResultsEmail);
router.post('/:id/results-email/test', authenticate, requireSeasonAccess(), sendTestResultsEmail);
router.post('/:id/results-email', authenticate, requireSeasonAccess(), sendResultsEmail);

export default router;
