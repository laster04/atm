import { Router } from 'express';
import { getUserDetail, listUsers, setUsersActive } from '../controllers/adminUserController.js';
import { listAudit, listAuditTypes } from '../controllers/adminAuditController.js';
import { getOverview } from '../controllers/adminOverviewController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// The whole administration is for the Admin role. Season managers work in
// /season-management on the regular, relation-checked endpoints.
router.use(authenticate, authorize('ADMIN'));

router.get('/overview', getOverview);
router.get('/users', listUsers);
router.post('/users/active', setUsersActive);
router.get('/users/:id', getUserDetail);
router.get('/audit', listAudit);
router.get('/audit/types', listAuditTypes);

export default router;
