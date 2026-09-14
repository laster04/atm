import { Router } from 'express';
import {
  getTopScorers,
  getStatisticsByGameId,
  getStatisticsByPlayerId,
  getStatisticById,
  createStatistic,
  updateStatistic,
  deleteStatistic,
  getTopScorersBySeason,
    getScorersBySeasonAndTeam,
    getArchivedPlayerStats
} from '../controllers/gameStatisticController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireVisible } from '../middleware/access.js';

const router = Router();

// App-wide scoring leaders; the season board stays below.
router.get('/top', optionalAuth, getTopScorers);
router.get('/season/:seasonId/top', optionalAuth, requireVisible('season', 'seasonId'), getTopScorersBySeason);
router.get('/season/:seasonId/team/:teamId', optionalAuth, requireVisible('season', 'seasonId'), getScorersBySeasonAndTeam);
router.get('/season/:seasonId/archived', optionalAuth, requireVisible('season', 'seasonId'), getArchivedPlayerStats);
router.get('/game/:gameId', optionalAuth, requireVisible('game', 'gameId'), getStatisticsByGameId);
router.get('/player/:playerId', optionalAuth, getStatisticsByPlayerId);
router.get('/:id', optionalAuth, requireVisible('gameStatistic'), getStatisticById);

// A statistic row is reachable by the league manager and by the manager of the
// team the player belongs to, so access needs both game and player: checked in
// the controller via canManageGameStatistic.
router.post('/game/:gameId', authenticate, createStatistic);
router.put('/:id', authenticate, updateStatistic);
router.delete('/:id', authenticate, deleteStatistic);

export default router;
