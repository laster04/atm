import { Router } from 'express';
import { searchAll } from '../controllers/searchController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public: the header's search box works signed out, like the rest of the
// public part.
router.get('/', optionalAuth, searchAll);

export default router;
