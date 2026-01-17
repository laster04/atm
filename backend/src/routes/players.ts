import { Router } from 'express';
import {
  getPlayersByTeamId,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer
} from '../controllers/playerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/team/:teamId', getPlayersByTeamId);
router.get('/:id', getPlayerById);

router.post('/team/:teamId', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), createPlayer);
router.put('/:id', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), updatePlayer);
router.delete('/:id', authenticate, authorize('ADMIN', 'TEAM_MANAGER'), deletePlayer);

export default router;
