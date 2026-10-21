import axios from 'axios';
import type {
  User, League, Season, Team, Player, Game, Standing, PlayerGameStatistic, TopScorer,
  ArchivedStanding, ArchivedPlayerStat, AuditEntry, MatchEvent, MatchEventInput, MyPlayerProfile,
  RoundSummary, ResultsEmailCandidates, SeasonDigest, SeasonGroup, GroupTable,
  SeasonPlayoff, CreatePlayoffInput,
  RegistrationForm, RegistrationSettings, RegistrationInbox, Registration, MyRegistration, RegistrationInput, RegistrationKind,
  RegistrationSettingsInput, RegistrationStatusView, RegistrationFunnel,
  ManagedCompetition,
  Attendance, AttendanceStatus, MyTeamEvent, TeamEvent, TeamEventInput,
  TournamentSeries, Tournament, TournamentTeam, TournamentPlayer,
  TournamentGroup, TournamentGame, TournamentGameStatistic,
  TournamentStanding, TournamentTopScorer,
  Paged, PublicTeam, PublicPlayer, PublicTeamQuery, PublicPlayerQuery,
  PublicGameQuery, TopScorerQuery, SearchResults,
  SupportTicket, SupportTicketInput, SupportTicketStatus,
  ManagerInvite, ManagerInviteSent, PublicManagerInvite, AcceptedManagerInvite,
  ListPage, AdminUserRow, AdminUserDetail, AdminOverview,
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

// A 401 from these is an answer for the screen, not an expired session: a wrong
// password, or an invitation asking its holder to sign in first.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/invites/token/'];

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
  register: (data: { email: string; password: string; name: string; role?: string; next?: string }) =>
    api.post<{ message: string; user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  activateAccount: (token: string) =>
    api.get<{ message: string }>(`/auth/activate/${token}`),
  resendActivationEmail: (email: string, next?: string) =>
    api.post<{ message: string }>('/auth/resend-activation', { email, next }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>(`/auth/reset-password/${token}`, { password }),
  getMe: () => api.get<{ user: User }>('/auth/me'),
  completeOnboarding: () => api.post<{ user: User }>('/auth/complete-onboarding'),
  completeTeamTour: () => api.post<{ user: User }>('/auth/complete-team-tour'),
  markUpdatesSeen: () => api.post<{ updatesSeenAt: string }>('/auth/updates-seen'),
  updateProfile: (data: { name?: string; password?: string; emailDigest?: boolean }) =>
    api.put<{ user: User }>('/auth/profile', data),
  getUsers: (filters?: { role?: string; name?: string; active?: boolean }) =>
    api.get<User[]>('/auth/users', { params: filters }),
  createUser: (data: { email: string; password: string; name: string; role?: string; active?: boolean; sendActivationEmail?: boolean }) =>
    api.post<User>('/auth/users', data),
  updateUser: (id: string, data: { email?: string; password?: string; name?: string; role?: string; active?: boolean }) =>
    api.put<User>(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`)
};

export const leagueApi = {
  getAll: () => api.get<League[]>('/leagues'),
  getMyLeagues: () => api.get<League[]>('/leagues/my'),
  getById: (id: string | number) => api.get<League>(`/leagues/${id}`),
  create: (data: Partial<League>) => api.post<League>('/leagues', data),
  update: (id: string | number, data: Partial<League>) => api.put<League>(`/leagues/${id}`, data),
  inviteManager: (id: string | number, data: { email: string; name: string; locale?: string }) =>
    api.post<ManagerInviteSent>(`/leagues/${id}/invite-manager`, data),
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
  // One table per division. An undivided season comes back as a single table
  // with no group, so a caller can render this shape either way.
  getStandingsByGroup: (id: string | number) =>
    api.get<GroupTable[]>(`/seasons/${id}/standings/by-group`),
  getGroups: (id: string | number) => api.get<SeasonGroup[]>(`/seasons/${id}/groups`),
  createGroup: (id: string | number, name: string) =>
    api.post<SeasonGroup>(`/seasons/${id}/groups`, { name }),
  updateGroup: (id: string | number, groupId: string, data: { name?: string; position?: number }) =>
    api.put<SeasonGroup>(`/seasons/${id}/groups/${groupId}`, data),
  deleteGroup: (id: string | number, groupId: string) =>
    api.delete(`/seasons/${id}/groups/${groupId}`),
  // Null takes the team out of its division without removing it from the season.
  assignTeamToGroup: (id: string | number, teamId: string, groupId: string | null) =>
    api.put(`/seasons/${id}/teams/${teamId}/group`, { groupId }),
  getTeamStanding: (id: string | number, teamId: string | number) => api.get<Standing>(`/seasons/${id}/standings/${teamId}`),
  getArchivedStandings: (id: string | number) => api.get<ArchivedStanding[]>(`/seasons/${id}/archived-standings`),
  // Null while the season has no play-off.
  getPlayoff: (id: string | number) => api.get<SeasonPlayoff | null>(`/seasons/${id}/playoff`),
  createPlayoff: (id: string | number, data: CreatePlayoffInput) => api.post<SeasonPlayoff>(`/seasons/${id}/playoff`, data),
  deletePlayoff: (id: string | number) => api.delete(`/seasons/${id}/playoff`),
  getCopyableTeams: (id: string | number) => api.get<Team[]>(`/seasons/${id}/copyable-teams`),
  copyTeams: (id: string | number, teamIds: string[]) =>
    api.post<{ message: string; teams: Team[] }>(`/seasons/${id}/copy-teams`, { teamIds }),
  // Results emails: finished games not mailed yet, what an email of the picked
  // ones would say, a test copy to the manager, and sending it to everyone.
  getSentDigests: (id: string | number) => api.get<SeasonDigest[]>(`/seasons/${id}/digests`),
  getUnsentGames: (id: string | number) =>
    api.get<ResultsEmailCandidates>(`/seasons/${id}/results-email`),
  previewResultsEmail: (id: string | number, gameIds: string[]) =>
    api.post<{ summary: RoundSummary }>(`/seasons/${id}/results-email/preview`, { gameIds }),
  // `locale` picks the email's language; recipients have none of their own.
  sendTestResultsEmail: (id: string | number, gameIds: string[], locale?: string) =>
    api.post<{ to: string }>(`/seasons/${id}/results-email/test`, { gameIds, locale }),
  // The picked games drawn as a PNG card for sharing into a chat.
  getResultsImage: (id: string | number, gameIds: string[], locale?: string) =>
    api.post<Blob>(`/seasons/${id}/results-email/image`, { gameIds, locale }, { responseType: 'blob' }),
  sendResultsEmail: (id: string | number, gameIds: string[], locale?: string) =>
    api.post<{ games: number; attempted: number; delivered: number; sentAt: string }>(
      `/seasons/${id}/results-email`,
      { gameIds, locale }
    )
};

export const teamApi = {
  // The public directory: every team, paged, with its most recent season.
  getPublic: (params?: PublicTeamQuery) => api.get<Paged<PublicTeam>>('/teams', { params }),
  getMyTeams: () => api.get<Team[]>('/teams/my'),
  getBySeason: (seasonId: string | number) => api.get<Team[]>(`/teams/season/${seasonId}`),
  getById: (id: string | number) => api.get<Team>(`/teams/${id}`),
  create: (seasonId: string | number, data: Partial<Team>) =>
    api.post<Team>(`/teams/season/${seasonId}`, data),
  update: (id: string | number, data: Partial<Team>) => api.put<Team>(`/teams/${id}`, data),
  delete: (id: string | number) => api.delete(`/teams/${id}`),
  inviteManager: (teamId: string | number, data: { email: string; name: string; locale?: string }) =>
    api.post<ManagerInviteSent>(`/teams/${teamId}/invite-manager`, data),
  addToSeason: (teamId: string | number, seasonId: string | number) =>
    api.post(`/teams/${teamId}/seasons/${seasonId}`),
  removeFromSeason: (teamId: string | number, seasonId: string | number) =>
    api.delete(`/teams/${teamId}/seasons/${seasonId}`),
  getAvailableForSeason: (seasonId: string | number) =>
    api.get<Team[]>(`/teams/available/${seasonId}`),
};

// Manager invitations. The sender's side lists, resends and cancels them; the
// invitee's side reads one by its link token and accepts it.
export const inviteApi = {
  getBySeason: (seasonId: string) => api.get<ManagerInvite[]>(`/invites/season/${seasonId}`),
  getForTeam: (teamId: string) => api.get<ManagerInvite | null>(`/invites/team/${teamId}`),
  getForTeamPlayers: (teamId: string) => api.get<ManagerInvite[]>(`/invites/team/${teamId}/players`),
  getForPlayer: (playerId: string) => api.get<ManagerInvite | null>(`/invites/player/${playerId}`),
  getForLeagues: () => api.get<ManagerInvite[]>('/invites/leagues'),
  resend: (id: string) => api.post<ManagerInviteSent>(`/invites/${id}/resend`),
  cancel: (id: string) => api.delete<ManagerInvite>(`/invites/${id}`),
  getByToken: (token: string) => api.get<PublicManagerInvite>(`/invites/token/${token}`),
  accept: (token: string, data: { name?: string; password?: string }) =>
    api.post<AcceptedManagerInvite>(`/invites/token/${token}/accept`, data),
};

export const playerApi = {
  // The public directory, each row carrying the player's totals.
  getPublic: (params?: PublicPlayerQuery) => api.get<Paged<PublicPlayer>>('/players', { params }),
  getByTeam: (teamId: string | number) => api.get<Player[]>(`/players/team/${teamId}`),
  getById: (id: string | number) => api.get<Player>(`/players/${id}`),
  create: (teamId: string | number, data: Partial<Player>) =>
    api.post<Player>(`/players/team/${teamId}`, data),
  update: (id: string | number, data: Partial<Player>) => api.put<Player>(`/players/${id}`, data),
  delete: (id: string | number) => api.delete(`/players/${id}`),
  move: (id: string | number, targetTeamId: string) =>
    api.patch<Player>(`/players/${id}/move`, { targetTeamId }),
  // Roster spots the signed-in user holds, for a player who manages nothing.
  getMine: () => api.get<MyPlayerProfile[]>('/players/me'),
  // Links a roster row to an account that already exists; never creates one.
  linkAccount: (id: string | number, email: string) =>
    api.patch<Player>(`/players/${id}/link`, { email }),
  unlinkAccount: (id: string | number) => api.delete<Player>(`/players/${id}/link`),
  // The player gets an emailed link; their account is linked when they accept.
  invite: (id: string | number, data: { email: string; name?: string; locale?: string }) =>
    api.post<ManagerInviteSent>(`/players/${id}/invite`, data)
};

// ── Match report ────────────────────────────────────────────
// The event log a league game's score and player statistics are derived from.
export const matchEventApi = {
  getByGame: (gameId: string | number) => api.get<MatchEvent[]>(`/games/${gameId}/events`),
  create: (gameId: string | number, data: MatchEventInput) =>
    api.post<MatchEvent>(`/games/${gameId}/events`, data),
  update: (id: string | number, data: Partial<MatchEventInput>) =>
    api.put<MatchEvent>(`/games/events/${id}`, data),
  delete: (id: string | number) => api.delete(`/games/events/${id}`)
};

export const gameApi = {
  // Fixtures across every season: upcoming by default, or live / results.
  getPublic: (params?: PublicGameQuery) => api.get<Paged<Game>>('/games', { params }),
  getBySeason: (seasonId: string | number) => api.get<Game[]>(`/games/season/${seasonId}`),
  getById: (id: string | number) => api.get<Game>(`/games/${id}`),
  create: (seasonId: string | number, data: Partial<Game>) =>
    api.post<Game>(`/games/season/${seasonId}`, data),
  // `confirm` also confirms the result when the game ends up completed.
  update: (id: string | number, data: Partial<Game> & { confirm?: boolean }) =>
    api.put<Game>(`/games/${id}`, data),
  delete: (id: string | number) => api.delete(`/games/${id}`),
  generateSchedule: (
    seasonId: string | number,
    data: { rounds: number }
  ) => api.post<{ message: string; games: Game[] }>(`/games/season/${seasonId}/generate`, data),
  // Closes the match report. Everything about the game is read-only afterwards.
  confirm: (id: string | number) => api.post<Game>(`/games/${id}/confirm`),
  // Reopening a published result needs a reason; the trail keeps it.
  reopen: (id: string | number, reason: string) => api.post<Game>(`/games/${id}/reopen`, { reason }),
  getAudit: (id: string | number) => api.get<AuditEntry[]>(`/games/${id}/audit`)
};

export const gameStatisticApi = {
  getByGame: (gameId: string | number) => api.get<PlayerGameStatistic[]>(`/game-statistics/game/${gameId}`),
  getByPlayer: (playerId: string | number) => api.get<PlayerGameStatistic[]>(`/game-statistics/player/${playerId}`),
  getById: (id: string | number) => api.get<PlayerGameStatistic>(`/game-statistics/${id}`),
  // App-wide leaders, optionally narrowed to a league, season or sport.
  getTopScorers: (params?: TopScorerQuery) =>
    api.get<TopScorer[]>('/game-statistics/top', { params }),
  getTopScorersBySeason: (seasonId: string | number, limit?: number) =>
    api.get<TopScorer[]>(`/game-statistics/season/${seasonId}/top`, { params: { limit } }),
  getScorersBySeasonAndTeam: (seasonId: string | number, teamId: string | number) =>
      api.get<TopScorer[]>(`/game-statistics/season/${seasonId}/team/${teamId}`),
  getArchivedPlayerStats: (seasonId: string | number, teamId?: string | number) =>
      api.get<ArchivedPlayerStat[]>(`/game-statistics/season/${seasonId}/archived`, { params: { teamId } }),
  create: (gameId: string | number, data: { playerId: string; goals?: number | null; assists?: number | null; penaltyMinutes?: number | null }) =>
    api.post<PlayerGameStatistic>(`/game-statistics/game/${gameId}`, data),
  update: (id: string | number, data: { goals?: number | null; assists?: number | null; penaltyMinutes?: number | null }) =>
    api.put<PlayerGameStatistic>(`/game-statistics/${id}`, data),
  delete: (id: string | number) => api.delete(`/game-statistics/${id}`)
};

// ── Team calendar ───────────────────────────────────────────
export const teamEventApi = {
  getByTeam: (teamId: string | number) => api.get<TeamEvent[]>(`/events/team/${teamId}`),
  create: (teamId: string | number, data: TeamEventInput) =>
    api.post<TeamEvent>(`/events/team/${teamId}`, data),
  update: (id: string | number, data: Partial<TeamEventInput>) =>
    api.put<TeamEvent>(`/events/${id}`, data),
  delete: (id: string | number) => api.delete(`/events/${id}`),
  // A manager may answer for anyone on the team; a linked player only for
  // themselves. The server decides which of the two the caller is.
  setAttendance: (
    eventId: string | number,
    playerId: string | number,
    status: AttendanceStatus,
    note?: string | null
  ) => api.put<Attendance>(`/events/${eventId}/attendance/${playerId}`, { status, note }),
  // Upcoming events across every roster spot the signed-in user holds.
  getMine: () => api.get<MyTeamEvent[]>('/events/mine')
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
  getStandings: (id: string | number, groupId?: string) =>
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
  assignTeam: (groupId: string | number, teamId: string) =>
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
  getByTournament: (tournamentId: string | number, params?: { phase?: string; groupId?: string }) =>
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
    data: { playerId: string; goals?: number | null; assists?: number | null }
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

export const searchApi = {
  // One box over teams, players, seasons and leagues; below two characters the
  // server answers with empty lists rather than half the database.
  search: (q: string, limit?: number) =>
    api.get<SearchResults>('/search', { params: { q, limit } })
};

/** Query values of an admin list: page, sort, search and its filters. */
export type ListQuery = Record<string, string>;

/** Saves a CSV export under the name the server gives it. */
async function downloadCsv(path: string, params: ListQuery): Promise<void> {
  const res = await api.get<Blob>(path, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** The administration's own endpoints; the server lets only the Admin role in. */
export const adminApi = {
  overview: () => api.get<AdminOverview>('/admin/overview'),
  users: (params: ListQuery) => api.get<ListPage<AdminUserRow>>('/admin/users', { params }),
  exportUsers: (params: ListQuery) => downloadCsv('/admin/users', params),
  user: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  setUsersActive: (ids: string[], active: boolean, reason?: string) =>
    api.post<{ updated: number }>('/admin/users/active', { ids, active, reason }),
  audit: (params: ListQuery) => api.get<ListPage<AuditEntry>>('/admin/audit', { params }),
  exportAudit: (params: ListQuery) => downloadCsv('/admin/audit', params),
  auditTypes: () => api.get<string[]>('/admin/audit/types'),
};

export const contactApi = {
  // Anyone may send; a retried submit with the same clientToken returns the first ticket.
  send: (data: SupportTicketInput) => api.post<{ received: true; id?: string }>('/contact', data),
  list: (status?: SupportTicketStatus) => api.get<SupportTicket[]>('/contact', { params: status ? { status } : undefined }),
  updateStatus: (id: string, status: SupportTicketStatus) => api.put<SupportTicket>(`/contact/${id}`, { status }),
};

/** Season and tournament sign-ups: the public form, the applicant's own list and the manager's inbox. */
export const registrationApi = {
  getForm: (kind: RegistrationKind, id: string) => api.get<RegistrationForm>(`/registrations/${kind}/${id}`),
  submit: (kind: RegistrationKind, id: string, data: RegistrationInput) => api.post<Registration>(`/registrations/${kind}/${id}`, data),
  mine: () => api.get<MyRegistration[]>('/registrations/mine'),
  withdraw: (id: string) => api.post<Registration>(`/registrations/${id}/withdraw`),
  getSettings: (kind: RegistrationKind, id: string) => api.get<RegistrationSettings>(`/registrations/${kind}/${id}/settings`),
  updateSettings: (kind: RegistrationKind, id: string, data: RegistrationSettingsInput) =>
    api.put<RegistrationSettings>(`/registrations/${kind}/${id}/settings`, data),
  inbox: (kind: RegistrationKind, id: string) => api.get<RegistrationInbox>(`/registrations/${kind}/${id}/inbox`),
  approve: (id: string) => api.post<Registration>(`/registrations/${id}/approve`),
  reject: (id: string, reason?: string) => api.post<Registration>(`/registrations/${id}/reject`, { reason }),
  waitlist: (id: string) => api.post<Registration>(`/registrations/${id}/waitlist`),
  promote: (id: string) => api.post<Registration>(`/registrations/${id}/promote`),
  /** A tournament applicant's own page, reached by the link in their receipt. */
  status: (token: string) => api.get<RegistrationStatusView>(`/registrations/status/${token}`),
  withdrawByToken: (token: string) => api.post<Registration>(`/registrations/status/${token}/withdraw`),
  funnel: () => api.get<RegistrationFunnel>('/registrations/funnel'),
  /** The caller's own running competitions and their forms, for the dashboard. */
  managed: () => api.get<ManagedCompetition[]>('/registrations/managed'),
};
