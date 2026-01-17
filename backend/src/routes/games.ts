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

router.post('/season/:seasonId', authenticate, authorize('ADMIN'), createGame);
router.post('/season/:seasonId/generate', authenticate, authorize('ADMIN'), generateSchedule);
router.put('/:id', authenticate, authorize('ADMIN'), updateGame);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteGame);

export default router;
