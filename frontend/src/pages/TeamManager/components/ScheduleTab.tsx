import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, MapPin } from 'lucide-react';
import { GameStatus, type Game } from '@types';

type Tab = 'upcoming' | 'played' | 'other';

interface ScheduleTabProps {
	games: Game[];
	teamId: number;
	teamColor?: string | null;
}

const OTHER_STATUSES = [GameStatus.POSTPONED, GameStatus.IN_PROGRESS, GameStatus.CANCELLED];

export default function ScheduleTab({ games, teamId, teamColor }: ScheduleTabProps) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const [tab, setTab] = useState<Tab>('upcoming');

	const color = teamColor || '#003E7E';

	const buckets = useMemo(() => {
		const all = games || [];
		return {
			// The API already sorts soonest-first with undated games last.
			upcoming: all.filter((g) => g.status === GameStatus.SCHEDULED),
			played: all
				.filter((g) => g.status === GameStatus.COMPLETED)
				.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
			other: all.filter((g) => OTHER_STATUSES.includes(g.status)),
		};
	}, [games]);

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'upcoming', label: t('teamManagement.pwa.upcomingGames') },
		{ key: 'played', label: t('teamManagement.pwa.pastGames') },
		{ key: 'other', label: t('teamManagement.pwa.otherGames') },
	];

	const isHome = (game: Game) => game.homeTeamId === teamId;
	const opponentName = (game: Game) =>
		(isHome(game) ? game.awayTeam?.name : game.homeTeam?.name) ?? t('teamManagement.pwa.unknownOpponent');

	const dateParts = (game: Game) => {
		if (!game.date) return null;
		const d = new Date(game.date);
		return {
			dow: d.toLocaleDateString(i18n.language, { weekday: 'short' }),
			day: d.toLocaleDateString(i18n.language, { day: 'numeric' }),
			mon: d.toLocaleDateString(i18n.language, { month: 'short' }),
			time: d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
			month: d.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }),
		};
	};

	const statusTone: Record<string, { bg: string; fg: string }> = {
		[GameStatus.POSTPONED]: { bg: '#fef3c7', fg: '#92400e' },
		[GameStatus.IN_PROGRESS]: { bg: '#dcfce7', fg: '#166534' },
		[GameStatus.CANCELLED]: { bg: '#fee2e2', fg: '#991b1b' },
	};

	const DateBlock = ({ game }: { game: Game }) => {
		const parts = dateParts(game);
		const postponed = game.status === GameStatus.POSTPONED;
		if (!parts) {
			return (
				<span className="tm-date-block is-tbd">
					<span className="tm-date-day">{t('teamManagement.pwa.tbd')}</span>
				</span>
			);
		}
		return (
			<span className={`tm-date-block ${postponed ? 'is-postponed' : ''}`}>
				<span className="tm-date-dow">{parts.dow}</span>
				<span className="tm-date-day">{parts.day}</span>
				<span className="tm-date-mon">{parts.mon}</span>
			</span>
		);
	};

	const SidePill = ({ game }: { game: Game }) => (
		<span
			className={`tm-side-pill ${isHome(game) ? '' : 'is-away'}`}
			style={isHome(game) ? { backgroundColor: `${color}1A`, color } : undefined}
		>
			{isHome(game) ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
		</span>
	);

	const Meta = ({ game }: { game: Game }) => {
		const parts = dateParts(game);
		if (!parts && !game.location) return null;
		return (
			<span className="tm-game-meta">
				{parts && (
					<>
						<Clock className="size-3 shrink-0" aria-hidden />
						<span>{parts.time}</span>
					</>
				)}
				{game.location && (
					<>
						{parts && <span aria-hidden className="text-border">|</span>}
						<MapPin className="size-3 shrink-0" aria-hidden />
						<span>{game.location}</span>
					</>
				)}
			</span>
		);
	};

	const renderUpcoming = () => {
		const dated = buckets.upcoming.filter((g) => g.date);
		const undated = buckets.upcoming.filter((g) => !g.date);
		if (!dated.length && !undated.length) return renderEmpty();

		let lastMonth = '';
		return (
			<>
				{dated.map((game) => {
					const month = dateParts(game)!.month;
					const heading = month !== lastMonth ? month : null;
					lastMonth = month;
					return (
						<div key={game.id} className="flex flex-col gap-2">
							{heading && <div className="tm-section-label pt-2 first:pt-0">{heading}</div>}
							<div className="tm-game-card">
								<DateBlock game={game} />
								<span className="tm-game-main">
									<span className="tm-game-opponent">{opponentName(game)}</span>
									<Meta game={game} />
								</span>
								<SidePill game={game} />
							</div>
						</div>
					);
				})}

				{undated.length > 0 && (
					<div className="flex flex-col gap-2 pt-2">
						<div className="tm-section-label">{t('teamManagement.pwa.notScheduledYet')}</div>
						<div className="tm-rows-card">
							{undated.map((game) => (
								<div key={game.id} className="tm-compact-row">
									<span
										className="w-6 shrink-0 text-[11px] font-semibold uppercase tracking-wide"
										style={{ color: isHome(game) ? color : undefined }}
									>
										{isHome(game) ? t('teamManagement.pwa.homeShort') : t('teamManagement.pwa.awayShort')}
									</span>
									<span className="flex-1 min-w-0 truncate text-sm font-medium">{opponentName(game)}</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{t('teamManagement.pwa.tbd')}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</>
		);
	};

	const renderPlayed = () => {
		if (!buckets.played.length) return renderEmpty();
		return buckets.played.map((game) => {
			const home = isHome(game);
			const teamScore = home ? game.homeScore : game.awayScore;
			const oppScore = home ? game.awayScore : game.homeScore;
			const hasScore = teamScore != null && oppScore != null;
			const result = !hasScore ? null
				: teamScore > oppScore ? 'win'
				: teamScore === oppScore ? 'draw' : 'loss';
			const tone = result === 'win' ? { bg: '#dcfce7', fg: '#166534' }
				: result === 'draw' ? { bg: '#fef3c7', fg: '#92400e' }
				: { bg: '#fee2e2', fg: '#991b1b' };

			return (
				<button
					key={game.id}
					type="button"
					className="tm-game-card"
					onClick={() => navigate(`/team-management/${teamId}/game/${game.id}`)}
				>
					<DateBlock game={game} />
					<span className="tm-game-main">
						<span className="tm-game-opponent">{opponentName(game)}</span>
						<Meta game={game} />
					</span>
					{hasScore && (
						<span className="flex flex-col items-end gap-1 shrink-0">
							<span className="text-lg font-bold tabular-nums leading-none">
								{teamScore}:{oppScore}
							</span>
							<span
								className="tm-status-pill"
								style={{ backgroundColor: tone.bg, color: tone.fg }}
							>
								{result === 'win' ? t('teamManagement.pwa.win')
									: result === 'draw' ? t('teamManagement.pwa.draw')
									: t('teamManagement.pwa.loss')}
							</span>
						</span>
					)}
					<ChevronRight className="size-4 text-muted-foreground shrink-0" />
				</button>
			);
		});
	};

	const renderOther = () => {
		if (!buckets.other.length) return renderEmpty();
		return buckets.other.map((game) => {
			const tone = statusTone[game.status] ?? { bg: '#ececf0', fg: '#717182' };
			return (
				<div key={game.id} className="tm-game-card">
					<DateBlock game={game} />
					<span className="tm-game-main">
						<span className="tm-game-opponent">{opponentName(game)}</span>
						<span className="flex items-center gap-2">
							<span
								className="tm-status-pill"
								style={{ backgroundColor: tone.bg, color: tone.fg }}
							>
								{t(`admin.tabs.game.status.${game.status}`)}
							</span>
							{game.status === GameStatus.POSTPONED && (
								<span className="text-xs text-muted-foreground">
									{t('teamManagement.pwa.newDateTbd')}
								</span>
							)}
						</span>
					</span>
					<SidePill game={game} />
				</div>
			);
		});
	};

	const renderEmpty = () => (
		<div className="px-4 py-12 text-center text-sm text-muted-foreground">
			{t('teamDetail.games.noGames')}
		</div>
	);

	return (
		<div className="flex flex-col gap-3 pb-2">
			<div className="tm-segmented grid-cols-3">
				{tabs.map((option) => (
					<button
						key={option.key}
						type="button"
						aria-pressed={tab === option.key}
						onClick={() => setTab(option.key)}
					>
						{option.label}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-2">
				{tab === 'upcoming' && renderUpcoming()}
				{tab === 'played' && renderPlayed()}
				{tab === 'other' && renderOther()}
			</div>
		</div>
	);
}
