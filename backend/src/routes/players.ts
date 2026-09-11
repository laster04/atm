import { Router } from 'express';
import {
  getPlayersByTeamId,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  movePlayer
} from '../controllers/playerController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlayerAccess, requireTeamAccess } from '../middleware/access.js';

const router = Router();

router.get('/team/:teamId', getPlayersByTeamId);
router.get('/:id', getPlayerById);

router.post('/team/:teamId', authenticate, requireTeamAccess('teamId'), createPlayer);
router.put('/:id', authenticate, requirePlayerAccess(), updatePlayer);
router.delete('/:id', authenticate, requirePlayerAccess(), deletePlayer);
// movePlayer additionally checks the destination team inside the controller.
router.patch('/:id/move', authenticate, requirePlayerAccess(), movePlayer);

export default router;
