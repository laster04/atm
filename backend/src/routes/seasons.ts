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

export default router;
