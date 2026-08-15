export enum Role {
  ADMIN = 'ADMIN',
  SEASON_MANAGER = 'SEASON_MANAGER',
  TEAM_MANAGER = 'TEAM_MANAGER',
  TOURNAMENT_MANAGER = 'TOURNAMENT_MANAGER',
  VIEWER = 'VIEWER',
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
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  emailVerified?: boolean;
}

export interface League {
  id: number;
  name: string;
  sportType: SportType;
  logo?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  managerId?: number | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  seasons?: Season[];
  _count?: {
    seasons: number;
  };
}

export interface LeagueRef {
  id: number;
  name: string;
  sportType: SportType;
  managerId?: number | null;
}

export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  createdAt: string;
  updatedAt: string;
  leagueId: number;
  league?: LeagueRef;
  teams?: Team[];
  _count?: {
    seasonTeams?: number;
    teams?: number;
    games: number;
  };
}

export interface Team {
  id: number;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  managerId?: number | null;
  season?: Season;
  seasonTeams?: { id: number; seasonId: number; teamId: number; season: Season }[];
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  players?: Player[];
  homeGames?: Game[];
  awayGames?: Game[];
  games?: Game[];
  _count?: {
    players: number;
  };
}

export interface Player {
  id: number;
  name: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
  teamId: number;
  team?: Team;
}

export interface Game {
  id: number;
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
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
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
  id: number;
  playerId: number;
  gameId: number;
  goals?: number | null;
  assists?: number | null;
  player?: Player & { team?: Team };
  game?: Game & { homeTeam?: Team; awayTeam?: Team };
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: User; token: string }>;
  register: (email: string, password: string, name: string) => Promise<{ user: User; token: string }>;
  logout: () => void;
  isAdmin: () => boolean;
  isSeasonManager: () => boolean;
  isTeamManager: () => boolean;
  isTournamentManager: () => boolean;
  canManageTeam: (teamManagerId?: number | null) => boolean;
}

export interface TopScorer {
  player: Player;
  goals: number;
  assists: number;
  gamesPlayed: number;
  points: number;
}

// ============================================================
// TOURNAMENT
// ============================================================

export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'GROUP_STAGE' | 'PLAYOFF' | 'COMPLETED';
export type TournamentGamePhase = 'GROUP' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'BRONZE' | 'FINAL';

export interface TournamentSeries {
  id: number;
  name: string;
  sportType: SportType;
  logo?: string | null;
  description?: string | null;
  managerId?: number | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  tournaments?: Tournament[];
  _count?: { tournaments: number };
}

export interface Tournament {
  id: number;
  name: string;
  year?: number | null;
  status: TournamentStatus;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  seriesId: number;
  series?: Pick<TournamentSeries, 'id' | 'name' | 'sportType' | 'logo'>;
  teams?: TournamentTeam[];
  groups?: TournamentGroup[];
  games?: TournamentGame[];
  _count?: { teams: number; groups: number; games: number };
}

export interface TournamentTeam {
  id: number;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  country?: string | null;
  tournamentId: number;
  players?: TournamentPlayer[];
  groupTeams?: Array<{ group: Pick<TournamentGroup, 'id' | 'name'> }>;
  _count?: { players: number };
}

export interface TournamentPlayer {
  id: number;
  name: string;
  number?: number | null;
  position?: string | null;
  bornYear?: number | null;
  note?: string | null;
  teamId: number;
  team?: TournamentTeam;
}

export interface TournamentGroup {
  id: number;
  name: string;
  tournamentId: number;
  teams?: Array<{ team: TournamentTeam }>;
  games?: TournamentGame[];
  _count?: { games: number };
}

export interface TournamentGame {
  id: number;
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
  tournamentId: number;
  groupId?: number | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeam?: Pick<TournamentTeam, 'id' | 'name' | 'logo' | 'primaryColor' | 'country'> | null;
  awayTeam?: Pick<TournamentTeam, 'id' | 'name' | 'logo' | 'primaryColor' | 'country'> | null;
  group?: Pick<TournamentGroup, 'id' | 'name'> | null;
  statistics?: TournamentGameStatistic[];
}

export interface TournamentGameStatistic {
  id: number;
  gameId: number;
  playerId: number;
  goals?: number | null;
  assists?: number | null;
  player?: TournamentPlayer & { team?: TournamentTeam };
}

export interface TournamentStanding {
  teamId: number;
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
