import { Router } from 'express';
import {
  getAllSeasons,
  getMySeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  getSeasonStandings
} from '../controllers/seasonController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllSeasons);
router.get('/my', authenticate, getMySeasons);
router.get('/:id', getSeasonById);
router.get('/:id/standings', getSeasonStandings);

router.post('/', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createSeason);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateSeason);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteSeason);

export default router;
