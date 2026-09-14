import { Router } from 'express';
import {
  getPublicGames,
  getGamesBySeasonId,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  generateSchedule,
  confirmGame,
  reopenGame,
  getGameAudit
} from '../controllers/gameController.js';
import {
  getEventsByGameId,
  createEvent,
  updateEvent,
  deleteEvent
} from '../controllers/matchEventController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireGameAccess, requireMatchEventAccess, requireSeasonAccess, requireVisible } from '../middleware/access.js';

const router = Router();

// Public fixture list across every season: upcoming, live or results.
router.get('/', optionalAuth, getPublicGames);
router.get('/season/:seasonId', optionalAuth, requireVisible('season', 'seasonId'), getGamesBySeasonId);
router.get('/:id', optionalAuth, requireVisible('game'), getGameById);

router.post('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), createGame);
router.post('/season/:seasonId/generate', authenticate, requireSeasonAccess('seasonId'), generateSchedule);
router.put('/:id', authenticate, requireGameAccess(), updateGame);
router.delete('/:id', authenticate, requireGameAccess(), deleteGame);

// Closing and reopening a match report, and the trail that explains why.
router.post('/:id/confirm', authenticate, requireGameAccess(), confirmGame);
router.post('/:id/reopen', authenticate, requireGameAccess(), reopenGame);
router.get('/:id/audit', authenticate, requireGameAccess(), getGameAudit);

// The event log a game's score and player statistics are derived from. Two
// segments deep, so none of these collide with the '/:id' routes above.
router.get('/:gameId/events', optionalAuth, requireVisible('game', 'gameId'), getEventsByGameId);
router.post('/:gameId/events', authenticate, requireGameAccess('gameId'), createEvent);
router.put('/events/:id', authenticate, requireMatchEventAccess(), updateEvent);
router.delete('/events/:id', authenticate, requireMatchEventAccess(), deleteEvent);

export default router;
