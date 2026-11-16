import { languageOf } from '../i18n/languages';
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
	/** Help article slugs to read more, linked under the note. */
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

/** Release notes exist in Czech and English; a Slovak reader gets the Czech ones. */
export const updatesLocale = (language: string | undefined): UpdatesLocale =>
	languageOf(language)?.content ?? 'en';

export const RELEASES: ReleaseNote[] = [
	{
		slug: 'stranka-zapasu-turnaje',
		releasedAt: '2026-11-16',
		areas: ['tournaments', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Stránka zápasu i v turnajích',
				summary: 'Každý zápas turnaje má vlastní veřejnou stránku, stejně jako zápasy v lize.',
				items: [
					'Skóre, sety ve volejbale a hráči s góly a asistencemi.',
					'Tabulka skupiny a v play-off kam postoupí vítěz.',
					'Další vzájemné zápasy obou týmů v turnaji.',
					'Stránku otevřete z rozpisu, z tabulky skupiny i z pavouka play-off.',
				],
			},
			en: {
				title: 'A match page for tournaments too',
				summary: 'Every tournament game has its own public page, just like league games.',
				items: [
					'The score, volleyball sets, and players with goals and assists.',
					'The group table, and in the play-off where the winner goes next.',
					'The two teams’ other games against each other in the tournament.',
					'Open it from the schedule, the group table or the play-off bracket.',
				],
			},
		},
	},
	{
		slug: 'slovencina',
		releasedAt: '2026-11-09',
		areas: ['league', 'team', 'tournaments', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'ATM ve slovenštině',
				summary: 'Celou aplikaci teď můžete používat slovensky, včetně e-mailů.',
				items: [
					'Slovenčina v nabídce jazyků v záhlaví i v patičce.',
					'E-maily chodí v jazyce, který máte zvolený v aplikaci.',
					'Widget s tabulkou a zápasy pro web ligy nebo klubu umí i slovensky.',
					'Nápovědu a novinky zatím čtenáři ve slovenštině dostanou česky.',
				],
			},
			en: {
				title: 'ATM in Slovak',
				summary: 'You can now use the whole app in Slovak, e-mails included.',
				items: [
					'Slovenčina in the language menu in the header and footer.',
					'E-mails arrive in the language you chose in the app.',
					'The standings and games widget for a league or club website can show Slovak too.',
					'Slovak readers get help articles and release notes in Czech for now.',
				],
			},
		},
	},
	{
		slug: 'archivni-sezony',
		releasedAt: '2026-10-31',
		areas: ['league', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Archivní sezóny s čísly',
				summary: 'Archivovaná sezóna si nechává počet zápasů a gólů, takže přehled a tabulka neukazují nuly.',
				items: [
					'Přehled, karty sezón a tabulka archivní sezóny ukazují počet odehraných zápasů a gólů.',
					'Seznam sezón se otevře na aktivních sezónách; když žádná neběží, ukáže všechny.',
					'Sezóna bez týmů nemá prázdnou záložku Týmy.',
				],
			},
			en: {
				title: 'Archived seasons keep their numbers',
				summary: 'An archived season keeps its game and goal counts, so the overview and table no longer show zeros.',
				items: [
					'The overview, season cards and table of an archived season show the games played and goals scored.',
					'The seasons list opens on active seasons, or on all of them when none is running.',
					'A season without teams no longer shows an empty Teams tab.',
				],
			},
		},
	},
	{
		slug: 'shoda-vysledku-a-zapisovatel',
		releasedAt: '2026-10-28',
		areas: ['league', 'team', 'tournaments'],
		docs: [],
		content: {
			cs: {
				title: 'Shoda výsledků a odkaz pro zapisovatele',
				summary: 'Když oba týmy nahlásí stejný výsledek, zápas se potvrdí sám. Výsledek může zapsat i člověk bez účtu přes odkaz.',
				items: [
					'Správce sezóny může v nastavení zapnout, že shodný výsledek od obou týmů se potvrdí automaticky.',
					'Správce sezóny vytvoří k zápasu odkaz pro zapisovatele, který nemá účet v ATM.',
					'Placené turnaje: jeden odkaz pro každé hřiště. Dobrovolník zapisuje góly se střelcem a asistencí nebo sety a ukončí zápas.',
					'Ukončený zápas na odkazu posune tabulku i pavouka play-off stejně jako zápis organizátora.',
				],
			},
			en: {
				title: 'Result agreement and scorer links',
				summary: 'When both teams report the same result, the game confirms itself. Someone without an account can record a result through a link.',
				items: [
					'In the season settings, the season manager can let a matching result from both teams confirm automatically.',
					'The season manager creates a scorer link for a game, for someone without an ATM account.',
					'Paid tournaments: one link per court. A volunteer records goals with scorer and assist, or sets, and ends the game.',
					'A game ended through the link moves the table and the play-off bracket on, as the organiser’s form does.',
				],
			},
		},
	},
	{
		slug: 'prihlaseni-pres-google',
		releasedAt: '2026-10-26',
		areas: ['league', 'team', 'tournaments'],
		docs: ['ucet-a-prihlaseni'],
		content: {
			cs: {
				title: 'Přihlášení přes Google',
				summary: 'Do ATM se zaregistrujete i přihlásíte jedním kliknutím přes účet Google.',
				items: [
					'Tlačítko Google na stránce přihlášení i registrace.',
					'Máte už účet se stejným e-mailem? Google se k němu připojí a vše zůstane, jak bylo.',
					'Účet z Google má e-mail ověřený hned, bez aktivačního odkazu.',
				],
			},
			en: {
				title: 'Sign in with Google',
				summary: 'Sign up and sign in to ATM with one click using your Google account.',
				items: [
					'A Google button on the sign-in and sign-up pages.',
					'Already have an account with the same e-mail? Google joins it and everything stays as it was.',
					'An account from Google has its e-mail verified at once, with no activation link.',
				],
			},
		},
	},
	{
		slug: 'plany-turnaju-a-turnaj-plus',
		releasedAt: '2026-10-25',
		areas: ['tournaments', 'public'],
		docs: ['plany-turnaju'],
		content: {
			cs: {
				title: 'Plány turnajů a Turnaj Plus',
				summary: 'Malý turnaj zůstává zdarma. Pro víc týmů se plán turnaje zaplatí QR převodem a Turnaj Plus přidá partnery, dokumenty a stránku bez výrazné značky ATM.',
				items: [
					'Plán turnaje s limitem týmů; navýšení a QR platba přímo ve správě turnaje, daňový doklad e-mailem.',
					'Roční plán Organizátor pro všechny turnaje série.',
					'Turnaj Plus: loga partnerů na stránce turnaje a na plakátu přihlášek.',
					'Turnaj Plus: propozice a pravidla v PDF ke stažení.',
					'Turnaj Plus: stránka turnaje, přihláška a e-maily jen s malým odkazem „Běží na ATM“.',
				],
			},
			en: {
				title: 'Tournament plans and Tournament Plus',
				summary: 'A small tournament stays free. For more teams the tournament’s plan is paid by QR transfer, and Tournament Plus adds partners, documents and a page without the prominent ATM brand.',
				items: [
					'A tournament plan with a team limit; upgrading and QR payment right in tournament management, the tax document by e-mail.',
					'A yearly Organiser plan for every tournament of a series.',
					'Tournament Plus: partner logos on the tournament page and the sign-up poster.',
					'Tournament Plus: rules and propositions as downloadable PDFs.',
					'Tournament Plus: the tournament page, sign-up form and e-mails with only a small “Powered by ATM” link.',
				],
			},
		},
	},
	{
		slug: 'stranka-zapasu',
		releasedAt: '2026-10-24',
		areas: ['league', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Veřejná stránka zápasu',
				summary: 'Každý odehraný zápas sezóny má vlastní stránku, kterou můžete sdílet.',
				items: [
					'Oba týmy s místem v tabulce, skóre i po třetinách, datum a místo.',
					'Průběh zápasu po třetinách: góly s asistencemi, tresty, karty a střídání brankářů.',
					'Hráči, kteří se v zápase zapsali, ve sloupcích podle sportu.',
					'Tabulka kolem obou týmů a jejich další zápasy v sezóně.',
					'Dokud správce sezóny výsledek nepotvrdí, stránka to ukáže a tabulka ho nepočítá.',
				],
			},
			en: {
				title: 'A public match page',
				summary: 'Every played season game has its own page you can share.',
				items: [
					'Both teams with their place in the table, the score with each period, the date and the venue.',
					'The game period by period: goals with assists, penalties, cards and goalie changes.',
					'Players who made the score sheet, in the sport’s own columns.',
					'The table around both teams and their other games this season.',
					'Until the season manager confirms the result, the page says so and the table leaves it out.',
				],
			},
		},
	},
	{
		slug: 'volejbal-podle-pravidel-svazu',
		releasedAt: '2026-10-24',
		areas: ['league', 'tournaments', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Volejbal podle pravidel svazu',
				summary: 'Volejbalové ligy a turnaje počítají body a pořadí podle Soutěžního řádu volejbalu.',
				items: [
					'Za 3:0 a 3:1 tři body, za 3:2 dva, za 2:3 jeden.',
					'Při rovnosti bodů rozhodují výhry, poměr setů, poměr míčů a vzájemný zápas.',
					'Tabulka ukazuje sloupce V3, V2, P1, P0, sety a míče, i ve widgetu na web.',
					'Sety jdou zapsat i v turnajích, s formátem na 3 nebo 2 vítězné sety, nebo dva sety s možnou remízou.',
				],
			},
			en: {
				title: 'Volleyball by the federation rules',
				summary: 'Volleyball leagues and tournaments score and rank teams by the Czech volleyball federation’s rules.',
				items: [
					'3:0 and 3:1 earn three points, 3:2 two, 2:3 one.',
					'Teams level on points are split by wins, set ratio, ball ratio and the game between them.',
					'The table shows the federation’s columns with sets and balls, in the website widget too.',
					'Sets can be recorded in tournaments too: best of five, best of three, or two sets with a possible draw.',
				],
			},
		},
	},
	{
		slug: 'widget-na-web',
		releasedAt: '2026-10-23',
		areas: ['league', 'team', 'tournaments', 'public'],
		docs: ['vlozeni-na-web'],
		content: {
			cs: {
				title: 'Tabulka a zápasy na vašem webu',
				summary: 'Tabulku nebo nadcházející zápasy sezóny, turnaje či jednoho týmu vložíte na web klubu nebo ligy jedním řádkem kódu.',
				items: [
					'Panel „Vložit na web“ ve správě sezóny, turnaje a v nastavení týmu, s náhledem a kopírováním kódu.',
					'Volba počtu řádků, světlého nebo tmavého vzhledu, barvy a jazyka.',
					'Bez přihlášení a bez cookies; ukazuje vždy aktuální výsledky z ATM.',
					'Widget je zdarma s odkazem „Výsledky z ATM“; Turnaj Plus a Organizátor ho můžou skrýt.',
				],
			},
			en: {
				title: 'Your table and games on your website',
				summary: 'Put the table or upcoming games of a season, tournament or one team on a club or league website with one line of code.',
				items: [
					'An “Embed on a website” panel in season and tournament management and in team settings, with a preview and copy button.',
					'Choose the number of rows, a light or dark look, the colour and the language.',
					'No sign-in and no cookies; it always shows the current results from ATM.',
					'The widget is free with a “Results from ATM” link; Tournament Plus and Organiser can hide it.',
				],
			},
		},
	},
	{
		slug: 'prihlasky-tymu',
		releasedAt: '2026-10-17',
		areas: ['league', 'tournaments', 'public'],
		docs: ['prihlasky-tymu'],
		content: {
			cs: {
				title: 'Přihlášky týmů do sezóny a turnaje',
				summary: 'Týmy se do sezóny nebo turnaje přihlásí přes veřejný formulář. Organizátor nastaví pravidla, uzávěrku a kapacitu a přihlášky schvaluje na jednom místě.',
				items: [
					'Formulář si před zveřejněním prohlédnete v náhledu a zveřejníte ho jedním tlačítkem.',
					'Odkaz pošlete přes WhatsApp nebo e-mail, nebo vytiskněte plakát s QR kódem.',
					'Když je plno, další přihlášky čekají na čekací listině. Uvolněné místo nabídnete dalšímu v pořadí.',
					'Tým bez účtu dostane odkaz, kde vidí stav přihlášky a může ji stáhnout.',
					'Na veřejných stránkách je vidět, které soutěže právě přijímají přihlášky.',
				],
			},
			en: {
				title: 'Team applications for seasons and tournaments',
				summary: 'Teams apply to a season or tournament through a public form. The organiser sets the rules, deadline and capacity, and approves applications in one inbox.',
				items: [
					'Preview the form before publishing it, then publish it with one button.',
					'Share the link by WhatsApp or email, or print a poster with a QR code.',
					'Once the competition is full, new applications join a waiting list. Offer a freed place to the next team in line.',
					'A team without an account gets a link where it can check the application and withdraw it.',
					'Public pages show which competitions are taking applications right now.',
				],
			},
		},
	},
	{
		slug: 'statistiky-podle-sportu',
		releasedAt: '2026-10-17',
		areas: ['league', 'team', 'public'],
		docs: ['vysledky-a-statistiky'],
		content: {
			cs: {
				title: 'Statistiky podle sportu',
				summary: 'Každý sport zapisuje svá čísla, nejen hokejové góly, asistence a trestné minuty.',
				items: [
					'Fotbal: góly, asistence, žluté a červené karty a dva poločasy.',
					'Florbal jako hokej, basketbal s body, fauly a čtvrtinami.',
					'Volejbal po setech; výsledek zápasu se spočítá ze setů.',
					'Ligy fotbalu, florbalu, basketbalu a volejbalu jde nově založit.',
				],
			},
			en: {
				title: 'Statistics by sport',
				summary: 'Each sport records its own numbers, not just hockey goals, assists and penalty minutes.',
				items: [
					'Football: goals, assists, yellow and red cards, and two halves.',
					'Floorball as hockey; basketball with points, fouls and quarters.',
					'Volleyball by sets; the game result is worked out from them.',
					'Football, floorball, basketball and volleyball leagues can now be created.',
				],
			},
		},
	},
	{
		slug: 'play-off-v-sezone',
		releasedAt: '2026-10-16',
		areas: ['league', 'public'],
		docs: [],
		content: {
			cs: {
				title: 'Play-off v sezóně',
				summary: 'Sezóna může skončit play-off. Pavouk se plní sám podle potvrzených výsledků.',
				items: [
					'Správce sezóny zvolí, kolik týmů z tabulky postoupí (2 až 16), na kolik vítězných zápasů se hraje a jestli je zápas o třetí místo.',
					'Nejlépe nasazené týmy mají volný los, když počet týmů není mocnina dvou.',
					'Pavouka jde vylosovat kdykoli; místo týmů ukazuje nasazení, dokud základní část neskončí.',
					'Rozhodující zápas série se přidá, jen když je potřeba, a vítěz postoupí sám.',
				],
			},
			en: {
				title: 'Play-off in a season',
				summary: 'A season can finish with a play-off. The bracket fills itself from confirmed results.',
				items: [
					'The season manager picks how many teams of the table go through (2 to 16), how many wins a series takes, and whether there is a third-place game.',
					'The top seeds get a bye when the team count is not a power of two.',
					'The bracket can be drawn at any time; seeds stand in for teams until the regular season ends.',
					'A deciding game is added only when a series needs it, and the winner moves on by itself.',
				],
			},
		},
	},
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
		id: 'league-plan',
		status: 'IN_DEVELOPMENT',
		areas: ['league'],
		content: {
			cs: { title: 'Plán Liga', summary: 'První liga a její první sezóna zdarma, potom roční plán za ligu s platbou QR převodem.' },
			en: { title: 'League plan', summary: 'Your first league and its first season free, then a yearly plan per league, paid by QR transfer.' },
		},
	},
	{
		id: 'more-languages',
		status: 'IN_DEVELOPMENT',
		areas: ['league', 'team', 'tournaments', 'public'],
		content: {
			cs: { title: 'Polština a němčina', summary: 'Aplikace a e-maily v dalších dvou jazycích.' },
			en: { title: 'Polish and German', summary: 'The app and its e-mails in two more languages.' },
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
		id: 'context-switcher',
		status: 'DESIGNING',
		areas: ['league', 'team'],
		content: {
			cs: { title: 'Přepínání kontextu', summary: 'Přechod mezi spravovanou ligou, týmem a sezónou na jednom místě.' },
			en: { title: 'Switching context', summary: 'Move between the league, team and season you manage from one place.' },
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
