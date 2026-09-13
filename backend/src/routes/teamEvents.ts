import { Router } from 'express';
import {
  getEventsByTeam,
  createEvent,
  updateEvent,
  deleteEvent,
  setAttendance,
  getMyEvents
} from '../controllers/teamEventController.js';
import { authenticate } from '../middleware/auth.js';
import { requireTeamAccess, requireTeamEventAccess } from '../middleware/access.js';

const router = Router();

// Registered before '/:id' so it is not swallowed as an event id.
router.get('/mine', authenticate, getMyEvents);

// Not public: the controller lets a manager see every answer and a player on
// the team see only their own.
router.get('/team/:teamId', authenticate, getEventsByTeam);
router.post('/team/:teamId', authenticate, requireTeamAccess('teamId'), createEvent);

router.put('/:id', authenticate, requireTeamEventAccess(), updateEvent);
router.delete('/:id', authenticate, requireTeamEventAccess(), deleteEvent);

// Answering is checked inside the controller: a manager may answer for anyone on
// the team, a linked player only for themselves.
router.put('/:id/attendance/:playerId', authenticate, setAttendance);

export default router;
