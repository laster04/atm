import { Request } from 'express';
import { Role, SeasonStatus, GameStatus, SportType, TournamentStatus, TournamentGamePhase } from '@prisma/client';

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  onboardingCompletedAt?: Date | null;
  teamTourCompletedAt?: Date | null;
  /** Counts of the manager relations this user holds; see services/access. */
  manages?: { leagues: number; teams: number; series: number };
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JwtPayload {
  userId: string;
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
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserWithActive extends UserPublic {
  active: boolean;
}

// Manager reference used in relations
export interface ManagerRef {
  id: string;
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
  id: string;
  name: string;
  sportType: SportType;
  managerId?: string | null;
}

export interface LeagueListItem {
  id: string;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  manager: ManagerRef | null;
  _count: {
    seasons: number;
  };
}

export interface LeagueDetail {
  id: string;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  manager: ManagerRef | null;
  seasons: SeasonInLeague[];
}

export interface SeasonInLeague {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: string;
  _count: {
    seasonTeams: number;
    games: number;
  };
}

export interface LeagueResponse {
  id: string;
  name: string;
  sportType: SportType;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  manager: ManagerRef | null;
}

// ============================================================================
// SEASON TYPES
// ============================================================================

// Request bodies
export interface CreateSeasonRequest {
  name: string;
  leagueId: string;
  startDate: string;
  endDate: string;
  status?: SeasonStatus;
}

export interface UpdateSeasonRequest {
  name?: string;
  leagueId?: string;
  startDate?: string;
  endDate?: string;
  status?: SeasonStatus;
}

// Response types
export interface SeasonListItem {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: string;
  league: LeagueRef;
  _count: {
    seasonTeams: number;
    games: number;
  };
}

export interface TeamInSeason {
  id: string;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  manager: ManagerRef | null;
  _count: {
    players: number;
  };
}

export interface SeasonDetail {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: string;
  league: LeagueRef;
  teams: TeamInSeason[];
  _count: {
    games: number;
  };
}

export interface SeasonResponse {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
  leagueId: string;
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
  id: string;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
}

export interface SeasonTeamRef {
  id: string;
  seasonId: string;
  teamId: string;
  season: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: SeasonStatus;
    createdAt: Date;
    updatedAt: Date;
    leagueId: string;
    league: LeagueRef;
  };
}

export interface TeamListItem {
  id: string;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  manager: ManagerRef | null;
  _count: {
    players: number;
  };
}

export interface TeamWithSeason extends TeamListItem {
  seasonTeams: SeasonTeamRef[];
}

export interface GameForTeam {
  id: string;
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
  id: string;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  seasonTeams: SeasonTeamRef[];
  manager: ManagerRef | null;
  players: PlayerResponse[];
  games: GameForTeam[];
}

export interface TeamResponse {
  id: string;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
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
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  bornYear: number | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
}

export interface PlayerDetail {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  bornYear: number | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
  team: TeamWithSeason;
}

// ============================================================================
// GAME TYPES
// ============================================================================

// Request bodies
export interface CreateGameRequest {
  homeTeamId: string;
  awayTeamId: string;
  date?: string | null;
  location?: string;
  round?: string | number;
}

export interface UpdateGameRequest {
  homeTeamId?: string;
  awayTeamId?: string;
  date?: string | null;
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
  id: string;
  date: Date | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  round: number | null;
  createdAt: Date;
  updatedAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
}

export interface GameDetail {
  id: string;
  date: Date | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  round: number | null;
  createdAt: Date;
  updatedAt: Date;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
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
  playerId: string;
  goals?: number | null;
  assists?: number | null;
  penaltyMinutes?: number | null;
}

export interface UpdateHockeyGameStatisticRequest {
  goals?: number | null;
  assists?: number | null;
  penaltyMinutes?: number | null;
}

// Response types
export interface HockeyGameStatisticResponse {
  id: string;
  playerId: string;
  gameId: string;
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
  id: string;
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
  managerId?: string | null;
}

export interface UpdateTournamentSeriesRequest {
  name?: string;
  sportType?: SportType;
  logo?: string | null;
  description?: string | null;
  managerId?: string | null;
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
  teamId: string;
}

// --- TournamentGame ---
export interface CreateTournamentGameRequest {
  phase: TournamentGamePhase;
  groupId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  date?: string | null;
  location?: string | null;
  bracketSlot?: number | null;
  note?: string | null;
}

export interface UpdateTournamentGameRequest {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string | null;
  location?: string | null;
  status?: GameStatus;
  bracketSlot?: number | null;
  note?: string | null;
}

export interface GenerateTournamentScheduleRequest {
  // Required for all sports except TENNIS, where matches have no fixed
  // duration/venue and are generated without date/location.
  startDate?: string;
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
  locations?: string[];
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
  playerId: string;
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
