import { Router } from 'express';
import {
  getGamesBySeasonId,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  generateSchedule
} from '../controllers/gameController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGameAccess, requireSeasonAccess } from '../middleware/access.js';

const router = Router();

router.get('/season/:seasonId', getGamesBySeasonId);
router.get('/:id', getGameById);

router.post('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), createGame);
router.post('/season/:seasonId/generate', authenticate, requireSeasonAccess('seasonId'), generateSchedule);
router.put('/:id', authenticate, requireGameAccess(), updateGame);
router.delete('/:id', authenticate, requireGameAccess(), deleteGame);

export default router;
