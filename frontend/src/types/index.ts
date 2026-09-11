// Role only separates a global administrator from a regular account. Whether a
// user manages a league, a team or a tournament series comes from User.manages,
// which counts the manager relations they actually hold.
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface ManagedCounts {
  leagues: number;
  teams: number;
  series: number;
}
export enum SeasonStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum SportType {
  HOCKEY = 'HOCKEY',
  // FOOTBALL = 'FOOTBALL',
  // BASKETBALL = 'BASKETBALL',
  // VOLLEYBALL = 'VOLLEYBALL',
  TENNIS = 'TENNIS',
  // HANDBALL = 'HANDBALL',
  // FLOORBALL = 'FLOORBALL',
  OTHER = 'OTHER',
}

export enum GameStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  POSTPONED = 'POSTPONED',
  CANCELLED = 'CANCELLED',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  emailVerified?: boolean;
  onboardingCompletedAt?: string | null;
  teamTourCompletedAt?: string | null;
  /** Only present on the signed-in user, from /auth/me and /auth/login. */
  manages?: ManagedCounts;
}

export interface League {
  id: string;
  name: string;
  sportType: SportType;
  logo?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  managerId?: string | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  seasons?: Season[];
  _count?: {
    seasons: number;
  };
}

export interface LeagueRef {
  id: string;
  name: string;
  sportType: SportType;
  managerId?: string | null;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leagueId: string;
  league?: LeagueRef;
  teams?: Team[];
  _count?: {
    seasonTeams?: number;
    teams?: number;
    games: number;
  };
}

export interface Team {
  id: string;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  managerId?: string | null;
  season?: Season;
  seasonTeams?: { id: string; seasonId: string; teamId: string; season: Season }[];
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  players?: Player[];
  homeGames?: Game[];
  awayGames?: Game[];
  games?: Game[];
  /** Next dated SCHEDULED fixture; only returned by GET /teams/my. */
  nextGame?: Game | null;
  _count?: {
    players: number;
  };
}

export interface Player {
  id: string;
  name: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
  teamId: string;
  team?: Team;
}

export interface Game {
  id: string;
  date?: string | null;
  location?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  period1HomeScore?: number | null;
  period1AwayScore?: number | null;
  period2HomeScore?: number | null;
  period2AwayScore?: number | null;
  period3HomeScore?: number | null;
  period3AwayScore?: number | null;
  status: GameStatus;
  round?: number | null;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  season?: Season;
  homeTeam?: Pick<Team, 'id' | 'name' | 'managerId' | 'logo' | 'primaryColor'>;
  awayTeam?: Pick<Team, 'id' | 'name' | 'managerId' | 'logo' | 'primaryColor'>;
}

export interface Standing {
  team: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'>;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface HockeyGameStatistic {
  id: string;
  playerId: string;
  gameId: string;
  goals?: number | null;
  assists?: number | null;
  penaltyMinutes?: number | null;
  player?: Player & { team?: Team };
  game?: Game & { homeTeam?: Team; awayTeam?: Team };
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: User; token: string }>;
  register: (email: string, password: string, name: string) => Promise<{ user: User; token: string }>;
  logout: () => void;
  completeOnboarding: () => Promise<void>;
  completeTeamTour: () => Promise<void>;
  isAdmin: () => boolean;
  isSeasonManager: () => boolean;
  isTeamManager: () => boolean;
  isTournamentManager: () => boolean;
  canManageTeam: (teamManagerId?: string | null) => boolean;
}

export interface TopScorer {
  player: Player;
  goals: number;
  assists: number;
  penaltyMinutes: number;
  gamesPlayed: number;
  points: number;
}

export interface ArchivedStanding extends Standing {
  rank: number;
  totalTeams: number;
}

export interface ArchivedPlayerStat {
  player: { id: string; name: string; number?: number | null; team: { id: string; name: string } };
  goals: number;
  assists: number;
  penaltyMinutes: number;
  gamesPlayed: number;
  points: number;
}

// ============================================================
// TOURNAMENT
// ============================================================

export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'GROUP_STAGE' | 'PLAYOFF' | 'COMPLETED';
export type TournamentGamePhase = 'GROUP' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'BRONZE' | 'FINAL';

export interface TournamentSeries {
  id: string;
  name: string;
  sportType: SportType;
  logo?: string | null;
  description?: string | null;
  managerId?: string | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  tournaments?: Tournament[];
  _count?: { tournaments: number };
}

export interface Tournament {
  id: string;
  name: string;
  year?: number | null;
  status: TournamentStatus;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  seriesId: string;
  series?: Pick<TournamentSeries, 'id' | 'name' | 'sportType' | 'logo'>;
  teams?: TournamentTeam[];
  groups?: TournamentGroup[];
  games?: TournamentGame[];
  _count?: { teams: number; groups: number; games: number };
}

export interface TournamentTeam {
  id: string;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  country?: string | null;
  tournamentId: string;
  players?: TournamentPlayer[];
  groupTeams?: Array<{ group: Pick<TournamentGroup, 'id' | 'name'> }>;
  _count?: { players: number };
}

export interface TournamentPlayer {
  id: string;
  name: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
  teamId: string;
  team?: TournamentTeam;
}

export interface TournamentGroup {
  id: string;
  name: string;
  tournamentId: string;
  teams?: Array<{ team: TournamentTeam }>;
  games?: TournamentGame[];
  _count?: { games: number };
}

export interface TournamentGame {
  id: string;
  phase: TournamentGamePhase;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string | null;
  location?: string | null;
  status: GameStatus;
  bracketSlot?: number | null;
  homeSeed?: number | null;
  awaySeed?: number | null;
  note?: string | null;
  tournamentId: string;
  groupId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: Pick<TournamentTeam, 'id' | 'name' | 'logo' | 'primaryColor' | 'country'> | null;
  awayTeam?: Pick<TournamentTeam, 'id' | 'name' | 'logo' | 'primaryColor' | 'country'> | null;
  group?: Pick<TournamentGroup, 'id' | 'name'> | null;
  statistics?: TournamentGameStatistic[];
}

export interface TournamentGameStatistic {
  id: string;
  gameId: string;
  playerId: string;
  goals?: number | null;
  assists?: number | null;
  player?: TournamentPlayer & { team?: TournamentTeam };
}

export interface TournamentStanding {
  teamId: string;
  team?: TournamentTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface TournamentTopScorer {
  player: TournamentPlayer & { team?: TournamentTeam };
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
}
