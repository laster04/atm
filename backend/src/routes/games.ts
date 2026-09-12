import { Router } from 'express';
import {
  getGamesBySeasonId,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  generateSchedule
} from '../controllers/gameController.js';
import {
  getEventsByGameId,
  createEvent,
  updateEvent,
  deleteEvent
} from '../controllers/matchEventController.js';
import { authenticate } from '../middleware/auth.js';
import { requireGameAccess, requireMatchEventAccess, requireSeasonAccess } from '../middleware/access.js';

const router = Router();

router.get('/season/:seasonId', getGamesBySeasonId);
router.get('/:id', getGameById);

router.post('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), createGame);
router.post('/season/:seasonId/generate', authenticate, requireSeasonAccess('seasonId'), generateSchedule);
router.put('/:id', authenticate, requireGameAccess(), updateGame);
router.delete('/:id', authenticate, requireGameAccess(), deleteGame);

// The event log a game's score and player statistics are derived from. Two
// segments deep, so none of these collide with the '/:id' routes above.
router.get('/:gameId/events', getEventsByGameId);
router.post('/:gameId/events', authenticate, requireGameAccess('gameId'), createEvent);
router.put('/events/:id', authenticate, requireMatchEventAccess(), updateEvent);
router.delete('/events/:id', authenticate, requireMatchEventAccess(), deleteEvent);

export default router;
