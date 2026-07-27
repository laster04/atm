import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';

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
router.get('/series', getAllSeries);
router.get('/series/:id', getSeriesById);
router.post('/series', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createSeries);
router.put('/series/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateSeries);
router.delete('/series/:id', authenticate, authorize('ADMIN'), deleteSeries);

// ── Tournament editions ────────────────────────────────────
router.get('/series/:seriesId/tournaments', getTournamentsBySeriesId);
router.post('/series/:seriesId/tournaments', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createTournament);

router.get('/:id', getTournamentById);
router.put('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateTournament);
router.delete('/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteTournament);
router.get('/:id/standings', getTournamentStandings);
router.get('/:tournamentId/scorers', getTopScorersByTournament);

// ── Teams ──────────────────────────────────────────────────
router.get('/:tournamentId/teams', getTeamsByTournament);
router.post('/:tournamentId/teams', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createTeam);

router.get('/teams/:id', getTeamById);
router.put('/teams/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateTeam);
router.delete('/teams/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteTeam);

// ── Players ────────────────────────────────────────────────
router.get('/teams/:teamId/players', getPlayersByTeam);
router.post('/teams/:teamId/players', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createPlayer);
router.put('/players/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updatePlayer);
router.delete('/players/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deletePlayer);

// ── Groups ─────────────────────────────────────────────────
router.get('/:tournamentId/groups', getGroupsByTournament);
router.post('/:tournamentId/groups', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createGroup);

router.get('/groups/:id', getGroupById);
router.put('/groups/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateGroup);
router.delete('/groups/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteGroup);
router.post('/groups/:id/teams', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), assignTeamToGroup);
router.delete('/groups/:id/teams/:teamId', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), removeTeamFromGroup);
router.post('/:tournamentId/generate-schedule', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), generateTournamentSchedule);
router.delete('/:tournamentId/schedule', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteTournamentSchedule);
router.post('/:tournamentId/generate-playoffs', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), generateTournamentPlayoffs);
router.delete('/:tournamentId/playoffs', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteTournamentPlayoffs);

// ── Games ──────────────────────────────────────────────────
router.get('/:tournamentId/games', getGamesByTournament);
router.post('/:tournamentId/games', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createGame);

router.get('/games/:id', getGameById);
router.put('/games/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateGame);
router.delete('/games/:id', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteGame);

// ── Game statistics ────────────────────────────────────────
router.get('/games/:id/statistics', getStatsByGame);
router.post('/games/:id/statistics', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), createStatistic);
router.put('/games/:id/statistics/:statId', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), updateStatistic);
router.delete('/games/:id/statistics/:statId', authenticate, authorize('ADMIN', 'SEASON_MANAGER', 'TOURNAMENT_MANAGER'), deleteStatistic);

export default router;
