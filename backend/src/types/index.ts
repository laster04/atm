import { Request } from 'express';
import { Role, SeasonStatus, GameStatus, SportType, TournamentStatus, TournamentGamePhase } from '@prisma/client';

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JwtPayload {
  userId: number;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ErrorResponse {
  error: string;
}

export interface SuccessMessage {
  message: string;
}

export interface IdParam {
  id: string;
}

export interface SeasonIdParam {
  seasonId: string;
}

export interface TeamIdParam {
  teamId: string;
}

export interface LeagueIdParam {
  leagueId: string;
}

// ============================================================================
// USER TYPES
// ============================================================================

// Shared user select (without password)
export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface UserWithActive extends UserPublic {
  active: boolean;
}

// Manager reference used in relations
export interface ManagerRef {
  id: number;
  name: string;
  email: string;
}

// Request bodies
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  password?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
  active?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  active?: boolean;
}

// Query params
export interface GetUsersQuery {
  role?: string;
  name?: string;
  active?: string;
}

// Responses
export interface AuthResponse {
  user: UserPublic;
  token: string;
}

export interface MeResponse {
  user: AuthUser | undefined;
}

export interface UserResponse {
  user: UserPublic;
}

// ============================================================================
// LEAGUE TYPES
// ============================================================================

// Request bodies
export interface CreateLeagueRequest {
  name: string;
  sportType: SportType;
  logo?: string;
  description?: string;
}

export interface UpdateLeagueRequest {
  name?: string;
  sportType?: SportType;
  logo?: string;
  description?: string;
}

// Response types
export interface LeagueRef {
  id: number;
  name: string;
  sportType: SportType;
  managerId?: number | null;
}

export interface LeagueListItem {
  id: number;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
  _count: {
    seasons: number;
  };
}

export interface LeagueDetail {
  id: number;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
  seasons: SeasonInLeague[];
}

export interface SeasonInLeague {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: number;
  _count: {
    seasonTeams: number;
    games: number;
  };
}

export interface LeagueResponse {
  id: number;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
}

// ============================================================================
// SEASON TYPES
// ============================================================================

// Request bodies
export interface CreateSeasonRequest {
  name: string;
  leagueId: number;
  startDate: string;
  endDate: string;
  status?: SeasonStatus;
}

export interface UpdateSeasonRequest {
  name?: string;
  leagueId?: number;
  startDate?: string;
  endDate?: string;
  status?: SeasonStatus;
}

// Response types
export interface SeasonListItem {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: number;
  league: LeagueRef;
  _count: {
    seasonTeams: number;
    games: number;
  };
}

export interface TeamInSeason {
  id: number;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
  _count: {
    players: number;
  };
}

export interface SeasonDetail {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: number;
  league: LeagueRef;
  teams: TeamInSeason[];
  _count: {
    games: number;
  };
}

export interface SeasonResponse {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: number;
  league: LeagueRef;
}

// ============================================================================
// TEAM TYPES
// ============================================================================

// Request bodies
export interface CreateTeamRequest {
  name: string;
  logo?: string;
  managerId?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  logo?: string;
  managerId?: string;
  primaryColor?: string;
}

export interface InviteManagerRequest {
  email: string;
  name: string;
  locale?: string;
}

// Response types
export interface TeamRef {
  id: number;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
}

export interface SeasonTeamRef {
  id: number;
  seasonId: number;
  teamId: number;
  season: {
    id: number;
    name: string;
    startDate: Date;
    endDate: Date;
    status: SeasonStatus;
    createdAt: Date;
    updatedAt: Date;
    leagueId: number;
    league: LeagueRef;
  };
}

export interface TeamListItem {
  id: number;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
  _count: {
    players: number;
  };
}

export interface TeamWithSeason extends TeamListItem {
  seasonTeams: SeasonTeamRef[];
}

export interface GameForTeam {
  id: number;
  date: Date | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  round: number | null;
  homeTeam?: TeamRef;
  awayTeam?: TeamRef;
}

export interface TeamDetail {
  id: number;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  seasonTeams: SeasonTeamRef[];
  manager: ManagerRef | null;
  players: PlayerResponse[];
  games: GameForTeam[];
}

export interface TeamResponse {
  id: number;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: number | null;
  manager: ManagerRef | null;
}

// ============================================================================
// PLAYER TYPES
// ============================================================================

// Request bodies
export interface CreatePlayerRequest {
  name: string;
  number?: string | number;
  position?: string;
  bornYear?: string | number;
  note?: string;
}

export interface UpdatePlayerRequest {
  name?: string;
  number?: string | number;
  position?: string;
  bornYear?: string | number | null;
  note?: string | null;
}

// Response types
export interface PlayerResponse {
  id: number;
  name: string;
  number: number | null;
  position: string | null;
  bornYear: number | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  teamId: number;
}

export interface PlayerDetail {
  id: number;
  name: string;
  number: number | null;
  position: string | null;
  bornYear: number | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  teamId: number;
  team: TeamWithSeason;
}

