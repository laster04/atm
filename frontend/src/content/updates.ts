/**
 * What changed in ATM and what is coming. Kept in the repository and added in
 * the same change as the feature it describes, so a release note never runs
 * ahead of what is deployed.
 *
 * Rules (docs/tier4/04_UPDATES_CONTACT_SPEC.md):
 * - a release note lists only what users can see or do differently;
 * - the roadmap never gives a date or a percentage, and never lists something
 *   already released.
 */

export type UpdatesLocale = 'cs' | 'en';

export type UpdatesArea = 'league' | 'team' | 'tournaments' | 'public' | 'fixes';

export interface ReleaseNote {
	slug: string;
	/** YYYY-MM-DD, the day it reached production. */
	releasedAt: string;
	areas: UpdatesArea[];
	/**
	 * Help article slugs to read more. Left empty until /docs is released;
	 * then fill in and render the links.
	 */
	docs: string[];
	content: Record<UpdatesLocale, { title: string; summary: string; items: string[] }>;
}

export type RoadmapStatus = 'IN_DEVELOPMENT' | 'DESIGNING' | 'CONSIDERING';

export interface RoadmapItem {
	id: string;
	status: RoadmapStatus;
	areas: UpdatesArea[];
	content: Record<UpdatesLocale, { title: string; summary: string }>;
}

export const updatesLocale = (language: string | undefined): UpdatesLocale =>
	language?.toLowerCase().startsWith('cs') ? 'cs' : 'en';

export const RELEASES: ReleaseNote[] = [
	{
		slug: 'skupiny-a-potvrzene-vysledky',
		releasedAt: '2026-09-14',
		areas: ['league', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Skupiny v sezóně a potvrzené výsledky',
				summary: 'Sezónu lze rozdělit do skupin a tabulka počítá jen potvrzené výsledky.',
				items: [
					'Každá skupina má vlastní tabulku a rozpis lze vygenerovat jen v rámci skupin.',
					'Do tabulky se započítá až potvrzený zápis o utkání.',
					'Ligy, sezóny a série turnajů lze zveřejnit, nechat jen pro ty, kdo mají odkaz, nebo skrýt.',
					'Veřejný profil hráče ukazuje jen jméno a číslo dresu.',
				],
			},
			en: {
				title: 'Season divisions and confirmed results',
				summary: 'A season can be split into divisions, and tables count only confirmed results.',
				items: [
					'Each division has its own table, and the schedule can be generated within divisions.',
					'A result counts in the table only once its match report is confirmed.',
					'Leagues, seasons and tournament series can be published, shared by link only, or hidden.',
					'A public player profile shows only the name and shirt number.',
				],
			},
		},
	},
	{
		slug: 'kalendar-a-potvrzeni-zapisu',
		releasedAt: '2026-09-13',
		areas: ['team', 'league'],
		docs: [],
		content: {
			cs: {
				title: 'Týmový kalendář a potvrzení zápisu',
				summary: 'Týmy plánují tréninky s docházkou a výsledky mají uzavřený zápis s historií.',
				items: [
					'Kalendář týmu s tréninky, schůzkami a odpověďmi Přijdu, Nepřijdu, Možná.',
					'Zápas s termínem se objeví v kalendáři obou týmů.',
					'Potvrzený zápis nelze měnit bez znovuotevření s uvedením důvodu.',
					'Souhrn kola lze poslat e-mailem všem v sezóně.',
				],
			},
			en: {
				title: 'Team calendar and confirmed match reports',
				summary: 'Teams plan training with attendance, and results get a closed report with history.',
				items: [
					'A team calendar with training, meetings and Attending, Not attending, Maybe answers.',
					'A game with a date appears in both teams’ calendars.',
					'A confirmed report cannot change unless it is reopened with a reason.',
					'A round summary can be emailed to everyone in the season.',
				],
			},
		},
	},
	{
		slug: 'zapis-o-utkani-a-bodovani',
		releasedAt: '2026-09-12',
		areas: ['league', 'team'],
		docs: [],
		content: {
			cs: {
				title: 'Zápis o utkání a nastavitelné bodování',
				summary: 'Skóre a statistiky se počítají z událostí zápasu a bodování lze nastavit pro ligu i sezónu.',
				items: [
					'Góly a tresty se zapisují jako události, skóre se dopočítá.',
					'Body za výhru a remízu podle nastavení ligy nebo sezóny.',
					'Hráče v soupisce lze propojit s uživatelským účtem.',
				],
			},
			en: {
				title: 'Match reports and configurable scoring',
				summary: 'Scores and statistics come from game events, and scoring can be set per league and season.',
				items: [
					'Goals and penalties are recorded as events; the score adds itself up.',
					'Points for a win and a draw follow the league or season settings.',
					'Players on a roster can be linked to a user account.',
				],
			},
		},
	},
];

export const ROADMAP: RoadmapItem[] = [
	{
		id: 'game-times',
		status: 'IN_DEVELOPMENT',
		areas: ['league', 'public'],
		content: {
			cs: { title: 'Stejný čas zápasů všude', summary: 'Veřejná část i správa ukážou u zápasu stejný místní čas.' },
			en: { title: 'The same game time everywhere', summary: 'Public pages and management show a game at the same local time.' },
		},
	},
	{
		id: 'team-mobile',
		status: 'DESIGNING',
		areas: ['team'],
		content: {
			cs: { title: 'Mobilní správa týmu', summary: 'Přehled, samostatná sestava a zápis o utkání navržené pro telefon.' },
			en: { title: 'Team management on the phone', summary: 'An overview, a separate line-up and a match report designed for phones.' },
		},
	},
	{
		id: 'team-match-report',
		status: 'DESIGNING',
		areas: ['team', 'league'],
		content: {
			cs: { title: 'Zápis o utkání od obou týmů', summary: 'Každý tým zapíše své góly, asistence a tresty, manažer ligy zápis potvrdí.' },
			en: { title: 'Match reports from both teams', summary: 'Each team records its own goals, assists and penalties; the league manager confirms.' },
		},
	},
	{
		id: 'context-switcher',
		status: 'DESIGNING',
		areas: ['league', 'team'],
		content: {
			cs: { title: 'Přepínání kontextu', summary: 'Přechod mezi spravovanou ligou, týmem a sezónou na jednom místě.' },
			en: { title: 'Switching context', summary: 'Move between the league, team and season you manage from one place.' },
		},
	},
	{
		id: 'league-playoffs',
		status: 'CONSIDERING',
		areas: ['league'],
		content: {
			cs: { title: 'Playoff v ligách', summary: 'Vyřazovací část navazující na základní část sezóny.' },
			en: { title: 'League playoffs', summary: 'A knockout stage following the regular season.' },
		},
	},
];

/** The newest release date, for the unread marker. */
export const LATEST_RELEASE_AT = RELEASES.map((release) => release.releasedAt).sort().pop() ?? null;

/** True when a release came out after the user last opened /updates. */
export const hasUnreadUpdates = (updatesSeenAt: string | null | undefined): boolean => {
	if (!LATEST_RELEASE_AT) return false;
	if (!updatesSeenAt) return true;
	return LATEST_RELEASE_AT > updatesSeenAt.slice(0, 10);
};
