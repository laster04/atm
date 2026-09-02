import axios from 'axios';
import type {
  User, League, Season, Team, Player, Game, Standing, HockeyGameStatistic, TopScorer,
  ArchivedStanding, ArchivedPlayerStat,
  TournamentSeries, Tournament, TournamentTeam, TournamentPlayer,
  TournamentGroup, TournamentGame, TournamentGameStatistic,
  TournamentStanding, TournamentTopScorer,
} from '@types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => error.config?.url?.includes(path));
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; name: string; role?: string }) =>
    api.post<{ message: string; user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  activateAccount: (token: string) =>
    api.get<{ message: string }>(`/auth/activate/${token}`),
  resendActivationEmail: (email: string) =>
    api.post<{ message: string }>('/auth/resend-activation', { email }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>(`/auth/reset-password/${token}`, { password }),
  getMe: () => api.get<{ user: User }>('/auth/me'),
  completeOnboarding: () => api.post<{ user: User }>('/auth/complete-onboarding'),
  completeTeamTour: () => api.post<{ user: User }>('/auth/complete-team-tour'),
  updateProfile: (data: { name?: string; password?: string }) =>
    api.put<{ user: User }>('/auth/profile', data),
  getUsers: (filters?: { role?: string; name?: string; active?: boolean }) =>
    api.get<User[]>('/auth/users', { params: filters }),
  createUser: (data: { email: string; password: string; name: string; role?: string; active?: boolean; sendActivationEmail?: boolean }) =>
    api.post<User>('/auth/users', data),
  updateUser: (id: number, data: { email?: string; password?: string; name?: string; role?: string; active?: boolean }) =>
    api.put<User>(`/auth/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`)
};

export const leagueApi = {
  getAll: () => api.get<League[]>('/leagues'),
  getMyLeagues: () => api.get<League[]>('/leagues/my'),
  getById: (id: string | number) => api.get<League>(`/leagues/${id}`),
  create: (data: Partial<League>) => api.post<League>('/leagues', data),
  update: (id: string | number, data: Partial<League>) => api.put<League>(`/leagues/${id}`, data),
  inviteManager: (id: string | number, data: { email: string; name: string; locale?: string }) =>
    api.post<League>(`/leagues/${id}/invite-manager`, data),
  delete: (id: string | number) => api.delete(`/leagues/${id}`)
};

export const seasonApi = {
  getAll: () => api.get<Season[]>('/seasons'),
  getMySeasons: () => api.get<Season[]>('/seasons/my'),
  getByLeague: (leagueId: string | number) => api.get<Season[]>(`/seasons/league/${leagueId}`),
  getById: (id: string | number) => api.get<Season>(`/seasons/${id}`),
  create: (data: Partial<Season>) => api.post<Season>('/seasons', data),
  update: (id: string | number, data: Partial<Season>) => api.put<Season>(`/seasons/${id}`, data),
  delete: (id: string | number) => api.delete(`/seasons/${id}`),
  archive: (id: string | number) => api.post<{ message: string; season: Season }>(`/seasons/${id}/archive`),
  getStandings: (id: string | number) => api.get<Standing[]>(`/seasons/${id}/standings`),
  getTeamStanding: (id: string | number, teamId: string | number) => api.get<Standing>(`/seasons/${id}/standings/${teamId}`),
  getArchivedStandings: (id: string | number) => api.get<ArchivedStanding[]>(`/seasons/${id}/archived-standings`),
  getCopyableTeams: (id: string | number) => api.get<Team[]>(`/seasons/${id}/copyable-teams`),
  copyTeams: (id: string | number, teamIds: number[]) =>
    api.post<{ message: string; teams: Team[] }>(`/seasons/${id}/copy-teams`, { teamIds })
};

export const teamApi = {
  getMyTeams: () => api.get<Team[]>('/teams/my'),
  getBySeason: (seasonId: string | number) => api.get<Team[]>(`/teams/season/${seasonId}`),
  getById: (id: string | number) => api.get<Team>(`/teams/${id}`),
  create: (seasonId: string | number, data: Partial<Team>) =>
    api.post<Team>(`/teams/season/${seasonId}`, data),
  update: (id: string | number, data: Partial<Team>) => api.put<Team>(`/teams/${id}`, data),
  delete: (id: string | number) => api.delete(`/teams/${id}`),
  inviteManager: (teamId: string | number, data: { email: string; name: string; locale?: string }) =>
    api.post<Team>(`/teams/${teamId}/invite-manager`, data),
  addToSeason: (teamId: string | number, seasonId: string | number) =>
    api.post(`/teams/${teamId}/seasons/${seasonId}`),
  removeFromSeason: (teamId: string | number, seasonId: string | number) =>
    api.delete(`/teams/${teamId}/seasons/${seasonId}`),
  getAvailableForSeason: (seasonId: string | number) =>
    api.get<Team[]>(`/teams/available/${seasonId}`),
};

export const playerApi = {
  getByTeam: (teamId: string | number) => api.get<Player[]>(`/players/team/${teamId}`),
  getById: (id: string | number) => api.get<Player>(`/players/${id}`),
  create: (teamId: string | number, data: Partial<Player>) =>
    api.post<Player>(`/players/team/${teamId}`, data),
  update: (id: string | number, data: Partial<Player>) => api.put<Player>(`/players/${id}`, data),
  delete: (id: string | number) => api.delete(`/players/${id}`),
  move: (id: string | number, targetTeamId: number) =>
    api.patch<Player>(`/players/${id}/move`, { targetTeamId })
};

export const gameApi = {
  getBySeason: (seasonId: string | number) => api.get<Game[]>(`/games/season/${seasonId}`),
  getById: (id: string | number) => api.get<Game>(`/games/${id}`),
  create: (seasonId: string | number, data: Partial<Game>) =>
    api.post<Game>(`/games/season/${seasonId}`, data),
  update: (id: string | number, data: Partial<Game>) => api.put<Game>(`/games/${id}`, data),
  delete: (id: string | number) => api.delete(`/games/${id}`),
  generateSchedule: (
    seasonId: string | number,
    data: { rounds: number }
  ) => api.post<{ message: string; games: Game[] }>(`/games/season/${seasonId}/generate`, data)
};

export const gameStatisticApi = {
  getByGame: (gameId: string | number) => api.get<HockeyGameStatistic[]>(`/game-statistics/game/${gameId}`),
  getByPlayer: (playerId: string | number) => api.get<HockeyGameStatistic[]>(`/game-statistics/player/${playerId}`),
  getById: (id: string | number) => api.get<HockeyGameStatistic>(`/game-statistics/${id}`),
  getTopScorersBySeason: (seasonId: string | number, limit?: number) =>
    api.get<TopScorer[]>(`/game-statistics/season/${seasonId}/top`, { params: { limit } }),
  getScorersBySeasonAndTeam: (seasonId: string | number, teamId: string | number) =>
      api.get<TopScorer[]>(`/game-statistics/season/${seasonId}/team/${teamId}`),
  getArchivedPlayerStats: (seasonId: string | number, teamId?: string | number) =>
      api.get<ArchivedPlayerStat[]>(`/game-statistics/season/${seasonId}/archived`, { params: { teamId } }),
  create: (gameId: string | number, data: { playerId: number; goals?: number | null; assists?: number | null }) =>
    api.post<HockeyGameStatistic>(`/game-statistics/game/${gameId}`, data),
  update: (id: string | number, data: { goals?: number | null; assists?: number | null }) =>
    api.put<HockeyGameStatistic>(`/game-statistics/${id}`, data),
  delete: (id: string | number) => api.delete(`/game-statistics/${id}`)
};

// ── Tournament Series ───────────────────────────────────────
export const tournamentSeriesApi = {
  getAll: () => api.get<TournamentSeries[]>('/tournaments/series'),
  getById: (id: string | number) => api.get<TournamentSeries>(`/tournaments/series/${id}`),
  create: (data: Partial<TournamentSeries>) => api.post<TournamentSeries>('/tournaments/series', data),
  update: (id: string | number, data: Partial<TournamentSeries>) =>
    api.put<TournamentSeries>(`/tournaments/series/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/series/${id}`),
};

// ── Tournament editions ─────────────────────────────────────
export const tournamentApi = {
  getBySeries: (seriesId: string | number) =>
    api.get<Tournament[]>(`/tournaments/series/${seriesId}/tournaments`),
  getById: (id: string | number) => api.get<Tournament>(`/tournaments/${id}`),
  create: (seriesId: string | number, data: Partial<Tournament>) =>
    api.post<Tournament>(`/tournaments/series/${seriesId}/tournaments`, data),
  update: (id: string | number, data: Partial<Tournament>) =>
    api.put<Tournament>(`/tournaments/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/${id}`),
  getStandings: (id: string | number, groupId?: number) =>
    api.get<TournamentStanding[]>(`/tournaments/${id}/standings`, { params: groupId ? { groupId } : undefined }),
  getTopScorers: (id: string | number, limit?: number) =>
    api.get<TournamentTopScorer[]>(`/tournaments/${id}/scorers`, { params: { limit } }),
};

// ── Tournament Teams ────────────────────────────────────────
export const tournamentTeamApi = {
  getByTournament: (tournamentId: string | number) =>
    api.get<TournamentTeam[]>(`/tournaments/${tournamentId}/teams`),
  getById: (id: string | number) => api.get<TournamentTeam>(`/tournaments/teams/${id}`),
  create: (tournamentId: string | number, data: Partial<TournamentTeam>) =>
    api.post<TournamentTeam>(`/tournaments/${tournamentId}/teams`, data),
  update: (id: string | number, data: Partial<TournamentTeam>) =>
    api.put<TournamentTeam>(`/tournaments/teams/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/teams/${id}`),
};

// ── Tournament Players ──────────────────────────────────────
export const tournamentPlayerApi = {
  getByTeam: (teamId: string | number) =>
    api.get<TournamentPlayer[]>(`/tournaments/teams/${teamId}/players`),
  create: (teamId: string | number, data: Partial<TournamentPlayer>) =>
    api.post<TournamentPlayer>(`/tournaments/teams/${teamId}/players`, data),
  update: (id: string | number, data: Partial<TournamentPlayer>) =>
    api.put<TournamentPlayer>(`/tournaments/players/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/players/${id}`),
};

// ── Tournament Groups ───────────────────────────────────────
export const tournamentGroupApi = {
  getByTournament: (tournamentId: string | number) =>
    api.get<TournamentGroup[]>(`/tournaments/${tournamentId}/groups`),
  getById: (id: string | number) => api.get<TournamentGroup>(`/tournaments/groups/${id}`),
  create: (tournamentId: string | number, data: { name: string }) =>
    api.post<TournamentGroup>(`/tournaments/${tournamentId}/groups`, data),
  update: (id: string | number, data: { name: string }) =>
    api.put<TournamentGroup>(`/tournaments/groups/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/groups/${id}`),
  assignTeam: (groupId: string | number, teamId: number) =>
    api.post<TournamentGroup>(`/tournaments/groups/${groupId}/teams`, { teamId }),
  removeTeam: (groupId: string | number, teamId: string | number) =>
    api.delete(`/tournaments/groups/${groupId}/teams/${teamId}`),
  generateTournamentSchedule: (tournamentId: string | number, data: {
    startDate?: string; startTime?: string; endTime?: string; slotDurationMinutes?: number; locations?: string[]; minRestGames?: number;
  }) => api.post(`/tournaments/${tournamentId}/generate-schedule`, data),
  deleteTournamentSchedule: (tournamentId: string | number) =>
    api.delete(`/tournaments/${tournamentId}/schedule`),
};

// ── Tournament Playoffs ─────────────────────────────────────
export const tournamentPlayoffApi = {
  generate: (tournamentId: string | number, data: {
    qualifiersPerGroup: number; startTime: string; slotDurationMinutes: number; location?: string;
  }) => api.post<{ message: string }>(`/tournaments/${tournamentId}/generate-playoffs`, data),
  deleteAll: (tournamentId: string | number) =>
    api.delete(`/tournaments/${tournamentId}/playoffs`),
};

// ── Tournament Games ────────────────────────────────────────
export const tournamentGameApi = {
  getByTournament: (tournamentId: string | number, params?: { phase?: string; groupId?: number }) =>
    api.get<TournamentGame[]>(`/tournaments/${tournamentId}/games`, { params }),
  getById: (id: string | number) => api.get<TournamentGame>(`/tournaments/games/${id}`),
  create: (tournamentId: string | number, data: Partial<TournamentGame>) =>
    api.post<TournamentGame>(`/tournaments/${tournamentId}/games`, data),
  update: (id: string | number, data: Partial<TournamentGame>) =>
    api.put<TournamentGame>(`/tournaments/games/${id}`, data),
  delete: (id: string | number) => api.delete(`/tournaments/games/${id}`),
  getStatistics: (gameId: string | number) =>
    api.get<TournamentGameStatistic[]>(`/tournaments/games/${gameId}/statistics`),
  createStatistic: (
    gameId: string | number,
    data: { playerId: number; goals?: number | null; assists?: number | null }
  ) => api.post<TournamentGameStatistic>(`/tournaments/games/${gameId}/statistics`, data),
  updateStatistic: (
    gameId: string | number,
    statId: string | number,
    data: { goals?: number | null; assists?: number | null }
  ) => api.put<TournamentGameStatistic>(`/tournaments/games/${gameId}/statistics/${statId}`, data),
  deleteStatistic: (gameId: string | number, statId: string | number) =>
    api.delete(`/tournaments/games/${gameId}/statistics/${statId}`),
};

export default api;
