import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { createTicket, listTickets, updateTicketStatus } from '../controllers/contactController.js';

const router = Router();

// Anyone can write in; a signed-in sender is remembered on the ticket.
router.post('/', optionalAuth, createTicket);

router.get('/', authenticate, authorize('ADMIN'), listTickets);
router.put('/:id', authenticate, authorize('ADMIN'), updateTicketStatus);

export default router;
