import { Router } from 'express';
import {
  getPlayersByTeamId,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  movePlayer,
  linkPlayerToUser,
  unlinkPlayerFromUser,
  getMyPlayerProfiles
} from '../controllers/playerController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlayerAccess, requireTeamAccess } from '../middleware/access.js';

const router = Router();

// Registered before '/:id' so it is not swallowed as a player id.
router.get('/me', authenticate, getMyPlayerProfiles);

router.get('/team/:teamId', getPlayersByTeamId);
router.get('/:id', getPlayerById);

router.post('/team/:teamId', authenticate, requireTeamAccess('teamId'), createPlayer);
router.put('/:id', authenticate, requirePlayerAccess(), updatePlayer);
router.delete('/:id', authenticate, requirePlayerAccess(), deletePlayer);
// movePlayer additionally checks the destination team inside the controller.
router.patch('/:id/move', authenticate, requirePlayerAccess(), movePlayer);

// Linking a roster row to an account is team administration, not self-service.
router.patch('/:id/link', authenticate, requirePlayerAccess(), linkPlayerToUser);
router.delete('/:id/link', authenticate, requirePlayerAccess(), unlinkPlayerFromUser);

export default router;
