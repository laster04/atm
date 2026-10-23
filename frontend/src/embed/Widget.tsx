import { useEffect, useState } from 'react';
import atmMark from './atm-mark.png';

export interface WidgetOptions {
	kind: 'season' | 'tournament';
	id: string;
	view: 'standings' | 'games';
	lang: 'cs' | 'en';
	/** Rows of the table, or games per list; null = the whole table, 5 games. */
	rows: number | null;
	/** Highlights this team in the table, keeps only its games in the list. */
	team: string | null;
	/** A division or group id, or "total" for the whole season. */
	group: string | null;
	results: boolean;
	logos: boolean;
	/** Honoured only for a plan that allows it (Turnaj Plus, Organizátor). */
	hideBrand: boolean;
}

interface Team { id: string; name: string; logo: string | null; color: string | null }
interface Row { rank: number; team: Team; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number }
interface Game {
	id: string; date: string | null; location: string | null; round: number | null; phase: string | null; status: string;
	home: Team | null; away: Team | null; homeScore: number | null; awayScore: number | null;
}
interface Competition { kind: 'season' | 'tournament'; id: string; name: string; parentName: string; canHideBrand: boolean }
interface Data {
	competition: Competition;
	tables?: { group: { id: string; name: string } | null; rows: Row[] }[];
	upcoming?: Game[];
	recent?: Game[];
}

type Texts = Record<string, unknown>;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Only the chosen language's file is loaded; the widget reads its `embed` section. */
const loadTexts = (lang: 'cs' | 'en') =>
	(lang === 'en' ? import('../i18n/locales/en.json') : import('../i18n/locales/cs.json'))
		.then((module) => (module.default as { embed: Texts }).embed);

/** `t('columns.points')` with `{{name}}` placeholders, like i18next, without its weight. */
const translator = (texts: Texts) => (key: string, vars: Record<string, string | number> = {}) => {
	const value = key.split('.').reduce<unknown>((node, part) => (node as Texts | undefined)?.[part], texts);
	return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? '')) : key;
};

/** The host name of the page the widget sits on, for counting where it is used. */
const embeddingSite = () => {
	try {
		return document.referrer ? new URL(document.referrer).hostname : '';
	} catch {
		return '';
	}
};

export default function Widget({ options }: { options: WidgetOptions | null }) {
	const [texts, setTexts] = useState<Texts | null>(null);
	const [data, setData] = useState<Data | null | 'unavailable'>(null);

	useEffect(() => {
		loadTexts(options?.lang ?? 'cs').then(setTexts).catch(() => setTexts({}));
	}, [options?.lang]);

	useEffect(() => {
		if (!options) { setData('unavailable'); return; }
		const query = new URLSearchParams({ count: '1', site: embeddingSite() });
		if (options.view === 'games') {
			query.set('rows', String(options.rows ?? 5));
			if (options.results) query.set('results', '1');
			if (options.team) query.set('team', options.team);
		}
		if (options.group) query.set('group', options.group);
		fetch(`${API_URL}/embed/${options.kind}/${encodeURIComponent(options.id)}/${options.view}?${query}`, { credentials: 'omit' })
			.then((res) => (res.ok ? res.json() : 'unavailable'))
			.then(setData)
			.catch(() => setData('unavailable'));
	}, [options]);

	if (!texts || data === null) return <div className="w" aria-busy="true" />;
	const t = translator(texts);
	if (data === 'unavailable' || !options) return <div className="w"><p className="note">{t('unavailable')}</p></div>;

	const { competition } = data;
	const showBrand = !(options.hideBrand && competition.canHideBrand);
	const publicPath = competition.kind === 'season' ? `/season-detail/${competition.id}` : `/tournament/${competition.id}`;
	const link = `${window.location.origin}${publicPath}?utm_source=embed&utm_medium=widget&utm_campaign=${encodeURIComponent(competition.id)}`;

	return (
		<div className="w">
			<h1>
				{competition.name}
				<small>{competition.parentName}</small>
			</h1>
			{options.view === 'standings'
				? <Standings data={data} options={options} t={t} />
				: <Games data={data} options={options} t={t} />}
			{showBrand && (
				<p className="brand">
					<a href={link} target="_blank" rel="noopener">
						{t('brand.before')}<b>ATM</b>
						<img src={atmMark} alt="" width={25} height={20} />
					</a>
				</p>
			)}
		</div>
	);
}

type T = ReturnType<typeof translator>;

