import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import type { TournamentGame, TournamentGamePhase } from '@types';
import { EmptyState, Panel } from '@/components/public';
import { isPlayed } from './shared';

/** Knockout rounds left to right; the bronze game hangs under the final. */
const ROUNDS: TournamentGamePhase[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

/** Height of one first-round slot; every later round's slot doubles it. */
const SLOT = 130;

interface PlayoffBracketProps {
	games: TournamentGame[];
	/** "A1"-style labels by team id, from the group tables. */
	seeds: Map<string, string>;
}

export default function PlayoffBracket({ games, seeds }: PlayoffBracketProps) {
	const { t } = useTranslation();
	const knockout = games.filter((game) => game.phase !== 'GROUP');

	if (knockout.length === 0) {
		return <EmptyState title={t('tournamentDetail.playoff.empty')} />;
	}

	const inRound = (phase: TournamentGamePhase) =>
		knockout.filter((game) => game.phase === phase).sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
	const rounds = ROUNDS.filter((phase) => inRound(phase).length > 0);
	const final = inRound('FINAL')[0];
	const bronze = inRound('BRONZE')[0];
	const champion = final && isPlayed(final)
		? final.homeScore! > final.awayScore! ? final.homeTeam : final.awayTeam
		: null;
	// The first round shown sets the grid: each later round sits between the two games that feed it.
	// A final on its own still needs room for the winner above it and the bronze game below.
	const height = Math.max(SLOT * inRound(rounds[0] ?? 'FINAL').length, SLOT * 3);

	return (
		<Panel flush title={t('tournamentDetail.playoff.title')}>
			<div className="overflow-x-auto">
				<div
					className="grid gap-10 p-6"
					style={{ gridTemplateColumns: `repeat(${Math.max(rounds.length, 1)}, minmax(240px, 1fr))`, minWidth: rounds.length * 280 }}
				>
					{rounds.map((phase) => {
						const roundGames = inRound(phase);
						const label = (
							<div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
								{t(`tournamentDetail.playoff.phases.${phase}`)}
							</div>
						);

						if (phase === 'FINAL') {
							return (
								<div key={phase} className="flex flex-col gap-3">
									{label}
									<div className="grid" style={{ height, gridTemplateRows: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
										<div className="flex flex-col justify-end pb-4">
											{champion && (
												<div className="flex items-center gap-3 rounded-xl bg-navy px-4 py-3.5">
													<span className="flex size-9 items-center justify-center rounded-full bg-brand/15">
														<Trophy className="size-[18px] text-brand" />
													</span>
													<div className="flex min-w-0 flex-col gap-0.5">
														<span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
															{t('tournamentDetail.playoff.champion')}
														</span>
														<span className="truncate text-[17px] font-extrabold text-white">{champion.name}</span>
													</div>
												</div>
											)}
										</div>
										{final && <MatchCard game={final} seeds={seeds} highlight />}
										<div className="flex flex-col gap-1.5 pt-7">
											{bronze && (
												<>
													<div className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
														{t('tournamentDetail.playoff.phases.BRONZE')}
													</div>
													<MatchCard game={bronze} seeds={seeds} />
												</>
											)}
										</div>
									</div>
								</div>
							);
						}

						return (
							<div key={phase} className="flex flex-col gap-3">
								{label}
								<div className="flex flex-col">
									{roundGames.map((game) => (
										<div key={game.id} className="flex flex-col justify-center" style={{ height: height / roundGames.length }}>
											<MatchCard game={game} seeds={seeds} />
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</Panel>
	);
}

function MatchCard({ game, seeds, highlight }: { game: TournamentGame; seeds: Map<string, string>; highlight?: boolean }) {
	const { t } = useTranslation();
	const played = isPlayed(game);

	const side = (team: TournamentGame['homeTeam'], seed: number | null | undefined, score: number | null | undefined, won: boolean) => {
		// Before the groups finish a slot may only know which seed will fill it.
		const name = team?.name ?? (seed != null ? t('tm.common.seed', { n: seed }) : t('tm.common.tbd'));
		const strong = won || !played;
		return (
			<div className="flex items-center gap-2.5 px-3.5 py-2.5">
				<span className="w-6 shrink-0 text-[11px] font-bold text-muted-foreground">{team ? seeds.get(team.id) : ''}</span>
				<span className={`min-w-0 flex-1 truncate text-[13px] ${strong ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
					{name}
				</span>
				{played && (
					<span className={`text-sm tabular-nums ${won ? 'font-extrabold text-foreground' : 'font-medium text-muted-foreground'}`}>
						{score}
					</span>
				)}
			</div>
		);
	};

	return (
		<div
			className={`overflow-hidden rounded-xl border bg-card shadow-sm ${highlight ? 'border-brand' : 'border-border'}`}
		>
			{side(game.homeTeam, game.homeSeed, game.homeScore, played && game.homeScore! > game.awayScore!)}
			<div className="h-px bg-border-subtle" />
			{side(game.awayTeam, game.awaySeed, game.awayScore, played && game.awayScore! > game.homeScore!)}
		</div>
	);
}
