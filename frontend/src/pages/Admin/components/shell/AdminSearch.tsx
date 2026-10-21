import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { searchApi } from '@/services/api';
import type { SearchResults } from '@types';

const EMPTY: SearchResults = { query: '', teams: [], players: [], seasons: [], leagues: [], users: [], tournaments: [] };

/**
 * The top bar's search over the whole administration: accounts by name or
 * email, leagues, seasons, tournaments, teams and players. Each hit opens its
 * admin screen, or the manager screen where the admin one is not built yet.
 */
export default function AdminSearch() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResults>(EMPTY);
	const [open, setOpen] = useState(false);
	const boxRef = useRef<HTMLDivElement>(null);
	const latest = useRef(0);

	useEffect(() => {
		const term = query.trim();
		if (term.length < 2) {
			setResults(EMPTY);
			return;
		}
		const ticket = ++latest.current;
		const timer = setTimeout(() => {
			searchApi.search(term, 5)
				.then((res) => {
					if (ticket === latest.current) setResults(res.data);
				})
				.catch((error) => console.error(error));
		}, 250);
		return () => clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener('mousedown', onPointerDown);
		return () => document.removeEventListener('mousedown', onPointerDown);
	}, []);

	const go = (to: string) => {
		setOpen(false);
		setQuery('');
		navigate(to);
	};

	const users = results.users ?? [];
	const tournaments = results.tournaments ?? [];
	const count = users.length + results.leagues.length + results.seasons.length + tournaments.length + results.teams.length + results.players.length;
	const term = query.trim();

	return (
		<div ref={boxRef} className="relative min-w-0 flex-[1_1_320px] lg:max-w-[560px]" onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
			<label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
				{t('adminShell.search.label')}
				<span className="flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3">
					<Search className="size-4 shrink-0" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
						onFocus={() => setOpen(true)}
						placeholder={t('adminShell.search.placeholder')}
						className="w-full bg-transparent text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</span>
			</label>

			{open && term.length > 0 && (
				<div className="absolute left-0 right-0 top-[4.25rem] z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
					{term.length < 2 ? (
						<p className="px-3 py-5 text-center text-sm text-muted-foreground">{t('public.search.tooShort')}</p>
					) : count === 0 ? (
						<p className="px-3 py-5 text-center text-sm text-muted-foreground">{t('public.search.noResults', { query: term })}</p>
					) : (
						<>
							<Group label={t('adminShell.search.users')} show={users.length > 0}>
								{users.map((user) => (
									<Row key={user.id} onClick={() => go(`/admin/users?open=${user.id}`)} title={user.name} meta={user.email} />
								))}
							</Group>
							<Group label={t('public.search.leagues')} show={results.leagues.length > 0}>
								{results.leagues.map((league) => (
									<Row key={league.id} onClick={() => go(`/admin/seasons?leagueId=${league.id}`)} title={league.name} meta={t(`sports.${league.sportType}`)} />
								))}
							</Group>
							<Group label={t('public.search.seasons')} show={results.seasons.length > 0}>
								{results.seasons.map((season) => (
									<Row key={season.id} onClick={() => go(`/season-management/${season.id}`)} title={season.name} meta={season.league.name} />
								))}
							</Group>
							<Group label={t('adminShell.search.tournaments')} show={tournaments.length > 0}>
								{tournaments.map((tournament) => (
									<Row key={tournament.id} onClick={() => go(`/tournament-management/tournament/${tournament.id}`)} title={tournament.name} meta={tournament.series.name} />
								))}
							</Group>
							<Group label={t('public.search.teams')} show={results.teams.length > 0}>
								{results.teams.map((team) => (
									<Row key={team.id} onClick={() => go(`/team-management/${team.id}`)} title={team.name} meta={t('public.players.count', { count: team._count.players })} />
								))}
							</Group>
							<Group label={t('public.search.players')} show={results.players.length > 0}>
								{results.players.map((player) => (
									<Row key={player.id} onClick={() => go(`/admin/players/${player.id}`)} title={player.name} meta={player.team.name} />
								))}
							</Group>
						</>
					)}
				</div>
			)}
		</div>
	);
}

function Group({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
	if (!show) return null;
	return (
		<div className="py-1">
			<div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
			<div className="flex flex-col">{children}</div>
		</div>
	);
}

function Row({ onClick, title, meta }: { onClick: () => void; title: string; meta: string }) {
	return (
		<button type="button" onClick={onClick} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
			<span className="flex-1 truncate font-medium">{title}</span>
			<span className="truncate text-xs text-muted-foreground">{meta}</span>
		</button>
	);
}
