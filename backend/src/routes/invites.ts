import { Router } from 'express';
import {
  accept,
  getByToken,
  getLeagueInvites,
  getSeasonInvites,
  getTeamInvite,
  resend,
  revoke,
} from '../controllers/inviteController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { requireSeasonAccess, requireTeamAdmin } from '../middleware/access.js';

const router = Router();

// The invitee's side: the link's token is the credential. Accepting reads the
// signed-in user when there is one, for someone who already has an account.
router.get('/token/:token', getByToken);
router.post('/token/:token/accept', optionalAuth, accept);

// The inviter's side. Sending lives on the team and league routes.
router.get('/season/:seasonId', authenticate, requireSeasonAccess('seasonId'), getSeasonInvites);
router.get('/team/:id', authenticate, requireTeamAdmin(), getTeamInvite);
router.get('/leagues', authenticate, authorize('ADMIN'), getLeagueInvites);
router.post('/:id/resend', authenticate, resend);
router.delete('/:id', authenticate, revoke);

export default router;
