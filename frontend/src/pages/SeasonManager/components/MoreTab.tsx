import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarPlus, ClipboardSignature, Code2, ExternalLink, Handshake, LayoutGrid, ListOrdered, Mail, Trophy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { gameApi, registrationApi, seasonApi } from '@/services/api';
import { SportType, type Game, type Season, type Team } from '@types';
import GenerateScheduleModal, { type GenerateScheduleData } from '@/pages/Admin/components/games/GenerateScheduleModal';
import ScoringSheet from './ScoringSheet';
import ResultsEmailSheet from './ResultsEmailSheet';
import DivisionsSheet from './DivisionsSheet';
import PlayoffSheet from './PlayoffSheet';
import RegistrationsSheet from './RegistrationsSheet';
import EmbedSheet from './EmbedSheet';
import { SEASON_ACCENT } from './util';

const NO_TEAM_REPORTS: SportType[] = [SportType.VOLLEYBALL, SportType.TENNIS];

interface MoreTabProps {
	season: Season;
	games: Game[];
	teams: Team[];
	teamCount: number;
	gameCount: number;
	onGamesChange: (games: Game[]) => void;
	onSeasonChange: (season: Season) => void;
	/** Re-reads the season's teams after an application adds one. */
	onTeamsReload: () => void;
}

