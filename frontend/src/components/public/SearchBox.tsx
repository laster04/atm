import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { searchApi } from '@/services/api';
import type { SearchResults } from '@types';

interface SearchBoxProps {
	/** Header search sits on the navy hero on the landing page. */
	tone?: 'light' | 'dark';
	className?: string;
}

const EMPTY: SearchResults = { query: '', teams: [], players: [], seasons: [], leagues: [] };

/**
 * One box over teams, players, seasons and leagues.
 *
 * It is a jump-to, not a report: results appear under the field and each row
 * navigates. Typing is debounced because every keystroke is a round trip, and
 * a request that comes back after a newer one is dropped rather than shown.
 */
export default function SearchBox({ tone = 'light', className = '' }: SearchBoxProps) {
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
			searchApi.search(term)
				.then((res) => {
					if (ticket === latest.current) setResults(res.data);
				})
				.catch((error) => console.error(error));
		}, 250);
		return () => clearTimeout(timer);
	}, [query]);

	// Clicking anywhere else closes the panel; the field keeps what was typed.
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

	const dark = tone === 'dark';
	const hasResults =
		results.teams.length + results.players.length + results.seasons.length + results.leagues.length > 0;
	const tooShort = query.trim().length > 0 && query.trim().length < 2;

	return (
		<div ref={boxRef} className={`relative ${className}`}>
			<div
				className={`flex h-10 items-center gap-2.5 rounded-lg border px-3.5 ${
					dark
						? 'border-white/30 bg-white/10 text-white'
						: 'border-border bg-background text-foreground'
				}`}
			>
				<Search className={`size-4 shrink-0 ${dark ? 'text-white/70' : 'text-muted-foreground'}`} />
				<input
					value={query}
					onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
					onFocus={() => setOpen(true)}
					placeholder={t('public.search.placeholder')}
					aria-label={t('public.search.placeholder')}
					className={`w-full bg-transparent text-sm outline-none ${
						dark ? 'placeholder:text-white/60' : 'placeholder:text-muted-foreground'
					}`}
				/>
				{query && (
					<button
						type="button"
						onClick={() => { setQuery(''); setResults(EMPTY); }}
						aria-label={t('common.close')}
						className={dark ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}
					>
						<X className="size-4" />
					</button>
				)}
			</div>

			{open && query.trim().length > 0 && (
				<div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
					{tooShort && (
						<div className="px-3 py-6 text-center text-sm text-muted-foreground">
							{t('public.search.tooShort')}
						</div>
					)}
					{!tooShort && !hasResults && (
						<div className="px-3 py-6 text-center text-sm text-muted-foreground">
							{t('public.search.noResults', { query: query.trim() })}
						</div>
					)}

					{results.teams.length > 0 && (
						<Group label={t('public.search.teams')}>
							{results.teams.map((team) => (
								<Row key={team.id} onClick={() => go(`/teams/${team.id}`)}>
									<span
										className="size-6 shrink-0 rounded-md"
										style={{ backgroundColor: team.primaryColor || 'rgb(var(--navy))' }}
									/>
									<span className="flex-1 truncate font-medium">{team.name}</span>
									<span className="text-xs text-muted-foreground">
										{t('public.players.count', { count: team._count.players })}
									</span>
								</Row>
							))}
						</Group>
					)}

					{results.players.length > 0 && (
						<Group label={t('public.search.players')}>
							{results.players.map((player) => (
								<Row key={player.id} onClick={() => go(`/players/${player.id}`)}>
									<span
										className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
										style={{ backgroundColor: player.team.primaryColor || 'rgb(var(--navy))' }}
									>
										{player.number ?? '—'}
									</span>
									<span className="flex-1 truncate font-medium">{player.name}</span>
									<span className="truncate text-xs text-muted-foreground">{player.team.name}</span>
								</Row>
							))}
						</Group>
					)}

					{results.seasons.length > 0 && (
						<Group label={t('public.search.seasons')}>
							{results.seasons.map((season) => (
								<Row key={season.id} onClick={() => go(`/season-detail/${season.id}`)}>
									<span className="flex-1 truncate font-medium">{season.name}</span>
									<span className="truncate text-xs text-muted-foreground">{season.league.name}</span>
								</Row>
							))}
						</Group>
					)}

					{results.leagues.length > 0 && (
						<Group label={t('public.search.leagues')}>
							{results.leagues.map((league) => (
								<Row key={league.id} onClick={() => go(`/leagues/${league.id}`)}>
									<span className="flex-1 truncate font-medium">{league.name}</span>
									<span className="text-xs text-muted-foreground">
										{t('public.leagues.seasonCount', { count: league._count.seasons })}
									</span>
								</Row>
							))}
						</Group>
					)}
				</div>
			)}
		</div>
	);
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="py-1">
			<div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
				{label}
			</div>
			<div className="flex flex-col">{children}</div>
		</div>
	);
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
		>
			{children}
		</button>
	);
}
