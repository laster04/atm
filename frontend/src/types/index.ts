export type Role = 'ADMIN' | 'TEAM_MANAGER' | 'VIEWER';
export type SeasonStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Season {
  id: number;
  name: string;
  sportType: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  createdAt: string;
  updatedAt: string;
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
  isTeamManager: () => boolean;
  canManageTeam: (teamManagerId?: number | null) => boolean;
}
