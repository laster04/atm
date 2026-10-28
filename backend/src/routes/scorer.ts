import { Router } from 'express';
import { addScorerGoal, deleteScorerGoal, finishScoredGame, getScorerPage } from '../controllers/scorerLinkController.js';
import {
  addCourtGoal,
  deleteCourtGoal,
  finishCourtGame,
  getCourtPage,
  setCourtSets,
} from '../controllers/tournamentScorerLinkController.js';

const router = Router();

// The scorekeeper's side of a scorer link: no account, the link's token is the
// credential and it opens one game. The season manager's side is in games.ts.
// A tournament link opens the games of one court; the organiser's side is in tournaments.ts.
router.get('/t/:token', getCourtPage);
router.post('/t/:token/games/:gameId/goals', addCourtGoal);
router.delete('/t/:token/games/:gameId/goals/:goalId', deleteCourtGoal);
router.put('/t/:token/games/:gameId/sets', setCourtSets);
router.post('/t/:token/games/:gameId/finish', finishCourtGame);

router.get('/:token', getScorerPage);
router.post('/:token/goals', addScorerGoal);
router.delete('/:token/goals/:eventId', deleteScorerGoal);
router.post('/:token/finish', finishScoredGame);

export default router;
