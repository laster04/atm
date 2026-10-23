import { Router } from 'express';
import { getEmbedGames, getEmbedStandings, getEmbedTeams } from '../controllers/embedController.js';

const router = Router();

// The embedded widget: public, read-only, no sign-in. Visibility is checked
// inside, so a private competition answers the same as a missing one.
router.get('/:kind/:id/standings', getEmbedStandings);
router.get('/:kind/:id/games', getEmbedGames);
router.get('/:kind/:id/teams', getEmbedTeams);

export default router;
