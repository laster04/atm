import { Router } from 'express';
import { searchAll } from '../controllers/searchController.js';

const router = Router();

// Public: the header's search box works signed out, like the rest of the
// public part.
router.get('/', searchAll);

export default router;
