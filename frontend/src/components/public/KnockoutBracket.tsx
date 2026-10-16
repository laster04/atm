import { Trophy } from 'lucide-react';

export type KnockoutRound = 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL';

/** Height of one first-round slot; every later round's slot doubles it. */
const SLOT = 130;

export interface KnockoutSide {
	/** The team, or null while only its seed (or nothing) is known. */
	name: string | null;
	/** Shown instead of a name: "Seed 3", "TBD". */
	placeholder: string;
	/** Small label before the name, such as a group seed ("A1"). */
	tag?: string;
	/** A game score, or a series' wins. Left out until there is one. */
	score?: number | null;
	won?: boolean;
}

export interface KnockoutCard {
	round: KnockoutRound | 'BRONZE';
	/** Position in its round, top to bottom; a missing first-round slot is a bye. */
	slot: number;
	home: KnockoutSide;
	away: KnockoutSide;
	/** One line under the teams, e.g. "Best of 3". */
	caption?: string;
	/** Something has been played, so the loser is greyed out. */
	decided?: boolean;
}

interface KnockoutBracketProps {
	/** First round to final, as the bracket is played; byes included in the count. */
	rounds: KnockoutRound[];
	cards: KnockoutCard[];
	roundLabel: (round: KnockoutRound | 'BRONZE') => string;
	byeLabel: string;
	champion?: { label: string; name: string } | null;
}

/**
 * A knockout bracket drawn left to right, shared by tournaments and season
 * play-offs. Cards are placed by slot, so a first-round slot nobody plays (a
 * bye) stays an empty gap and each later round sits between the two slots
 * that feed it.
 */
export default function KnockoutBracket({ rounds, cards, roundLabel, byeLabel, champion }: KnockoutBracketProps) {
	const inRound = (round: KnockoutRound | 'BRONZE') =>
		cards.filter((card) => card.round === round).sort((a, b) => a.slot - b.slot);
	const final = inRound('FINAL')[0];
	const bronze = inRound('BRONZE')[0];
	// A final on its own still needs room for the winner above it and the bronze game below.
	const height = Math.max(SLOT * 2 ** (rounds.length - 1), SLOT * 3);

	const label = (round: KnockoutRound | 'BRONZE') => (
		<div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{roundLabel(round)}</div>
	);

	return (
		<div className="overflow-x-auto">
			<div
				className="grid gap-10 p-6"
				style={{ gridTemplateColumns: `repeat(${Math.max(rounds.length, 1)}, minmax(240px, 1fr))`, minWidth: rounds.length * 280 }}
			>
				{rounds.map((round, r) => {
					if (round === 'FINAL') {
						return (
							<div key={round} className="flex flex-col gap-3">
								{label(round)}
								<div className="grid" style={{ height, gridTemplateRows: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
									<div className="flex flex-col justify-end pb-4">
										{champion && (
											<div className="flex items-center gap-3 rounded-xl bg-navy px-4 py-3.5">
												<span className="flex size-9 items-center justify-center rounded-full bg-brand/15">
													<Trophy className="size-[18px] text-brand" aria-hidden />
												</span>
												<div className="flex min-w-0 flex-col gap-0.5">
													<span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
														{champion.label}
													</span>
													<span className="truncate text-[17px] font-extrabold text-white">{champion.name}</span>
												</div>
											</div>
										)}
									</div>
									{final && <Card card={final} highlight />}
									<div className="flex flex-col gap-1.5 pt-7">
										{bronze && (
											<>
												<div className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
													{roundLabel('BRONZE')}
												</div>
												<Card card={bronze} />
											</>
										)}
									</div>
								</div>
							</div>
						);
					}

					const positions = 2 ** (rounds.length - 1 - r);
					const placed = inRound(round);
					return (
						<div key={round} className="flex flex-col gap-3">
							{label(round)}
							<div className="flex flex-col">
								{Array.from({ length: positions }, (_, slot) => {
									const card = placed.find((candidate) => candidate.slot === slot);
									return (
										<div key={slot} className="flex flex-col justify-center" style={{ height: height / positions }}>
											{card ? (
												<Card card={card} />
											) : (
												<div className="rounded-xl border border-dashed border-border px-3.5 py-3 text-center text-[12px] text-muted-foreground">
													{byeLabel}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function Card({ card, highlight }: { card: KnockoutCard; highlight?: boolean }) {
	const side = (entry: KnockoutSide) => {
		const strong = entry.won || !card.decided;
		return (
			<div className="flex items-center gap-2.5 px-3.5 py-2.5">
				<span className="w-6 shrink-0 text-[11px] font-bold text-muted-foreground">{entry.tag ?? ''}</span>
				<span className={`min-w-0 flex-1 truncate text-[13px] ${strong ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
					{entry.name ?? entry.placeholder}
				</span>
				{entry.score != null && (
					<span className={`text-sm tabular-nums ${entry.won ? 'font-extrabold text-foreground' : 'font-medium text-muted-foreground'}`}>
						{entry.score}
					</span>
				)}
			</div>
		);
	};

	return (
		<div className={`overflow-hidden rounded-xl border bg-card shadow-sm ${highlight ? 'border-brand' : 'border-border'}`}>
			{side(card.home)}
			<div className="h-px bg-border-subtle" />
			{side(card.away)}
			{card.caption && (
				<div className="border-t border-border-subtle px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
					{card.caption}
				</div>
			)}
		</div>
	);
}
