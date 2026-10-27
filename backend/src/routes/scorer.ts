import { Router } from 'express';
import { addScorerGoal, deleteScorerGoal, finishScoredGame, getScorerPage } from '../controllers/scorerLinkController.js';

const router = Router();

// The scorekeeper's side of a scorer link: no account, the link's token is the
// credential and it opens one game. The season manager's side is in games.ts.
router.get('/:token', getScorerPage);
router.post('/:token/goals', addScorerGoal);
router.delete('/:token/goals/:eventId', deleteScorerGoal);
router.post('/:token/finish', finishScoredGame);

export default router;
