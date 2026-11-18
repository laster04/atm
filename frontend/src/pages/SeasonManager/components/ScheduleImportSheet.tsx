import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { ScheduleImportPlan, Season } from '@types';
import { formatGameDateTime } from '@/utils/date';
import { SEASON_ACCENT } from './util';

interface ScheduleImportSheetProps {
	season: Season;
	onClose: () => void;
	/** Teams and games changed; the caller reloads both. */
	onImported: () => void;
}

const ACTION_TONE = {
	CREATE: 'bg-green-100 text-green-900',
	UPDATE: 'bg-amber-100 text-amber-900',
	UNCHANGED: 'bg-muted text-muted-foreground',
	SKIP: 'bg-red-100 text-red-900',
} as const;

/**
 * The fixture list from a spreadsheet: the "Program" export of the volleyball
 * federation's system (XLSX), or a CSV with the same columns. The server
 * shows what it would do, and imports the same file once confirmed; importing
 * an updated program again moves dates and venues.
 */
export default function ScheduleImportSheet({ season, onClose, onImported }: ScheduleImportSheetProps) {
	const { t, i18n } = useTranslation();
	const input = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [plan, setPlan] = useState<ScheduleImportPlan | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [done, setDone] = useState<ScheduleImportPlan['counts'] | null>(null);

	const message = (err: unknown, fallback: string) => {
		const data = (err as AxiosError<{ code?: string }>).response?.data;
		return data?.code ? t(`seasonManagement.import.errors.${data.code}`, fallback) : fallback;
	};

	const preview = async (chosen: File) => {
		setFile(chosen);
		setPlan(null);
		setDone(null);
		setError('');
		setBusy(true);
		try {
			setPlan((await seasonApi.previewScheduleImport(season.id, chosen)).data);
		} catch (err) {
			setError(message(err, t('seasonManagement.import.errors.read')));
		} finally {
			setBusy(false);
		}
	};

	const run = async () => {
		if (!file) return;
		setBusy(true);
		setError('');
		try {
			setDone((await seasonApi.runScheduleImport(season.id, file)).data);
			setPlan(null);
			onImported();
		} catch (err) {
			setError(message(err, t('seasonManagement.import.errors.run')));
		} finally {
			setBusy(false);
		}
	};

	const changes = plan ? plan.counts.create + plan.counts.update + plan.counts.newTeams : 0;

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button onClick={onClose} className="-ml-2 flex size-10 items-center justify-center rounded-lg" aria-label={t('common.close')}>
						<X className="size-5" aria-hidden />
					</button>
					<h1 className="min-w-0 flex-1 truncate text-lg font-bold">{t('seasonManagement.import.title')}</h1>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					<p className="text-sm text-muted-foreground">{t('seasonManagement.import.intro')}</p>

					<input
						ref={input}
						type="file"
						accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
						className="sr-only"
						onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) void preview(chosen); event.target.value = ''; }}
					/>
					<button
						onClick={() => input.current?.click()}
						disabled={busy}
						className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card p-4 text-left disabled:opacity-60"
					>
						<FileSpreadsheet className="size-6 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
						<span className="flex min-w-0 flex-col">
							<span className="text-sm font-semibold">{file ? file.name : t('seasonManagement.import.choose')}</span>
							<span className="text-xs text-muted-foreground">{t('seasonManagement.import.columns')}</span>
						</span>
					</button>

					{busy && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
					{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

					{done && (
						<p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
							{t('seasonManagement.import.done', { create: done.create, update: done.update, teams: done.newTeams, results: done.results })}
						</p>
					)}

					{plan && (
						<>
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{(['create', 'update', 'unchanged', 'skip'] as const).map((key) => (
									<div key={key} className="rounded-xl border border-border bg-card p-3">
										<div className="text-xl font-extrabold tabular-nums">{plan.counts[key]}</div>
										<div className="text-xs text-muted-foreground">{t(`seasonManagement.import.counts.${key}`)}</div>
									</div>
								))}
							</div>

							<section className="flex flex-col gap-2">
								<h2 className="tm-section-label">{t('seasonManagement.import.teams')}</h2>
								<ul className="tm-rows-card">
									{plan.teams.map((team) => (
										<li key={team.name} className="flex items-center gap-2 px-3 py-2 text-sm">
											<span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
											<span className="text-xs text-muted-foreground">{t('seasonManagement.import.teamGames', { count: team.games })}</span>
											<span className={`rounded px-2 py-0.5 text-xs font-bold ${team.existing ? ACTION_TONE.UNCHANGED : ACTION_TONE.CREATE}`}>
												{team.existing ? t('seasonManagement.import.teamExisting') : t('seasonManagement.import.teamNew')}
											</span>
										</li>
									))}
								</ul>
							</section>

							<section className="flex flex-col gap-2">
								<h2 className="tm-section-label">{t('seasonManagement.import.games')}</h2>
								<ul className="tm-rows-card">
									{plan.fixtures.map((fixture) => (
										<li key={fixture.line} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
											<span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">{t('seasonManagement.import.line', { line: fixture.line })}</span>
											<span className="w-12 shrink-0 text-xs text-muted-foreground">{fixture.round ? t('seasonManagement.games.roundShort', { n: fixture.round }) : ''}</span>
											<span className="min-w-0 flex-1 font-semibold">
												{fixture.home} – {fixture.away}
												{fixture.result && (
													<span className="ml-2 tabular-nums">
														{fixture.result.home}:{fixture.result.away}
														{fixture.result.parts && (
															<span className="ml-1 text-xs font-normal text-muted-foreground">
																({fixture.result.parts.map((part) => `${part.home}:${part.away}`).join(', ')})
															</span>
														)}
													</span>
												)}
											</span>
											<span className="text-xs tabular-nums text-muted-foreground">
												{fixture.date ? formatGameDateTime(fixture.date, i18n.language) : t('seasonManagement.games.noDate')}
												{fixture.location ? ` · ${fixture.location}` : ''}
											</span>
											<span className={`rounded px-2 py-0.5 text-xs font-bold ${ACTION_TONE[fixture.action]}`}>
												{fixture.problem
													? t(`seasonManagement.import.problems.${fixture.problem}`)
													: t(`seasonManagement.import.actions.${fixture.action}`)}
											</span>
										</li>
									))}
								</ul>
							</section>
						</>
					)}
				</div>
			</div>

			{plan && (
				<div className="shrink-0 border-t border-border bg-card px-4 py-3">
					<div className="mx-auto flex max-w-3xl items-center gap-3">
						<span className="min-w-0 flex-1 text-xs text-muted-foreground">
							{changes > 0 ? t('seasonManagement.import.confirmHint') : t('seasonManagement.import.nothing')}
						</span>
						<button
							onClick={() => void run()}
							disabled={busy || changes === 0}
							className="h-11 rounded-[10px] px-5 text-[14.5px] font-semibold text-white disabled:opacity-50"
							style={{ backgroundColor: SEASON_ACCENT }}
						>
							{t('seasonManagement.import.run')}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
