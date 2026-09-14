import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import {
  requireSeriesAccess,
  requireTournamentAccess,
  requireTournamentTeamAccess,
  requireTournamentPlayerAccess,
  requireTournamentGroupAccess,
  requireTournamentGameAccess,
  requireVisible,
} from '../middleware/access.js';

import {
  getAllSeries,
  getSeriesById,
  createSeries,
  updateSeries,
  deleteSeries,
} from '../controllers/tournamentSeriesController.js';

import {
  getTournamentsBySeriesId,
  getTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  getTournamentStandings,
} from '../controllers/tournamentController.js';

import {
  getTeamsByTournament,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getPlayersByTeam,
  createPlayer,
  updatePlayer,
  deletePlayer,
} from '../controllers/tournamentTeamController.js';

import {
  getGroupsByTournament,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  assignTeamToGroup,
  removeTeamFromGroup,
  generateTournamentSchedule,
  deleteTournamentSchedule,
} from '../controllers/tournamentGroupController.js';

import {
  getGamesByTournament,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  getStatsByGame,
  createStatistic,
  updateStatistic,
  deleteStatistic,
  getTopScorersByTournament,
} from '../controllers/tournamentGameController.js';

import {
  generateTournamentPlayoffs,
  deleteTournamentPlayoffs,
} from '../controllers/tournamentPlayoffController.js';

const router = Router();

// ── Series ─────────────────────────────────────────────────
router.get('/series', optionalAuth, getAllSeries);
router.get('/series/:id', optionalAuth, requireVisible('series'), getSeriesById);
router.post('/series', authenticate, createSeries);
router.put('/series/:id', authenticate, requireSeriesAccess(), updateSeries);
router.delete('/series/:id', authenticate, authorize('ADMIN'), deleteSeries);

// ── Tournament editions ────────────────────────────────────
router.get('/series/:seriesId/tournaments', optionalAuth, requireVisible('series', 'seriesId'), getTournamentsBySeriesId);
router.post('/series/:seriesId/tournaments', authenticate, requireSeriesAccess('seriesId'), createTournament);

router.get('/:id', optionalAuth, requireVisible('tournament'), getTournamentById);
router.put('/:id', authenticate, requireTournamentAccess(), updateTournament);
router.delete('/:id', authenticate, requireTournamentAccess(), deleteTournament);
router.get('/:id/standings', optionalAuth, requireVisible('tournament'), getTournamentStandings);
router.get('/:tournamentId/scorers', optionalAuth, requireVisible('tournament', 'tournamentId'), getTopScorersByTournament);

// ── Teams ──────────────────────────────────────────────────
router.get('/:tournamentId/teams', optionalAuth, requireVisible('tournament', 'tournamentId'), getTeamsByTournament);
router.post('/:tournamentId/teams', authenticate, requireTournamentAccess('tournamentId'), createTeam);

router.get('/teams/:id', optionalAuth, requireVisible('tournamentTeam'), getTeamById);
router.put('/teams/:id', authenticate, requireTournamentTeamAccess(), updateTeam);
router.delete('/teams/:id', authenticate, requireTournamentTeamAccess(), deleteTeam);

// ── Players ────────────────────────────────────────────────
router.get('/teams/:teamId/players', optionalAuth, requireVisible('tournamentTeam', 'teamId'), getPlayersByTeam);
router.post('/teams/:teamId/players', authenticate, requireTournamentTeamAccess('teamId'), createPlayer);
router.put('/players/:id', authenticate, requireTournamentPlayerAccess(), updatePlayer);
router.delete('/players/:id', authenticate, requireTournamentPlayerAccess(), deletePlayer);

// ── Groups ─────────────────────────────────────────────────
router.get('/:tournamentId/groups', optionalAuth, requireVisible('tournament', 'tournamentId'), getGroupsByTournament);
router.post('/:tournamentId/groups', authenticate, requireTournamentAccess('tournamentId'), createGroup);

router.get('/groups/:id', optionalAuth, requireVisible('tournamentGroup'), getGroupById);
router.put('/groups/:id', authenticate, requireTournamentGroupAccess(), updateGroup);
router.delete('/groups/:id', authenticate, requireTournamentGroupAccess(), deleteGroup);
router.post('/groups/:id/teams', authenticate, requireTournamentGroupAccess(), assignTeamToGroup);
router.delete('/groups/:id/teams/:teamId', authenticate, requireTournamentGroupAccess(), removeTeamFromGroup);
router.post('/:tournamentId/generate-schedule', authenticate, requireTournamentAccess('tournamentId'), generateTournamentSchedule);
router.delete('/:tournamentId/schedule', authenticate, requireTournamentAccess('tournamentId'), deleteTournamentSchedule);
router.post('/:tournamentId/generate-playoffs', authenticate, requireTournamentAccess('tournamentId'), generateTournamentPlayoffs);
router.delete('/:tournamentId/playoffs', authenticate, requireTournamentAccess('tournamentId'), deleteTournamentPlayoffs);

// ── Games ──────────────────────────────────────────────────
router.get('/:tournamentId/games', optionalAuth, requireVisible('tournament', 'tournamentId'), getGamesByTournament);
router.post('/:tournamentId/games', authenticate, requireTournamentAccess('tournamentId'), createGame);

router.get('/games/:id', optionalAuth, requireVisible('tournamentGame'), getGameById);
router.put('/games/:id', authenticate, requireTournamentGameAccess(), updateGame);
router.delete('/games/:id', authenticate, requireTournamentGameAccess(), deleteGame);

// ── Game statistics ────────────────────────────────────────
router.get('/games/:id/statistics', optionalAuth, requireVisible('tournamentGame'), getStatsByGame);
router.post('/games/:id/statistics', authenticate, requireTournamentGameAccess(), createStatistic);
router.put('/games/:id/statistics/:statId', authenticate, requireTournamentGameAccess(), updateStatistic);
router.delete('/games/:id/statistics/:statId', authenticate, requireTournamentGameAccess(), deleteStatistic);

export default router;
