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
/**
 * Who may see a league, a season or a tournament series. Inherited downwards,
 * strictest wins: a season is never more visible than its league.
 */
export enum Visibility {
  PUBLIC = 'PUBLIC',
  UNLISTED = 'UNLISTED',
  PRIVATE = 'PRIVATE',
}

export enum SeasonStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum SportType {
  HOCKEY = 'HOCKEY',
  FOOTBALL = 'FOOTBALL',
  BASKETBALL = 'BASKETBALL',
  VOLLEYBALL = 'VOLLEYBALL',
  TENNIS = 'TENNIS',
  HANDBALL = 'HANDBALL',
  FLOORBALL = 'FLOORBALL',
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
  /** Opt-out for the round summary. Transactional mail ignores it. */
  emailDigest?: boolean;
  onboardingCompletedAt?: string | null;
  teamTourCompletedAt?: string | null;
  /** When the user last opened /updates; drives the unread marker. */
  updatesSeenAt?: string | null;
  /** Language of the e-mails the user gets; follows the language picked in the app. */
  locale?: string;
  /** Admin user list only. Null if the user never logged in. */
  lastLoggedInAt?: string | null;
  /** Only present on the signed-in user, from /auth/me and /auth/login. */
  manages?: ManagedCounts;
}

/** How results become table points, and how ties are broken. */
/** SET_RATIO and BALL_RATIO are volleyball's: sets and balls won over lost. */
export type Tiebreaker = 'HEAD_TO_HEAD' | 'GOAL_DIFF' | 'GOALS_FOR' | 'WINS' | 'PLAYED' | 'SET_RATIO' | 'BALL_RATIO';

export interface ScoringPolicy {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  otWinPoints: number;
  otLossPoints: number;
  allowDraws: boolean;
  tiebreakers: Tiebreaker[];
}

/** What a results email says, as the preview endpoint returns it. */
export interface RoundSummary {
  seasonId: string;
  seasonName: string;
  leagueName: string;
  /** Null for an email of hand-picked games. */
  round: number | null;
  results: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    playedOn: string | null;
    confirmed: boolean;
  }[];
  standings: {
    rank: number;
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }[];
  topScorers: { name: string; team: string; goals: number; assists: number; points: number; detail: string | null }[];
}

export interface SeasonDigest {
  id: string;
  /** Null for an email of hand-picked games. */
  round: number | null;
  sentAt: string;
  recipientCount: number;
  sentBy?: Pick<User, 'id' | 'name'> | null;
  _count?: { games: number };
}

