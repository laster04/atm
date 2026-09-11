import { Router } from 'express';
import {
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
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/season/:seasonId/top', getTopScorersBySeason);
router.get('/season/:seasonId/team/:teamId', getScorersBySeasonAndTeam);
router.get('/season/:seasonId/archived', getArchivedPlayerStats);
router.get('/game/:gameId', getStatisticsByGameId);
router.get('/player/:playerId', getStatisticsByPlayerId);
router.get('/:id', getStatisticById);

// A statistic row is reachable by the league manager and by the manager of the
// team the player belongs to, so access needs both game and player: checked in
// the controller via canManageGameStatistic.
router.post('/game/:gameId', authenticate, createStatistic);
router.put('/:id', authenticate, updateStatistic);
router.delete('/:id', authenticate, deleteStatistic);

export default router;