// ============================================================================
// GAME TYPES
// ============================================================================

// Request bodies
export interface CreateGameRequest {
  homeTeamId: string | number;
  awayTeamId: string | number;
  date?: string;
  location?: string;
  round?: string | number;
}

export interface UpdateGameRequest {
  homeTeamId?: string | number;
  awayTeamId?: string | number;
  date?: string;
  location?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  period1HomeScore?: number | null;
  period1AwayScore?: number | null;
  period2HomeScore?: number | null;
  period2AwayScore?: number | null;
  period3HomeScore?: number | null;
  period3AwayScore?: number | null;
  status?: GameStatus;
  round?: string | number | null;
}

export interface GenerateScheduleRequest {
  rounds?: number;
}

// Response types
export interface GameListItem {
  id: number;
  date: Date | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  round: number | null;
  createdAt: Date;
  updatedAt: Date;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
}

export interface GameDetail {
  id: number;
  date: Date | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  round: number | null;
  createdAt: Date;
  updatedAt: Date;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
  season: SeasonResponse;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
}

export interface GenerateScheduleResponse {
  message: string;
  games: GameListItem[];
}

// ============================================================================
// HOCKEY GAME STATISTIC TYPES
// ============================================================================

// Request bodies
export interface CreateHockeyGameStatisticRequest {
  playerId: string | number;
  goals?: number | null;
  assists?: number | null;
}

export interface UpdateHockeyGameStatisticRequest {
  goals?: number | null;
  assists?: number | null;
}

// Response types
export interface HockeyGameStatisticResponse {
  id: number;
  playerId: number;
  gameId: number;
  goals: number | null;
  assists: number | null;
}

export interface GameIdParam {
  gameId: string;
}

export interface PlayerIdParam {
  playerId: string;
}

// ============================================================================
// STANDINGS TYPES
// ============================================================================

export interface StandingTeamRef {
  id: number;
  name: string;
  logo: string | null;
  primaryColor?: string | null;
}

export interface Standing {
  team: StandingTeamRef;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TeamStanding extends Standing {
  rank: number;
  totalTeams: number;
}

// ============================================================================
// FILTER TYPES (for query parameters)
// ============================================================================

export interface UserFilters {
  role?: Role;
  name?: { contains: string; mode: 'insensitive' };
  active?: boolean;
}

// ============================================================================
// TOURNAMENT TYPES
// ============================================================================

// --- TournamentSeries ---
export interface CreateTournamentSeriesRequest {
  name: string;
  sportType?: SportType;
  logo?: string;
  description?: string;
  managerId?: number | null;
}

export interface UpdateTournamentSeriesRequest {
  name?: string;
  sportType?: SportType;
  logo?: string | null;
  description?: string | null;
  managerId?: number | null;
}

// --- Tournament (edition) ---
export interface CreateTournamentRequest {
  name: string;
  year?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
}

export interface UpdateTournamentRequest {
  name?: string;
  year?: number | null;
  status?: TournamentStatus;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
}

// --- TournamentTeam ---
export interface CreateTournamentTeamRequest {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  country?: string | null;
}

export interface UpdateTournamentTeamRequest {
  name?: string;
  logo?: string | null;
  primaryColor?: string | null;
  country?: string | null;
}

// --- TournamentPlayer ---
export interface CreateTournamentPlayerRequest {
  name: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
}

export interface UpdateTournamentPlayerRequest {
  name?: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
}

// --- TournamentGroup ---
export interface CreateTournamentGroupRequest {
  name: string;
}

export interface UpdateTournamentGroupRequest {
  name?: string;
}

export interface AssignTeamToGroupRequest {
  teamId: number;
}

// --- TournamentGame ---
export interface CreateTournamentGameRequest {
  phase: TournamentGamePhase;
  groupId?: number | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  date?: string | null;
  location?: string | null;
  bracketSlot?: number | null;
  note?: string | null;
}

export interface UpdateTournamentGameRequest {
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string | null;
  location?: string | null;
  status?: GameStatus;
  bracketSlot?: number | null;
  note?: string | null;
}

export interface GenerateTournamentScheduleRequest {
  startDate: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  locations: string[];
  minRestGames?: number;
}

export interface GenerateTournamentPlayoffsRequest {
  qualifiersPerGroup: number;
  startTime: string;
  slotDurationMinutes: number;
  location?: string;
}

// --- TournamentGameStatistic ---
export interface CreateTournamentGameStatisticRequest {
  playerId: number;
  goals?: number | null;
  assists?: number | null;
}

export interface UpdateTournamentGameStatisticRequest {
  goals?: number | null;
  assists?: number | null;
}

// ============================================================================
// RE-EXPORT PRISMA ENUMS FOR CONVENIENCE
// ============================================================================

export { Role, SeasonStatus, GameStatus, SportType, TournamentStatus, TournamentGamePhase };
