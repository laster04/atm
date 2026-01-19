export enum Role {
  ADMIN = 'ADMIN',
  SEASON_MANAGER = 'SEASON_MANAGER',
  TEAM_MANAGER = 'TEAM_MANAGER',
  VIEWER = 'VIEWER',
}
export enum SeasonStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum SportType {
  FOOTBALL = 'FOOTBALL',
  BASKETBALL = 'BASKETBALL',
  VOLLEYBALL = 'VOLLEYBALL',
  HOCKEY = 'HOCKEY',
  TENNIS = 'TENNIS',
  HANDBALL = 'HANDBALL',
  FLOORBALL = 'FLOORBALL',
  OTHER = 'OTHER',
}
export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface Season {
  id: number;
  name: string;
  sportType: SportType;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  createdAt: string;
  updatedAt: string;
  managerId?: number | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  teams?: Team[];
  _count?: {
    teams: number;
    games: number;
  };
}

export interface Team {
  id: number;
  name: string;
  logo?: string | null;
  seasonId: number;
  managerId?: number | null;
  season?: Season;
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
  teamId: number;
  team?: Team;
}

export interface Game {
  id: number;
  date: string;
  location?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: GameStatus;
  round?: number | null;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
  season?: Season;
  homeTeam?: Pick<Team, 'id' | 'name' | 'logo'>;
  awayTeam?: Pick<Team, 'id' | 'name' | 'logo'>;
}

export interface Standing {
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
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
  canManageTeam: (teamManagerId?: number | null) => boolean;
}
