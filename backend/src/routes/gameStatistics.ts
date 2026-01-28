import { Router } from 'express';
import {
  getStatisticsByGameId,
  getStatisticsByPlayerId,
  getStatisticById,
  createStatistic,
  updateStatistic,
  deleteStatistic,
  getTopScorersBySeason
} from '../controllers/gameStatisticController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/season/:seasonId/top', getTopScorersBySeason);
router.get('/game/:gameId', getStatisticsByGameId);
router.get('/player/:playerId', getStatisticsByPlayerId);
router.get('/:id', getStatisticById);

router.post('/game/:gameId', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), createStatistic);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), updateStatistic);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), deleteStatistic);

export default router;
