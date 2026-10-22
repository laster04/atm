import { Router } from 'express';
import { getCompany, getPublicPrices, postVatCheck } from '../controllers/billingController.js';
import { cancelOwnPayment } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// The public price list for the website: no account needed.
router.get('/prices', getPublicPrices);

// Billing details lookups for any signed-in customer: VIES for an EU VAT ID,
// ARES for a Czech IČO. Both call public services, so only signed-in users.
router.post('/vat-check', authenticate, postVatCheck);
router.get('/company/:ico', authenticate, getCompany);

// A plan payment's payer, or the tournament's manager, withdraws it before it is confirmed.
router.post('/payments/:id/cancel', authenticate, cancelOwnPayment);

export default router;
