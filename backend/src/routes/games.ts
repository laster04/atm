import { Router } from 'express';
import {
  getGamesBySeasonId,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  generateSchedule
} from '../controllers/gameController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/season/:seasonId', getGamesBySeasonId);
router.get('/:id', getGameById);

router.post('/season/:seasonId', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createGame);
router.post('/season/:seasonId/generate', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), generateSchedule);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateGame);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteGame);

export default router;
