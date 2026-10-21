import { Router } from 'express';
import { getCompany, postVatCheck } from '../controllers/billingController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Billing details lookups for any signed-in customer: VIES for an EU VAT ID,
// ARES for a Czech IČO. Both call public services, so only signed-in users.
router.post('/vat-check', authenticate, postVatCheck);
router.get('/company/:ico', authenticate, getCompany);

export default router;
