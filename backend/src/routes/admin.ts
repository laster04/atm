import { Router } from 'express';
import { getUserDetail, listUsers, setUsersActive } from '../controllers/adminUserController.js';
import { listAudit, listAuditTypes } from '../controllers/adminAuditController.js';
import { getOverview } from '../controllers/adminOverviewController.js';
import { setTournamentPlan } from '../controllers/adminTournamentController.js';
import { cancelPayments, confirmPayments, getPaymentDocument, listPayments } from '../controllers/adminPaymentController.js';
import {
  cancelPrice,
  cancelVatRate,
  createLimits,
  createPrice,
  createVatRate,
  getPricing,
  requirePricingManager,
  updateOss,
} from '../controllers/adminPricingController.js';
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
router.put('/tournaments/:id/plan', setTournamentPlan);
router.get('/payments', listPayments);
router.post('/payments/confirm', confirmPayments);
router.post('/payments/cancel', cancelPayments);
router.get('/payments/:id/document', getPaymentDocument);

// Every admin sees pricing; only the account flagged canManagePricing changes it.
router.get('/pricing', getPricing);
router.post('/pricing/products/:code/prices', requirePricingManager, createPrice);
router.delete('/pricing/prices/:id', requirePricingManager, cancelPrice);
router.post('/pricing/vat-rates', requirePricingManager, createVatRate);
router.delete('/pricing/vat-rates/:id', requirePricingManager, cancelVatRate);
router.post('/pricing/limits', requirePricingManager, createLimits);
router.put('/pricing/oss', requirePricingManager, updateOss);

export default router;
