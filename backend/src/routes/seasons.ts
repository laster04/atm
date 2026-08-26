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
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, getAllSeasons);
router.get('/my', authenticate, getMySeasons);
router.get('/league/:leagueId', optionalAuth, getSeasonsByLeague);
router.get('/:id', getSeasonById);
router.get('/:id/standings', getSeasonStandings);
router.get('/:id/standings/:teamId', getTeamStanding);
router.get('/:id/archived-standings', getArchivedStandings);
router.get('/:id/copyable-teams', authenticate, getCopyableTeams);

router.post('/', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createSeason);
router.post('/:id/archive', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), archiveSeason);
router.post('/:id/copy-teams', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), copyTeamsToSeason);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateSeason);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteSeason);

export default router;
