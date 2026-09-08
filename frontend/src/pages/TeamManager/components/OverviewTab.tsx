import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Clock, MapPin, Users } from 'lucide-react';
import { GameStatus, type Game, type Standing, type Team } from '@types';

interface OverviewTabProps {
	team: Team;
	standing?: Standing;
	playerCount: number;
	teamColor?: string | null;
	onTabChange: (tab: 'roster' | 'schedule') => void;
}

export default function OverviewTab({
	team,
	standing,
	playerCount,
	teamColor,
	onTabChange,
}: OverviewTabProps) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();

	const color = teamColor || '#003E7E';

	// The API sorts games soonest-first with undated ones last, so the first
	// dated SCHEDULED game is the real next fixture.
	const scheduled = (team.games || []).filter((g: Game) => g.status === GameStatus.SCHEDULED);
	const nextGame = scheduled.find((g) => g.date);
	const following = scheduled.filter((g) => g !== nextGame).slice(0, 3);

	const isHome = (game: Game) => game.homeTeamId === team.id;
	const opponentName = (game: Game) =>
		(isHome(game) ? game.awayTeam?.name : game.homeTeam?.name) ?? t('teamManagement.pwa.unknownOpponent');

	const daysUntil = (iso: string) => {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const target = new Date(iso);
		target.setHours(0, 0, 0, 0);
		return Math.round((target.getTime() - start.getTime()) / 86400000);
	};

	const countdown = (iso: string) => {
		const days = daysUntil(iso);
		if (days <= 0) return t('teamManagement.pwa.today');
		if (days === 1) return t('teamManagement.pwa.tomorrow');
		return t('teamManagement.pwa.inDays', { count: days });
	};

	const record = [
		{ label: t('teamManagement.pwa.wins'), value: standing?.wins ?? 0 },
		{ label: t('teamManagement.pwa.draws'), value: standing?.draws ?? 0 },
		{ label: t('teamManagement.pwa.losses'), value: standing?.losses ?? 0 },
		{ label: t('teamManagement.pwa.points'), value: standing?.points ?? 0 },
	];

	return (
		<div className="flex flex-col gap-4">
			{/* Season record */}
			<div className="grid grid-cols-4 gap-2">
				{record.map((cell) => (
					<div
						key={cell.label}
						className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card py-2.5"
					>
						<span className="text-lg font-bold leading-none tabular-nums">{cell.value}</span>
						<span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
							{cell.label}
						</span>
					</div>
				))}
			</div>

			{/* Next game */}
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<span className="tm-section-label">{t('teamManagement.pwa.nextGame')}</span>
					{nextGame?.date && (
						<span className="text-xs text-muted-foreground">{countdown(nextGame.date)}</span>
					)}
				</div>

				{nextGame ? (
					<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<div className="flex items-center gap-3">
							<span className="tm-date-block">
								<span className="tm-date-dow">
									{new Date(nextGame.date!).toLocaleDateString(i18n.language, { weekday: 'short' })}
								</span>
								<span className="tm-date-day">
									{new Date(nextGame.date!).toLocaleDateString(i18n.language, { day: 'numeric' })}
								</span>
								<span className="tm-date-mon">
									{new Date(nextGame.date!).toLocaleDateString(i18n.language, { month: 'short' })}
								</span>
							</span>
							<span className="tm-game-main">
								<span className="tm-game-opponent">{opponentName(nextGame)}</span>
								<span className="tm-game-meta">
									<Clock className="size-3 shrink-0" aria-hidden />
									<span>
										{new Date(nextGame.date!).toLocaleTimeString(i18n.language, {
											hour: '2-digit',
											minute: '2-digit',
										})}
									</span>
									{nextGame.location && (
										<>
											<span aria-hidden className="text-border">|</span>
											<MapPin className="size-3 shrink-0" aria-hidden />
											<span>{nextGame.location}</span>
										</>
									)}
								</span>
							</span>
							<span
								className={`tm-side-pill ${isHome(nextGame) ? '' : 'is-away'}`}
								style={isHome(nextGame) ? { backgroundColor: `${color}1A`, color } : undefined}
							>
								{isHome(nextGame) ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
							</span>
						</div>
						<button
							type="button"
							data-tour="team-next-game"
							className="flex h-11 items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white"
							style={{ backgroundColor: color }}
							onClick={() => navigate(`/team-management/${team.id}/game/${nextGame.id}`)}
						>
							<ClipboardCheck className="size-4" />
							{t('teamManagement.pwa.setLineup')}
						</button>
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
						{t('teamManagement.pwa.noScheduledGame')}
					</div>
				)}
			</div>

			{/* Following fixtures */}
			{following.length > 0 && (
				<div className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<span className="tm-section-label">{t('teamManagement.pwa.then')}</span>
						<button
							type="button"
							className="text-[13px] font-medium"
							style={{ color }}
							onClick={() => onTabChange('schedule')}
						>
							{t('teamManagement.pwa.viewAll')}
						</button>
					</div>
					<div className="tm-rows-card">
						{following.map((game) => (
							<div key={game.id} className="tm-compact-row">
								<span
									className="w-6 shrink-0 text-[11px] font-semibold uppercase tracking-wide"
									style={{ color: isHome(game) ? color : undefined }}
								>
									{isHome(game) ? t('teamManagement.pwa.homeShort') : t('teamManagement.pwa.awayShort')}
								</span>
								<span className="flex-1 min-w-0 truncate text-sm font-medium">
									{opponentName(game)}
								</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{game.date
										? new Date(game.date).toLocaleDateString(i18n.language, {
											day: 'numeric',
											month: 'short',
										})
										: t('teamManagement.pwa.tbd')}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Roster shortcut */}
			<button
				type="button"
				className="flex min-h-[60px] items-center gap-3 rounded-xl border border-border bg-card px-3.5 text-left"
				onClick={() => onTabChange('roster')}
			>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-input-background">
					<Users className="size-4" />
				</span>
				<span className="flex flex-1 flex-col gap-0.5 min-w-0">
					<span className="text-sm font-semibold">{t('teamManagement.pwa.teamRoster')}</span>
					<span className="text-xs text-muted-foreground">
						{t('teamManagement.pwa.playerCount', { count: playerCount })}
					</span>
				</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</div>
	);
}