export default function MoreTab({ season, games, teams, teamCount, gameCount, onGamesChange, onSeasonChange, onTeamsReload }: MoreTabProps) {
	const { t, i18n } = useTranslation();
	const [showGenerate, setShowGenerate] = useState(false);
	const [showScoring, setShowScoring] = useState(false);
	const [showSummary, setShowSummary] = useState(false);
	const [showDivisions, setShowDivisions] = useState(false);
	const [showPlayoff, setShowPlayoff] = useState(false);
	// The email about a new application links here with ?registrations=1.
	const [searchParams] = useSearchParams();
	const [showRegistrations, setShowRegistrations] = useState(searchParams.get('registrations') === '1');
	const [showEmbed, setShowEmbed] = useState(false);
	const [waitingApplications, setWaitingApplications] = useState(0);

	useEffect(() => {
		registrationApi.inbox('season', season.id)
			.then((res) => setWaitingApplications(res.data.registrations.filter((r) => r.status === 'PENDING').length))
			.catch(() => setWaitingApplications(0));
	}, [season.id, showRegistrations]);
	const [groupCount, setGroupCount] = useState(0);

	// Only used to decide whether the schedule generator offers to keep fixtures
	// inside divisions, so a failure here quietly means "no divisions".
	useEffect(() => {
		seasonApi.getGroups(season.id)
			.then((res) => setGroupCount(res.data.length))
			.catch(() => setGroupCount(0));
	}, [season.id, showDivisions]);
	const [error, setError] = useState('');
	const [savingAgreement, setSavingAgreement] = useState(false);
	// Seasons created before the option existed confirm agreed results too.
	const autoConfirm = season.autoConfirmAgreed !== false;
	// Volleyball and tennis tables need sets, so their teams do not report scores.
	const teamsReport = !NO_TEAM_REPORTS.includes(season.league?.sportType ?? SportType.HOCKEY);

	const toggleAutoConfirm = async () => {
		setError('');
		setSavingAgreement(true);
		try {
			const res = await seasonApi.update(season.id, { autoConfirmAgreed: !autoConfirm });
			onSeasonChange(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('resultClaim.setting.saveError'));
		} finally {
			setSavingAgreement(false);
		}
	};

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

	const handleGenerate = async (data: GenerateScheduleData) => {
		setError('');
		try {
			await gameApi.generateSchedule(season.id, data);
			// The generate endpoint returns only the fixtures it created, without
			// the team relations the list rows render, so re-read the season.
			const res = await gameApi.getBySeason(season.id);
			onGamesChange(res.data);
			setShowGenerate(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.more.generateError'));
		}
	};

	const info = [
		{ label: t('seasonManagement.more.league'), value: season.league?.name ?? '—' },
		{ label: t('seasonManagement.more.starts'), value: formatDate(season.startDate) },
		{ label: t('seasonManagement.more.ends'), value: formatDate(season.endDate) },
	];

	return (
		<div className="flex flex-col gap-4">
			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('seasonManagement.more.seasonInfo')}</span>
				<dl className="tm-rows-card">
					{info.map((row) => (
						<div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
							<dt className="shrink-0 text-muted-foreground">{row.label}</dt>
							<dd className="min-w-0 truncate text-right font-medium">{row.value}</dd>
						</div>
					))}
				</dl>
			</div>

			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('seasonManagement.more.actions')}</span>

				<button
					onClick={() => setShowGenerate(true)}
					disabled={teamCount < 2}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<CalendarPlus className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('seasonManagement.more.generateSchedule')}</span>
						<span className="text-xs text-muted-foreground">
							{gameCount > 0
								? t('seasonManagement.more.regenerateHint')
								: t('seasonManagement.more.generateHint')}
						</span>
					</span>
				</button>

				<button
					onClick={() => setShowDivisions(true)}
					disabled={teamCount === 0}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<LayoutGrid className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('seasonManagement.more.divisions')}</span>
						<span className="text-xs text-muted-foreground">
							{t('seasonManagement.more.divisionsHint')}
						</span>
					</span>
				</button>

				<button
					onClick={() => setShowRegistrations(true)}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"
				>
					<ClipboardSignature className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('registrations.title')}</span>
						<span className="text-xs text-muted-foreground">{t('registrations.hint')}</span>
					</span>
					{waitingApplications > 0 && (
						<span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: SEASON_ACCENT }}>
							{waitingApplications}
						</span>
					)}
				</button>

				<button
					onClick={() => setShowPlayoff(true)}
					disabled={teamCount < 2}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<Trophy className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('playoff.title')}</span>
						<span className="text-xs text-muted-foreground">{t('seasonManagement.more.playoffHint')}</span>
					</span>
				</button>

				<button
					onClick={() => setShowScoring(true)}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"
				>
					<ListOrdered className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('seasonManagement.more.scoring')}</span>
						<span className="text-xs text-muted-foreground">
							{season.scoring
								? t('seasonManagement.more.scoringCustom', {
										win: season.scoring.winPoints,
										draw: season.scoring.drawPoints,
									})
								: t('seasonManagement.more.scoringInherited')}
						</span>
					</span>
				</button>

				{teamsReport && <button
					onClick={toggleAutoConfirm}
					disabled={savingAgreement}
					role="switch"
					aria-checked={autoConfirm}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<Handshake className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('resultClaim.setting.title')}</span>
						<span className="text-xs text-muted-foreground">
							{autoConfirm ? t('resultClaim.setting.on') : t('resultClaim.setting.off')}
						</span>
					</span>
					<span
						aria-hidden
						className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
						style={{ backgroundColor: autoConfirm ? SEASON_ACCENT : '#cbd5e1' }}
					>
						<span
							className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all"
							style={{ left: autoConfirm ? '18px' : '2px' }}
						/>
					</span>
				</button>}

				<button
					onClick={() => setShowSummary(true)}
					disabled={gameCount === 0}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<Mail className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('seasonManagement.more.resultsEmail')}</span>
						<span className="text-xs text-muted-foreground">
							{t('seasonManagement.more.resultsEmailHint')}
						</span>
					</span>
				</button>

				<button
					onClick={() => setShowEmbed(true)}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"
				>
					<Code2 className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('embedPanel.title')}</span>
						<span className="text-xs text-muted-foreground">{t('embedPanel.hint')}</span>
					</span>
				</button>

				<Link
					to={`/season-detail/${season.id}`}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
				>
					<ExternalLink className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="text-sm font-semibold">{t('seasonManagement.more.publicPage')}</span>
				</Link>
			</div>

			{showDivisions && (
				<DivisionsSheet
					season={season}
					teams={teams}
					onClose={() => setShowDivisions(false)}
					// A new division changes the table, which the caller re-reads by
					// refreshing the fixtures it is derived from.
					onChanged={() => onGamesChange([...games])}
				/>
			)}

			{showRegistrations && (
				<RegistrationsSheet
					season={season}
					onClose={() => setShowRegistrations(false)}
					onTeamsChanged={onTeamsReload}
				/>
			)}

			{showPlayoff && (
				<PlayoffSheet
					season={season}
					teamCount={teamCount}
					onClose={() => setShowPlayoff(false)}
					// The bracket adds and removes play-off games; re-read the season's games.
					onChanged={() => {
						gameApi.getBySeason(season.id)
							.then((res) => onGamesChange(res.data))
							.catch(() => onGamesChange([...games]));
					}}
				/>
			)}

			{showEmbed && <EmbedSheet season={season} onClose={() => setShowEmbed(false)} />}

			{showSummary && (
				<ResultsEmailSheet season={season} onClose={() => setShowSummary(false)} />
			)}

			{showScoring && (
				<ScoringSheet
					season={season}
					onClose={() => setShowScoring(false)}
					onSaved={onSeasonChange}
				/>
			)}

			{showGenerate && (
				<GenerateScheduleModal
					teamsCount={teamCount}
					groupCount={groupCount}
					onSubmit={handleGenerate}
					onClose={() => setShowGenerate(false)}
				/>
			)}
		</div>
	);
}
