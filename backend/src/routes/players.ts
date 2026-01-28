import { Router } from 'express';
import {
  getPlayersByTeamId,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  movePlayer
} from '../controllers/playerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/team/:teamId', getPlayersByTeamId);
router.get('/:id', getPlayerById);

router.post('/team/:teamId', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), createPlayer);
router.put('/:id', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), updatePlayer);
router.delete('/:id', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), deletePlayer);
router.patch('/:id/move', authenticate, authorize('ADMIN', 'SEASON_MANAGER'), movePlayer);

export default router;
