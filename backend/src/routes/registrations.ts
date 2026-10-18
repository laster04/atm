import { NextFunction, Response, Router } from 'express';
import {
  approve,
  getForm,
  getFunnel,
  getInbox,
  getSettings,
  getStatus,
  listManaged,
  listMine,
  promote,
  reject,
  submit,
  updateSettings,
  waitlist,
  withdraw,
  withdrawByStatusToken,
} from '../controllers/registrationController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { requireVisible } from '../middleware/access.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// A form only exists for a competition its viewer may see: an unlisted season
// works through its link, a private one does not.
const visible = (req: AuthRequest, res: Response, next: NextFunction) =>
  requireVisible(req.params.kind === 'season' ? 'season' : 'tournament')(req, res, next);

// The applicant's side.
router.get('/mine', authenticate, listMine);
router.post('/:id/withdraw', authenticate, withdraw);
// A tournament applicant without an account follows the link from their receipt.
router.get('/status/:token', getStatus);
router.post('/status/:token/withdraw', withdrawByStatusToken);

// The manager's side; access is checked per competition in the controller.
router.get('/:kind(season|tournament)/:id/settings', authenticate, getSettings);
router.put('/:kind(season|tournament)/:id/settings', authenticate, updateSettings);
router.get('/:kind(season|tournament)/:id/inbox', authenticate, getInbox);
router.post('/:id/approve', authenticate, approve);
router.post('/:id/reject', authenticate, reject);
router.post('/:id/waitlist', authenticate, waitlist);
router.post('/:id/promote', authenticate, promote);
router.get('/funnel', authenticate, authorize('ADMIN'), getFunnel);
// The dashboard's list of the caller's own competitions and their forms.
router.get('/managed', authenticate, listManaged);

// The public form. A season application needs an account (checked in the
// controller so the form itself can still be read signed out).
router.get('/:kind(season|tournament)/:id', optionalAuth, visible, getForm);
router.post('/:kind(season|tournament)/:id', optionalAuth, visible, submit);

export default router;
