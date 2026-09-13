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
  listSentDigests
} from '../controllers/digestController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireSeasonAccess } from '../middleware/access.js';

const router = Router();

router.get('/', optionalAuth, getAllSeasons);
router.get('/my', authenticate, getMySeasons);
router.get('/league/:leagueId', optionalAuth, getSeasonsByLeague);
router.get('/:id', getSeasonById);
router.get('/:id/standings', getSeasonStandings);
router.get('/:id/standings/:teamId', getTeamStanding);
router.get('/:id/archived-standings', getArchivedStandings);
router.get('/:id/copyable-teams', authenticate, getCopyableTeams);

// createSeason checks access against the target league from the request body.
router.post('/', authenticate, createSeason);
router.post('/:id/archive', authenticate, requireSeasonAccess(), archiveSeason);
router.post('/:id/copy-teams', authenticate, requireSeasonAccess(), copyTeamsToSeason);
router.put('/:id', authenticate, requireSeasonAccess(), updateSeason);
router.delete('/:id', authenticate, requireSeasonAccess(), deleteSeason);

// Round summary emails. Building the preview and sending both belong to whoever
// runs the season, never to a team manager inside it.
router.get('/:id/digests', authenticate, requireSeasonAccess(), listSentDigests);
router.get('/:id/rounds/:round/summary', authenticate, requireSeasonAccess(), previewRoundSummary);
router.post('/:id/rounds/:round/summary', authenticate, requireSeasonAccess(), sendRoundSummary);

export default router;
