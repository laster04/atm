import { Router } from 'express';
import {
  getAllSeasons,
  getMySeasons,
  getSeasonById,
  getSeasonsByLeague,
  createSeason,
  updateSeason,
  deleteSeason,
  getSeasonStandings,
  getTeamStanding
} from '../controllers/seasonController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllSeasons);
router.get('/my', authenticate, getMySeasons);
router.get('/league/:leagueId', getSeasonsByLeague);
router.get('/:id', getSeasonById);
router.get('/:id/standings', getSeasonStandings);
router.get('/:id/standings/:teamId', getTeamStanding);

router.post('/', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createSeason);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateSeason);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteSeason);

export default router;
