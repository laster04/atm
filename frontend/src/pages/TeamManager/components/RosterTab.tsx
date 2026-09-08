import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { gameStatisticApi } from '@/services/api';
import type { Player } from '@types';

type SortKey = 'number' | 'name' | 'points' | 'penaltyMinutes';

interface RosterTabProps {
	players: Player[];
	teamId: number;
	teamColor?: string | null;
	seasonId?: number;
}

export default function RosterTab({
	players,
	teamId,
	teamColor,
	seasonId,
}: RosterTabProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const [query, setQuery] = useState('');
	const [sort, setSort] = useState<SortKey>('number');
	const [stats, setStats] = useState<Record<number, { points: number; penaltyMinutes: number }>>({});

	const color = teamColor || '#003E7E';

	useEffect(() => {
		if (!seasonId) {
			setStats({});
			return;
		}
		let cancelled = false;
		gameStatisticApi.getScorersBySeasonAndTeam(seasonId, teamId)
			.then((res) => {
				if (cancelled) return;
				const next: Record<number, { points: number; penaltyMinutes: number }> = {};
				res.data.forEach((scorer) => {
					next[scorer.player.id] = {
						points: scorer.points,
						penaltyMinutes: scorer.penaltyMinutes ?? 0,
					};
				});
				setStats(next);
			})
			.catch((err) => console.error('Failed to fetch team scorers:', err));
		return () => { cancelled = true; };
	}, [seasonId, teamId]);

	const visible = useMemo(() => {
		const needle = query.trim().toLocaleLowerCase();
		const filtered = needle
			? players.filter((p) => p.name.toLocaleLowerCase().includes(needle)
				|| String(p.number ?? '').includes(needle))
			: players;

		return [...filtered].sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'points') return (stats[b.id]?.points ?? 0) - (stats[a.id]?.points ?? 0);
			if (sort === 'penaltyMinutes') return (stats[b.id]?.penaltyMinutes ?? 0) - (stats[a.id]?.penaltyMinutes ?? 0);
			// Players without a number sort last rather than as number 0.
			if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
			if (a.number == null) return 1;
			if (b.number == null) return -1;
			return a.number - b.number;
		});
	}, [players, query, sort, stats]);

	const sortOptions: { key: SortKey; label: string }[] = [
		{ key: 'number', label: t('teamManagement.pwa.sortNumber') },
		{ key: 'name', label: t('common.name') },
		{ key: 'points', label: t('teamManagement.pwa.points') },
		{ key: 'penaltyMinutes', label: t('teamManagement.gameStats.penaltyMinutesShort') },
	];

	const describe = (player: Player) => {
		const parts = [player.position, player.bornYear ? String(player.bornYear) : null]
			.filter(Boolean);
		return parts.length ? parts.join(' · ') : t('teamManagement.pwa.noPosition');
	};

	return (
		<div className="-mx-4 lg:mx-0">
			<div className="tm-toolbar flex-col items-stretch gap-2 lg:rounded-t-xl lg:border lg:border-b-0">
				<label className="tm-search">
					<Search className="size-4 text-muted-foreground shrink-0" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('teamManagement.pwa.searchPlayers')}
						aria-label={t('teamManagement.pwa.searchPlayers')}
					/>
				</label>
				<div className="flex items-center gap-2">
					{/* Four pills exceed 390px, so the strip scrolls and the count stays put. */}
					<div className="tm-pill-strip">
						{sortOptions.map((option) => (
							<button
								key={option.key}
								type="button"
								aria-pressed={sort === option.key}
								onClick={() => setSort(option.key)}
								className="tm-sort-pill"
								style={sort === option.key ? { backgroundColor: color } : undefined}
							>
								{option.label}
							</button>
						))}
					</div>
					<span className="shrink-0 text-xs text-muted-foreground">
						{t('teamManagement.pwa.playerCount', { count: visible.length })}
					</span>
				</div>
			</div>

			{visible.length > 0 ? (
				<div className="bg-card lg:rounded-b-xl lg:border lg:border-t-0 lg:overflow-hidden">
					{visible.map((player) => (
						<button
							key={player.id}
							type="button"
							className="tm-player-row"
							onClick={() => navigate(`/team-management/${teamId}/player/${player.id}`)}
						>
							<span
								className={`tm-player-number ${player.number == null ? 'is-unset' : ''}`}
								style={player.number == null ? undefined : { backgroundColor: color }}
							>
								{player.number ?? '–'}
							</span>
							<span className="tm-player-main">
								<span className="tm-player-name">{player.name}</span>
								<span className="tm-player-meta">{describe(player)}</span>
							</span>
							{seasonId && (
								<span className="tm-player-stats">
									<span className="tm-player-stat">
										<b>{stats[player.id]?.points ?? 0}</b>
										<span>{t('teamManagement.pwa.pointsShort')}</span>
									</span>
									<span className="tm-player-stat">
										<b>{stats[player.id]?.penaltyMinutes ?? 0}</b>
										<span>{t('teamManagement.gameStats.penaltyMinutesShort')}</span>
									</span>
								</span>
							)}
							<ChevronRight className="size-4 text-muted-foreground shrink-0" />
						</button>
					))}
				</div>
			) : (
				<div className="px-4 py-12 text-center text-sm text-muted-foreground">
					{query ? t('teamManagement.pwa.noPlayersFound') : t('teamDetail.noPlayers')}
				</div>
			)}

			<button
				type="button"
				className="tm-fab"
				style={{ backgroundColor: color }}
				onClick={() => navigate(`/team-management/${teamId}/player/new`)}
			>
				<Plus className="size-5" />
				{t('teamManagement.pwa.addPlayer')}
			</button>
		</div>
	);
}
