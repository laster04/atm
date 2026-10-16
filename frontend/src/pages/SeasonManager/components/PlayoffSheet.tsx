import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Trophy, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { PlayoffRound, Season, SeasonPlayoff, Standing } from '@types';
import SeasonPlayoffBracket, { winsNeeded } from '@/components/playoff/SeasonPlayoffBracket';
import { SEASON_ACCENT } from './util';

const ROUNDS: Exclude<PlayoffRound, 'BRONZE'>[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
const BEST_OF = [1, 3, 5, 7];

// The same bracket arithmetic as services/playoff/bracket.ts, for the preview only;
// the server draws the real bracket.
const bracketSize = (qualifiers: number) => {
	let size = 2;
	while (size < qualifiers) size *= 2;
	return size;
};
const seedOrder = (n: number): number[] =>
	n === 1 ? [1] : seedOrder(n / 2).flatMap((seed) => [seed, n + 1 - seed]);
const roundsFor = (qualifiers: number) => ROUNDS.slice(ROUNDS.length - Math.log2(bracketSize(qualifiers)));

interface PlayoffSheetProps {
	season: Season;
	teamCount: number;
	onClose: () => void;
	/** Creating or deleting the bracket adds or removes games. */
	onChanged: () => void;
}

/**
 * The season's play-off: drawn here from the top of the table, then shown as
 * its bracket. A play-off game is entered and confirmed like any other game;
 * the bracket moves winners on by itself.
 */
export default function PlayoffSheet({ season, teamCount, onClose, onChanged }: PlayoffSheetProps) {
	const { t } = useTranslation();
	const maxQualifiers = Math.min(16, teamCount);

	const [playoff, setPlayoff] = useState<SeasonPlayoff | null>(null);
	const [standings, setStandings] = useState<Standing[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const [qualifiers, setQualifiers] = useState(Math.min(8, maxQualifiers));
	const [bestOf, setBestOf] = useState<Partial<Record<PlayoffRound, number>>>({});
	const [bronze, setBronze] = useState(true);

	useEffect(() => {
		Promise.all([seasonApi.getPlayoff(season.id), seasonApi.getStandings(season.id)])
			.then(([playoffRes, standingsRes]) => {
				setPlayoff(playoffRes.data);
				setStandings([...standingsRes.data].sort((a, b) => a.rank - b.rank));
			})
			.catch(() => setError(t('seasonManagement.playoff.loadError')))
			.finally(() => setLoading(false));
	}, [season.id, t]);

	const rounds = roundsFor(qualifiers);
	// A bronze game needs two semi-final losers; three teams leave one semi-final.
	const bronzePossible = qualifiers >= 4;

	const firstRound = useMemo(() => {
		const size = bracketSize(qualifiers);
		const order = seedOrder(size);
		const name = (seed: number) => standings[seed - 1]?.team.name ?? t('playoff.seed', { n: seed });
		return Array.from({ length: size / 2 }, (_, slot) => {
			const [home, away] = [order[slot * 2], order[slot * 2 + 1]];
			if (away > qualifiers) return { key: slot, text: t('seasonManagement.playoff.byeFor', { seed: home, name: name(home) }) };
			return { key: slot, text: `${home}. ${name(home)} – ${away}. ${name(away)}` };
		});
	}, [qualifiers, standings, t]);

	const run = async (action: () => Promise<void>, fallback: string) => {
		setBusy(true);
		setError('');
		try {
			await action();
			onChanged();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t(fallback));
		} finally {
			setBusy(false);
		}
	};

	const create = () =>
		run(async () => {
			const roundsPlayed: PlayoffRound[] = [...rounds, ...(bronze && bronzePossible ? ['BRONZE' as const] : [])];
			const res = await seasonApi.createPlayoff(season.id, {
				qualifiers,
				bronze: bronze && bronzePossible,
				bestOf: Object.fromEntries(roundsPlayed.map((round) => [round, bestOf[round] ?? 1])),
			});
			setPlayoff(res.data);
		}, 'seasonManagement.playoff.createError');

	const remove = () =>
		run(async () => {
			await seasonApi.deletePlayoff(season.id);
			setPlayoff(null);
		}, 'seasonManagement.playoff.deleteError');

	const bestOfLabel = (value: number) =>
		value === 1 ? t('seasonManagement.playoff.singleGame') : t('playoff.bestOf', { count: winsNeeded(value) });

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button
						onClick={onClose}
						className="-ml-2 flex size-10 items-center justify-center rounded-lg"
						aria-label={t('common.close')}
					>
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('playoff.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				{error && <p className="text-sm text-red-600">{error}</p>}

				{loading ? (
					<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
				) : playoff ? (
					<>
						<div className="overflow-hidden rounded-xl border border-border bg-card">
							<SeasonPlayoffBracket playoff={playoff} />
						</div>
						<p className="text-[12.5px] leading-snug text-muted-foreground">{t('seasonManagement.playoff.howToPlay')}</p>
						<button
							onClick={() => void remove()}
							disabled={busy}
							className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold disabled:opacity-60"
						>
							<Trash2 className="size-4" aria-hidden />
							{t('seasonManagement.playoff.delete')}
						</button>
						<p className="text-[12px] text-muted-foreground">{t('seasonManagement.playoff.deleteHint')}</p>
					</>
				) : (
					<form
						className="flex flex-col gap-3.5"
						onSubmit={(e) => {
							e.preventDefault();
							void create();
						}}
					>
						<p className="text-[12.5px] leading-snug text-muted-foreground">{t('seasonManagement.playoff.intro')}</p>

						<label className="flex flex-col gap-1.5">
							<span className="tm-section-label">{t('seasonManagement.playoff.qualifiers')}</span>
							<select
								value={qualifiers}
								onChange={(e) => setQualifiers(Number(e.target.value))}
								className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
							>
								{Array.from({ length: maxQualifiers - 1 }, (_, i) => i + 2).map((n) => (
									<option key={n} value={n}>{n}</option>
								))}
							</select>
						</label>

						<div className="flex flex-col gap-2">
							<span className="tm-section-label">{t('seasonManagement.playoff.format')}</span>
							<div className="tm-rows-card">
								{[...rounds, ...(bronze && bronzePossible ? ['BRONZE' as const] : [])].map((round) => (
									<label key={round} className="flex min-h-12 items-center gap-3 px-3.5 py-2">
										<span className="min-w-0 flex-1 text-[14.5px]">{t(`playoff.rounds.${round}`)}</span>
										<select
											value={bestOf[round] ?? 1}
											onChange={(e) => setBestOf((prev) => ({ ...prev, [round]: Number(e.target.value) }))}
											className="h-9 shrink-0 rounded-[10px] border border-border bg-input-background px-2 text-[13px]"
										>
											{BEST_OF.map((value) => (
												<option key={value} value={value}>{bestOfLabel(value)}</option>
											))}
										</select>
									</label>
								))}
							</div>
						</div>

						{bronzePossible && (
							<label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3.5">
								<input type="checkbox" checked={bronze} onChange={(e) => setBronze(e.target.checked)} className="size-4" />
								<span className="text-[14.5px]">{t('seasonManagement.playoff.bronze')}</span>
							</label>
						)}

						<div className="flex flex-col gap-2">
							<span className="tm-section-label">{t('seasonManagement.playoff.preview')}</span>
							<ul className="tm-rows-card">
								{firstRound.map((pair) => (
									<li key={pair.key} className="px-3.5 py-2.5 text-[14px]">{pair.text}</li>
								))}
							</ul>
						</div>

						<button
							type="submit"
							disabled={busy || maxQualifiers < 2}
							className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-60"
							style={{ backgroundColor: SEASON_ACCENT }}
						>
							<Trophy className="size-4" aria-hidden />
							{t('seasonManagement.playoff.create')}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
