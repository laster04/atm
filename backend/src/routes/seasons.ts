import { Router } from 'express';
import {
  getAllSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  getSeasonStandings
} from '../controllers/seasonController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllSeasons);
router.get('/:id', getSeasonById);
router.get('/:id/standings', getSeasonStandings);

router.post('/', authenticate, authorize('ADMIN'), createSeason);
router.put('/:id', authenticate, authorize('ADMIN'), updateSeason);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteSeason);

export default router;