function TeamName({ team, logos, fallback }: { team: Team | null; logos: boolean; fallback: string }) {
	return (
		<span className="name">
			{logos && team && (team.logo
				? <img className="crest" src={team.logo} alt="" loading="lazy" />
				: <span className="crest" style={{ background: team.color ?? undefined }} aria-hidden="true" />)}
			<span>{team?.name ?? fallback}</span>
		</span>
	);
}

function Standings({ data, options, t }: { data: Data; options: WidgetOptions; t: T }) {
	const tables = data.tables ?? [];
	if (tables.every((table) => table.rows.length === 0)) return <p className="note">{t('noTable')}</p>;
	return (
		<>
			{tables.map((table) => {
				// With a row limit, a highlighted team further down still shows, under the top rows.
				let rows = options.rows ? table.rows.slice(0, options.rows) : table.rows;
				const mine = options.team ? table.rows.find((row) => row.team.id === options.team) : undefined;
				if (mine && !rows.includes(mine)) rows = [...rows.slice(0, -1), mine];
				return (
					<table key={table.group?.id ?? 'all'}>
						<caption>{table.group ? table.group.name : t('standings')}</caption>
						<thead>
							<tr>
								<th scope="col"><abbr title={t('columns.rankLong')}>#</abbr></th>
								<th scope="col" className="team">{t('columns.team')}</th>
								<th scope="col"><abbr title={t('columns.playedLong')}>{t('columns.played')}</abbr></th>
								<th scope="col" className="wide"><abbr title={t('columns.winsLong')}>{t('columns.wins')}</abbr></th>
								<th scope="col" className="wide"><abbr title={t('columns.drawsLong')}>{t('columns.draws')}</abbr></th>
								<th scope="col" className="wide"><abbr title={t('columns.lossesLong')}>{t('columns.losses')}</abbr></th>
								<th scope="col" className="mid-col"><abbr title={t('columns.scoreLong')}>{t('columns.score')}</abbr></th>
								<th scope="col"><abbr title={t('columns.pointsLong')}>{t('columns.points')}</abbr></th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.team.id} className={row.team.id === options.team ? 'mine' : undefined}>
									<td className="rank">{row.rank}.</td>
									<th scope="row" className="team">
										<TeamName team={row.team} logos={options.logos} fallback="" />
									</th>
									<td>{row.played}</td>
									<td className="wide">{row.wins}</td>
									<td className="wide">{row.draws}</td>
									<td className="wide">{row.losses}</td>
									<td className="mid-col">{row.goalsFor}:{row.goalsAgainst}</td>
									<td className="points">{row.points}</td>
								</tr>
							))}
						</tbody>
					</table>
				);
			})}
		</>
	);
}

function Games({ data, options, t }: { data: Data; options: WidgetOptions; t: T }) {
	const locale = options.lang === 'en' ? 'en-GB' : 'cs-CZ';
	const when = (date: string | null) => date
		? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' }).format(new Date(date))
		: t('dateTbd');
	const label = (game: Game) => [
		game.phase && game.phase !== 'GROUP' ? t(`phases.${game.phase}`) : game.round ? t('round', { n: game.round }) : null,
		game.location,
		game.status === 'POSTPONED' ? t('postponed') : game.status === 'IN_PROGRESS' ? t('live') : null,
	].filter(Boolean).join(' · ');

	const list = (games: Game[], scored: boolean) => (
		<ul className="games">
			{games.map((game) => {
				const mine = options.team && (game.home?.id === options.team || game.away?.id === options.team);
				return (
					<li key={game.id} className={mine ? 'mine' : undefined}>
						<span className="home"><TeamName team={game.home} logos={options.logos} fallback={t('tbd')} /></span>
						<span className="mid">
							{scored
								? <span className="score">{game.homeScore}:{game.awayScore}</span>
								: <span className="when">{when(game.date)}</span>}
						</span>
						<span className="away"><TeamName team={game.away} logos={options.logos} fallback={t('tbd')} /></span>
						{(label(game) || scored) && <span className="meta">{scored ? [when(game.date), label(game)].filter(Boolean).join(' · ') : label(game)}</span>}
					</li>
				);
			})}
		</ul>
	);

	const upcoming = data.upcoming ?? [];
	const recent = data.recent ?? [];
	return (
		<>
			<section aria-label={t('upcoming')}>
				<h2>{t('upcoming')}</h2>
				{upcoming.length ? list(upcoming, false) : <p className="note">{t('noUpcoming')}</p>}
			</section>
			{options.results && (
				<section aria-label={t('recent')}>
					<h2>{t('recent')}</h2>
					{recent.length ? list(recent, true) : <p className="note">{t('noRecent')}</p>}
				</section>
			)}
		</>
	);
}