/** A finished game no results email has mentioned yet. */
export interface UnsentGame {
  id: string;
  date: string | null;
  round: number | null;
  homeScore: number | null;
  awayScore: number | null;
  confirmedAt: string | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export interface ResultsEmailCandidates {
  games: UnsentGame[];
  recipientCount: number;
}

export interface League {
  id: string;
  name: string;
  sportType: SportType;
  /** Null inherits the sport default; a season may override again. */
  scoring?: ScoringPolicy | null;
  logo?: string | null;
  description?: string | null;
  visibility?: Visibility;
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
  visibility?: Visibility;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  /** Null inherits the league, which in turn falls back to the sport default. */
  scoring?: ScoringPolicy | null;
  /** New seasons start UNLISTED and are published once the draw is ready. */
  visibility?: Visibility;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leagueId: string;
  league?: LeagueRef;
  /** In public lists: the season takes team applications right now. */
  registrationOpen?: boolean;
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
  /** Invite link to the team's group chat; only sent to the team's own people. */
  chatUrl?: string | null;
  managerId?: string | null;
  season?: Season;
  seasonTeams?: { id: string; seasonId: string; teamId: string; season: Season }[];
  /** Sports of every season the team is in, listed or not; from GET /teams/:id and GET /players/:id. */
  sportTypes?: SportType[];
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

/** Mirrors the backend PlayerPosition enum; which ones a player may hold depends on the sport. */
export type PlayerPosition =
  | 'GOALIE'
  | 'DEFENDER'
  | 'MIDFIELDER'
  | 'FORWARD'
  | 'WING'
  | 'BACK'
  | 'PIVOT'
  | 'GUARD'
  | 'CENTER'
  | 'SETTER'
  | 'OUTSIDE_HITTER'
  | 'OPPOSITE'
  | 'MIDDLE_BLOCKER'
  | 'LIBERO';

export interface Player {
  id: string;
  name: string;
  number?: number | null;
  position?: PlayerPosition | null;
  bornYear?: number | null;
  note?: string | null;
  teamId: string;
  team?: Team;
  // A roster row exists whether or not the person behind it has an account.
  userId?: string | null;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
}

/** A roster spot the signed-in user holds, from `GET /players/me`. */
export interface MyPlayerProfile extends Player {
  team: Team & { seasons?: Pick<Season, 'id' | 'name' | 'status' | 'startDate'>[] };
}

export interface Game {
  id: string;
  date?: string | null;
  location?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Score of each period, half, quarter or set, in order (utils/sportProfiles.ts). */
  periodScores?: PartScore[] | null;
  status: GameStatus;
  round?: number | null;
  /** Set on a play-off game: the series it belongs to. Such games never count in the table. */
  playoffSeriesId?: string | null;
  /** The stage of a play-off game; from GET /games/season/:id. */
  playoffSeries?: { round: PlayoffRound } | null;
  // True when this game's scores come from its match report. They are then
  // read-only: the API refuses a direct edit.
  eventsAuthoritative?: boolean;
  // Set once the report is closed. Everything about the game is then read-only
  // until someone with season access reopens it with a reason.
  confirmedAt?: string | null;
  confirmedById?: string | null;
  confirmedBy?: Pick<User, 'id' | 'name'> | null;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  season?: Season;
  homeTeam?: Pick<Team, 'id' | 'name' | 'managerId' | 'logo' | 'primaryColor'>;
  awayTeam?: Pick<Team, 'id' | 'name' | 'managerId' | 'logo' | 'primaryColor'>;
}

/** A division or group inside a season. */
export interface SeasonGroup {
  id: string;
  name: string;
  position: number;
  seasonId: string;
  seasonTeams?: { id: string; teamId: string; team: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'> }[];
}

/**
 * One table. `group` is null for an undivided season, and for the teams in a
 * divided season that have not been placed yet.
 */
export interface GroupTable {
  group: Pick<SeasonGroup, 'id' | 'name' | 'position'> | null;
  standings: Standing[];
}

export interface LiveProjection {
  rank: number;
  points: number;
  played: number;
  /** Places gained if the games in progress end as they stand. */
  movement: number;
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
  /** Wins and losses decided after regulation: a volleyball 3:2 / 2:3. */
  otWins: number;
  otLosses: number;
  /** Volleyball balls (míče) won and lost, summed from the set scores. */
  partPointsFor: number;
  partPointsAgainst: number;
  /** Position in the official table, 1-based. */
  rank: number;
  /** True while this team has a game in progress. */
  inPlay: boolean;
  /** True when this team has a result played but not yet confirmed. */
  awaitingConfirmation: boolean;
  /** Where the team would stand if the games in progress ended as they are. */
  live: LiveProjection | null;
}

export const MatchEventType = {
  GOAL: 'GOAL',
  PENALTY: 'PENALTY',
  GOALIE_CHANGE: 'GOALIE_CHANGE',
  TIMEOUT: 'TIMEOUT',
  PERIOD_START: 'PERIOD_START',
  PERIOD_END: 'PERIOD_END',
  SHOOTOUT_ATTEMPT: 'SHOOTOUT_ATTEMPT',
  CARD: 'CARD',
} as const;
export type MatchEventType = (typeof MatchEventType)[keyof typeof MatchEventType];

export type CardColor = 'YELLOW' | 'RED';

/** The score of one part of a game: a period, half, quarter or set. */
export interface PartScore {
  home: number;
  away: number;
}

/** A number a player line can carry; each sport keeps a few (utils/sportProfiles.ts). */
export type StatKey = 'goals' | 'assists' | 'penaltyMinutes' | 'yellowCards' | 'redCards' | 'points' | 'fouls';

export type StatTotals = Record<StatKey, number>;

type EventPlayerRef = Pick<Player, 'id' | 'name' | 'number'>;

/**
 * One line of a match report. A game's score, period scores and player
 * statistics are all derived from these, so editing one corrects all of them.
 */
export interface MatchEvent {
  id: string;
  type: MatchEventType;
  period: number;
  minute?: number | null;
  second?: number | null;
  gameId: string;
  teamId: string;
  team?: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'>;
  playerId?: string | null;
  player?: EventPlayerRef | null;
  assistPlayerId?: string | null;
  assistPlayer?: EventPlayerRef | null;
  secondaryAssistPlayerId?: string | null;
  secondaryAssistPlayer?: EventPlayerRef | null;
  penaltyMinutes?: number | null;
  penaltyType?: string | null;
  cardColor?: CardColor | null;
  note?: string | null;
  createdAt: string;
}

export const TeamEventType = {
  MATCH: 'MATCH',
  TRAINING: 'TRAINING',
  MEETING: 'MEETING',
  OTHER: 'OTHER',
} as const;
export type TeamEventType = (typeof TeamEventType)[keyof typeof TeamEventType];

export const AttendanceStatus = {
  ATTENDING: 'ATTENDING',
  NOT_ATTENDING: 'NOT_ATTENDING',
  MAYBE: 'MAYBE',
  NO_RESPONSE: 'NO_RESPONSE',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export interface Attendance {
  // Null for a roster member who has not answered: the row is written on the
  // first answer, not when the event is created.
  id: string | null;
  eventId: string;
  playerId: string;
  status: AttendanceStatus;
  note?: string | null;
  respondedAt?: string | null;
  player?: Pick<Player, 'id' | 'name' | 'number' | 'userId'>;
}

/** Anything the team turns up to, including a mirrored league fixture. */
export interface TeamEvent {
  id: string;
  type: TeamEventType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  teamId: string;
  gameId?: string | null;
  attendances?: Attendance[];
}

/** One upcoming event as the signed-in player sees it, from `GET /events/mine`. */
export interface MyTeamEvent extends Omit<TeamEvent, 'attendances'> {
  team: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'>;
  myAttendance: Pick<Attendance, 'id' | 'playerId' | 'status' | 'note'> | null;
}

export interface TeamEventInput {
  type?: TeamEventType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  gameId?: string | null;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM' | 'REOPEN';

/** One line of the administrative trail behind a record. */
export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  actor?: Pick<User, 'id' | 'name' | 'email'> | null;
  createdAt: string;
}

export interface MatchEventInput {
  type: MatchEventType;
  teamId: string;
  period?: number;
  minute?: number | null;
  second?: number | null;
  playerId?: string | null;
  assistPlayerId?: string | null;
  secondaryAssistPlayerId?: string | null;
  penaltyMinutes?: number | null;
  penaltyType?: string | null;
  cardColor?: CardColor | null;
  note?: string | null;
}

/** One player's line in one game; numbers the sport does not keep stay null. */
export interface PlayerGameStatistic {
  id: string;
  playerId: string;
  gameId: string;
  goals?: number | null;
  assists?: number | null;
  penaltyMinutes?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  points?: number | null;
  fouls?: number | null;
  player?: Player & { team?: Team };
  game?: Game & { homeTeam?: Team; awayTeam?: Team };
}

/** An invitation to manage a team or league, as its sender sees it. */
export type ManagerInviteStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

/** What an invitation is for: running a team or a league, or a spot on a roster. */
export type InviteKind = 'TEAM' | 'LEAGUE' | 'PLAYER';

export interface ManagerInvite {
  id: string;
  teamId: string | null;
  leagueId: string | null;
  playerId: string | null;
  email: string;
  name: string;
  locale: string;
  sentAt: string;
  expiresAt: string;
  status: ManagerInviteStatus;
}

/** Sending or resending answers with the link; it is the only time it is known. */
export interface ManagerInviteSent {
  invite: ManagerInvite;
  link: string;
}

/** What the person holding an invitation link sees before accepting. */
export interface PublicManagerInvite {
  status: ManagerInviteStatus;
  kind: InviteKind;
  email: string;
  name: string;
  /** The team to manage, or the one a player joins. */
  team: { id: string; name: string; primaryColor: string | null } | null;
  league: { id: string; name: string } | null;
  player: { name: string; number: number | null } | null;
  seasonName: string | null;
  leagueName: string | null;
  invitedByName: string | null;
  expiresAt: string;
  hasAccount: boolean;
}

export interface AcceptedManagerInvite {
  kind: InviteKind;
  teamId: string | null;
  leagueId: string | null;
  playerId: string | null;
  /** Set when the invite created the account; the invitee is signed in with it. */
  session: { user: User; token: string } | null;
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
  markUpdatesSeen: () => Promise<void>;
  /** Adopts a session the server already started, e.g. by accepting an invitation. */
  startSession: (session: { user: User; token: string }) => void;
  /** Re-reads the signed-in user, e.g. after they were given something to manage. */
  refreshUser: () => Promise<void>;
}

export type SupportCategory = 'QUESTION' | 'PROBLEM' | 'COMPLAINT' | 'IDEA';
export type SupportTicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';

export interface SupportTicketInput {
  category: SupportCategory;
  subject: string;
  message: string;
  email?: string;
  context?: { page: string; viewport: string; userAgent: string; signedIn: boolean };
  clientToken: string;
  /** Honeypot; a person never fills it in. */
  website?: string;
}

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  message: string;
  email: string | null;
  context: Record<string, string | boolean> | null;
  status: SupportTicketStatus;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

/**
 * A player's totals. `points` is basketball points scored; `rankTotal` is what
 * the sport ranks by (goals + assists in hockey, goals in football, points in basketball).
 */
export interface TopScorer extends StatTotals {
  player: Player;
  gamesPlayed: number;
  rankTotal: number;
}

export interface ArchivedStanding extends Standing {
  rank: number;
  totalTeams: number;
}

export interface ArchivedPlayerStat extends StatTotals {
  player: { id: string; name: string; number?: number | null; team: { id: string; name: string } };
  gamesPlayed: number;
  rankTotal: number;
}

// ============================================================
// TOURNAMENT
// ============================================================

export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'GROUP_STAGE' | 'PLAYOFF' | 'COMPLETED';
export type PlayoffRound = 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL' | 'BRONZE';

/** One pairing of a season's play-off, played as a best-of series. */
export interface PlayoffSeries {
  id: string;
  round: PlayoffRound;
  slot: number;
  bestOf: number;
  /** Seeds stand in for the teams until the regular season is settled. */
  homeSeed: number | null;
  awaySeed: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  homeTeam: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'> | null;
  awayTeam: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'> | null;
  winnerTeam: Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'> | null;
  homeWins: number;
  awayWins: number;
  games: (Pick<Game, 'id' | 'date' | 'location' | 'status' | 'homeTeamId' | 'awayTeamId' | 'homeScore' | 'awayScore'>
    & { confirmedAt: string | null })[];
}

export interface SeasonPlayoff {
  qualifiers: number;
  bracketSize: number;
  /** First round through the final; BRONZE is not listed. */
  rounds: Exclude<PlayoffRound, 'BRONZE'>[];
  seedsResolved: boolean;
  series: PlayoffSeries[];
}

export interface CreatePlayoffInput {
  qualifiers: number;
  bestOf: Partial<Record<PlayoffRound, number>>;
  bronze: boolean;
}

export type TournamentGamePhase = 'GROUP' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'BRONZE' | 'FINAL';

export interface TournamentSeries {
  id: string;
  name: string;
  sportType: SportType;
  logo?: string | null;
  description?: string | null;
  visibility?: Visibility;
  managerId?: string | null;
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  tournaments?: Tournament[];
  _count?: { tournaments: number };
  /** In public lists: one of its tournaments takes team applications right now. */
  registrationOpen?: boolean;
}

export type TournamentPlan = 'FREE' | 'TOURNAMENT' | 'TOURNAMENT_PLUS';
/** The plan a tournament's limits come from: its own, or the series manager's Organizer plan. */
export type PlanName = TournamentPlan | 'ORGANIZER';

export interface TeamAllowance {
  plan: PlanName;
  ownPlan: TournamentPlan;
  /** Teams the plan allows; null is unlimited. */
  limit: number | null;
  teams: number;
  /** When the series manager's Organizer plan ends, while one runs. */
  organizerUntil: string | null;
  /** A plan paid for and waiting for ATM to confirm the transfer. */
  pending: { paymentId: string; plan: PlanName; limit: number | null } | null;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type PaymentCurrency = 'CZK' | 'EUR';
export type OfferPlan = 'TOURNAMENT' | 'TOURNAMENT_PLUS' | 'ORGANIZER';

export interface PlanPayment {
  id: string;
  variableSymbol: number;
  status: PaymentStatus;
  productCode: string;
  plan: PlanName | null;
  productName: { cs: string; en: string };
  currency: PaymentCurrency;
  /** Minor units, VAT included. */
  amount: number;
  base: number;
  vat: number;
  vatRateBp: number;
  upgradeFrom: TournamentPlan | null;
  tournament: { id: string; name: string } | null;
  payer: { id: string; name: string; email: string } | null;
  confirmedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  /** The tax document issued on confirmation. */
  document: { id: string; number: string; kind: 'SIMPLIFIED' | 'FULL'; issuedAt: string; emailedAt: string | null } | null;
  account: { local: string; iban: string; bic: string | null; recipient: string } | null;
  /** The QR payment string while the payment waits. */
  qr: string | null;
}

/** A competition as the embedded widget's API describes it. */
export interface EmbedCompetition {
  kind: 'season' | 'tournament';
  id: string;
  name: string;
  parentName: string;
  sport: string;
  canHideBrand: boolean;
}

/** Where the widget is embedded, last 30 days. */
export interface EmbedUsage {
  sites: number;
  views: number;
  competitions: { kind: 'season' | 'tournament'; id: string; name: string; sites: string[]; views: number }[];
}

export interface EmbedTeamOption {
  id: string;
  name: string;
  logo: string | null;
  color: string | null;
}

/** One tournament plan on the public price list. Minor units, VAT included; a null limit is unlimited. */
export interface PublicPlanPrice {
  plan: PlanName;
  prices: Record<PaymentCurrency, number>;
  limits: { teams: number | null; sponsorLogos: number | null; documents: number | null };
}

export interface PlanStatus extends TeamAllowance {
  payment: PlanPayment | null;
}

export interface PlanOffer {
  plan: OfferPlan;
  productCode: string;
  limit: number | null;
  prices: Partial<Record<PaymentCurrency, number>>;
  upgradeFrom: TournamentPlan | null;
  /** A renewal of a running Organizer year: when the new one starts. */
  startsAt: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  year?: number | null;
  status: TournamentStatus;
  plan?: TournamentPlan;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  seriesId: string;
  series?: Pick<TournamentSeries, 'id' | 'name' | 'sportType' | 'logo' | 'visibility'>;
  teams?: TournamentTeam[];
  groups?: TournamentGroup[];
  games?: TournamentGame[];
  _count?: { teams: number; groups: number; games: number };
  /** In a series' list: the tournament takes team applications right now. */
  registrationOpen?: boolean;
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
  position?: PlayerPosition | null;
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

/* ---------------------------------------------------------------------------
 * The public directories — /teams, /players, /games, /stats and the header's
 * search. These read across seasons, which the manager endpoints never do, so
 * they page (`Paged`) rather than return everything.
 * ------------------------------------------------------------------------- */

export interface Paged<T> {
  items: T[];
  /** Rows matching the filter, not the page — what the counter shows. */
  total: number;
}

/** A team in the public directory, with the season it last played. */
export interface PublicTeam extends Omit<Team, 'season'> {
  /** The team's current season, or its most recent; null if it has none. */
  season: Season | null;
  seasonCount: number;
}

export interface PlayerTotals extends StatTotals {
  gamesPlayed: number;
  /** What the player's sport ranks by. */
  rankTotal: number;
}

/** A player in the public directory. Totals are career-wide unless narrowed. */
export interface PublicPlayer extends Player {
  team: Team;
  stats: PlayerTotals;
}

export interface PublicTeamQuery {
  search?: string;
  leagueId?: string;
  seasonId?: string;
  sport?: SportType;
  take?: number;
  skip?: number;
}

export interface PublicPlayerQuery {
  search?: string;
  teamId?: string;
  seasonId?: string;
  leagueId?: string;
  /** 'points' ranks before paging; the default pages by name. */
  sort?: 'name' | 'points';
  take?: number;
  skip?: number;
}

export interface PublicGameQuery {
  /** 'upcoming' (default) hides undated fixtures; 'results' reads newest first. */
  scope?: 'upcoming' | 'live' | 'results' | 'all';
  from?: string;
  to?: string;
  seasonId?: string;
  leagueId?: string;
  teamId?: string;
  take?: number;
  skip?: number;
}

export interface TopScorerQuery {
  leagueId?: string;
  seasonId?: string;
  sport?: SportType;
  limit?: number;
}

export interface SearchResults {
  query: string;
  teams: (Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'> & { _count: { players: number } })[];
  players: (Pick<Player, 'id' | 'name' | 'number' | 'position'> & {
    team: Pick<Team, 'id' | 'name' | 'primaryColor'>;
  })[];
  seasons: (Pick<Season, 'id' | 'name' | 'status' | 'startDate' | 'endDate'> & {
    league: LeagueRef;
  })[];
  leagues: (Pick<League, 'id' | 'name' | 'sportType' | 'logo'> & { _count: { seasons: number } })[];
  /** Admin only; empty for everyone else. */
  users?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'active'>[];
  /** Admin only; empty for everyone else. */
  tournaments?: (Pick<Tournament, 'id' | 'name' | 'status' | 'startDate'> & {
    series: Pick<TournamentSeries, 'id' | 'name' | 'sportType'>;
  })[];
}

// ============================================================
// ADMINISTRATION
// ============================================================

/** One page of an admin list. `estimated` totals come from the planner. */
export interface ListPage<T> {
  rows: T[];
  total: number;
  estimated: boolean;
  page: number;
  pageSize: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  emailVerified: boolean;
  lastLoggedInAt: string | null;
  createdAt: string;
  _count: { managedLeagues: number; managedTeams: number; managedTournamentSeries: number };
}

export interface AdminUserDetail extends Omit<AdminUserRow, '_count'> {
  emailVerifiedAt: string | null;
  emailDigest: boolean;
  managedLeagues: (Pick<League, 'id' | 'name' | 'sportType'> & {
    seasons: Pick<Season, 'id' | 'name' | 'status'>[];
  })[];
  managedTournamentSeries: (Pick<TournamentSeries, 'id' | 'name' | 'sportType'> & {
    tournaments: Pick<Tournament, 'id' | 'name' | 'status'>[];
  })[];
  managedTeams: Pick<Team, 'id' | 'name' | 'primaryColor'>[];
  _count: AdminUserRow['_count'] & { playerProfiles: number; supportTickets: number; registrations: number };
}

/** A dated version of a price, rate or limit; nothing is edited in place. */
interface Versioned {
  id: string;
  validFrom: string;
  createdAt: string;
}

export interface PriceVersion extends Versioned {
  /** Minor units (haléře / cents), VAT included. */
  priceCzk: number;
  priceEur: number;
}

export interface VatRateVersion extends Versioned {
  country: string;
  /** Hundredths of a percent: 2100 = 21 %. */
  rateBp: number;
}

export interface PlanLimitVersion extends Versioned {
  plan: string;
  key: string;
  /** null = unlimited, 0 = not included. */
  value: number | null;
}

export interface VersionSplit<T> {
  current: T | null;
  scheduled: T[];
  history: T[];
}

export interface PricingOverview {
  /** Only the account flagged for pricing may change anything here. */
  canEdit: boolean;
  products: ({ id: string; code: string; nameCs: string; nameEn: string } & VersionSplit<PriceVersion>)[];
  vatRates: ({ country: string } & VersionSplit<VatRateVersion>)[];
  euCountries: string[];
  limits: {
    plans: string[];
    keys: string[];
    cells: ({ plan: string; key: string } & VersionSplit<PlanLimitVersion>)[];
  };
  oss: {
    enabled: boolean;
    year: number;
    totalEurCents: number;
    limitEurCents: number;
    level: 'OK' | 'WARNING' | 'EXCEEDED';
    /** False until payments (celek B) feed the counter. */
    tracked: boolean;
  };
}

export interface VatCheckResult {
  id: string;
  countryCode: string;
  vatNumber: string;
  status: 'VALID' | 'INVALID' | 'UNAVAILABLE';
  name: string | null;
  address: string | null;
  requestIdentifier: string | null;
  checkedAt: string;
}

export interface CompanyLookup {
  ico: string;
  name: string;
  vatId: string | null;
  address: { street: string | null; city: string | null; postalCode: string | null; country: string; text: string | null };
}

export interface AdminOverview {
  queues: { payments: number; openTickets: number; staleRegistrations: number };
  last30Days: { newUsers: number; activeLeagues: number; activeTournaments: number };
}

// ============================================================
// REGISTRATIONS
// ============================================================

export type RegistrationKind = 'season' | 'tournament';
export type RegistrationStatus = 'PENDING' | 'WAITLISTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/**
 * Where a competition's places stand: teams in, applications holding a place
 * while they wait for a decision, and the waiting list. `free` is null when
 * the competition has no maximum.
 */
export interface RegistrationCapacity {
  approved: number;
  pending: number;
  waitlisted: number;
  max: number | null;
  free: number | null;
}

/** The form's life as the manager sees it: a draft until first published. */
export type RegistrationLifecycle = 'DRAFT' | 'OPEN' | 'FULL' | 'PAST_DEADLINE' | 'CLOSED';

/** A season or tournament the signed-in user runs, as the dashboard lists it. */
export interface ManagedCompetition {
  kind: RegistrationKind;
  id: string;
  name: string;
  /** League or series. */
  parentName: string;
  lifecycle: RegistrationLifecycle;
  pending: number;
  waitlisted: number;
  /** The competition's applications inbox inside the app. */
  inboxPath: string;
}

/** What the public sign-up form of a season or tournament shows. */
export interface RegistrationForm {
  kind: RegistrationKind;
  id: string;
  name: string;
  parentName: string;
  sport: SportType;
  state: 'OPEN' | 'CLOSED' | 'PAST_DEADLINE';
  deadline: string | null;
  maxTeams: number | null;
  placesTaken: number;
  /** A new application now would join the waiting list. */
  full: boolean;
  capacity: RegistrationCapacity;
  rules: string | null;
  rulesVersion: number;
  fee: string | null;
}

export interface RegistrationSettings {
  open: boolean;
  deadline: string | null;
  maxTeams: number | null;
  rules: string | null;
  rulesVersion: number;
  fee: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  lifecycle: RegistrationLifecycle;
  capacity: RegistrationCapacity;
  /** A tournament's plan and team limit; null for a season. */
  plan: TeamAllowance | null;
  competitionName: string;
}

export type RegistrationSettingsInput = Partial<Pick<RegistrationSettings, 'open' | 'deadline' | 'maxTeams' | 'rules' | 'fee'>>;

export interface RosterEntry {
  name: string;
  number: number | null;
}

export interface Registration {
  id: string;
  status: RegistrationStatus;
  applicantId: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  note: string | null;
  existingTeamId: string | null;
  existingTeam?: { id: string; name: string } | null;
  teamName: string;
  primaryColor: string | null;
  roster: RosterEntry[] | null;
  rulesAcceptedAt: string | null;
  decidedAt: string | null;
  reason: string | null;
  withdrawnAt: string | null;
  promotedAt: string | null;
  promotedBy?: { id: string; name: string } | null;
  /** Moved up from the waiting list ahead of an older application. */
  promotedOutOfOrder: boolean;
  teamId: string | null;
  tournamentTeamId: string | null;
  createdAt: string;
  /** Only in the answer to a tournament submit: the applicant's own status page. */
  statusLink?: string | null;
}

export interface MyRegistration extends Registration {
  competition: { kind: RegistrationKind; id: string; name: string };
}

export interface RegistrationInbox {
  registrations: Registration[];
  capacity: RegistrationCapacity;
}

/** What a tournament applicant's status link shows. */
export interface RegistrationStatusView {
  id: string;
  status: RegistrationStatus;
  teamName: string;
  primaryColor: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  note: string | null;
  roster: RosterEntry[] | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  waitlistPosition: number | null;
  competition: { kind: RegistrationKind; id: string; name: string };
}

/** The admin's view of whether the forms get used. Times are in hours. */
export interface RegistrationFunnel {
  competitions: number;
  published: number;
  publishedWithApplications: number;
  applications: number;
  approvalRate: number | null;
  medianHoursToPublish: number | null;
  medianHoursToFirstApplication: number | null;
}

export interface RegistrationInput {
  clientToken: string;
  teamName?: string;
  existingTeamId?: string;
  primaryColor?: string | null;
  contactName?: string;
  email?: string;
  phone?: string;
  note?: string;
  roster?: RosterEntry[];
  acceptRules?: boolean;
  locale?: string;
  /** Honeypot: left empty by people. */
  website?: string;
}
