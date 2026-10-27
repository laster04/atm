import { Router } from 'express';
import {
  getPublicGames,
  getGamesBySeasonId,
  getGameById,
  getGameDetail,
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
import { getResultClaims, getSeasonResultClaims, submitResultClaim } from '../controllers/resultClaimController.js';
import { createScorerLink, getScorerLink, revokeScorerLink } from '../controllers/scorerLinkController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireGameAccess, requireMatchEventAccess, requireSeasonAccess, requireVisible } from '../middleware/access.js';

const router = Router();

// Public fixture list across every season: upcoming, live or results.
router.get('/', optionalAuth, getPublicGames);
router.get('/season/:seasonId', optionalAuth, requireVisible('season', 'seasonId'), getGamesBySeasonId);
router.get('/:id/detail', optionalAuth, requireVisible('game'), getGameDetail);
router.get('/:id', optionalAuth, requireVisible('game'), getGameById);

router.post('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), createGame);
router.post('/season/:seasonId/generate', authenticate, requireSeasonAccess('seasonId'), generateSchedule);
router.put('/:id', authenticate, requireGameAccess(), updateGame);
router.delete('/:id', authenticate, requireGameAccess(), deleteGame);

// Closing and reopening a match report, and the trail that explains why.
router.post('/:id/confirm', authenticate, requireGameAccess(), confirmGame);
router.post('/:id/reopen', authenticate, requireGameAccess(), reopenGame);
router.get('/:id/audit', authenticate, requireGameAccess(), getGameAudit);

// Each team's word on the final score. Two matching words settle the game; the
// controller checks who may read and send them, as both teams and the season do.
router.get('/season/:seasonId/result-claims', authenticate, requireSeasonAccess('seasonId'), getSeasonResultClaims);
router.get('/:id/result-claims', authenticate, getResultClaims);
router.put('/:id/result-claims/:teamId', authenticate, submitResultClaim);

// The link the season manager hands to a scorekeeper without an account. The
// scorer's own side is in routes/scorer.ts.
router.get('/:id/scorer-link', authenticate, requireGameAccess(), getScorerLink);
router.post('/:id/scorer-link', authenticate, requireGameAccess(), createScorerLink);
router.delete('/:id/scorer-link', authenticate, requireGameAccess(), revokeScorerLink);

// The event log a game's score and player statistics are derived from. Two
// segments deep, so none of these collide with the '/:id' routes above.
router.get('/:gameId/events', optionalAuth, requireVisible('game', 'gameId'), getEventsByGameId);
router.post('/:gameId/events', authenticate, requireGameAccess('gameId'), createEvent);
router.put('/events/:id', authenticate, requireMatchEventAccess(), updateEvent);
router.delete('/events/:id', authenticate, requireMatchEventAccess(), deleteEvent);

export default router;
