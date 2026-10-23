import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { embedApi } from '@/services/api';
import type { EmbedCompetition, EmbedTeamOption } from '@types';

interface EmbedPanelProps {
	kind: 'season' | 'tournament';
	id: string;
	/** The colour the manager's screen uses; the widget's default highlight. */
	accent: string;
	/** From a team's own screen: the widget is always about this team. */
	fixedTeam?: { id: string; name: string };
}

type View = 'standings' | 'games';

/**
 * "Vložit na web": the manager picks a widget and its look, sees it live, and
 * copies one line of HTML for the club's website (celek I).
 */
export default function EmbedPanel({ kind, id, accent, fixedTeam }: EmbedPanelProps) {
	const { t, i18n } = useTranslation();
	const [competition, setCompetition] = useState<EmbedCompetition | null>(null);
	const [teams, setTeams] = useState<EmbedTeamOption[]>([]);
	const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
	const [unavailable, setUnavailable] = useState(false);

	const [view, setView] = useState<View>('standings');
	const [team, setTeam] = useState(fixedTeam?.id ?? '');
	const [group, setGroup] = useState('');
	const [rows, setRows] = useState('');
	const [results, setResults] = useState(true);
	const [theme, setTheme] = useState<'light' | 'dark'>('light');
	const [color, setColor] = useState(accent);
	const [lang, setLang] = useState<'cs' | 'en'>(i18n.language.startsWith('en') ? 'en' : 'cs');
	const [logos, setLogos] = useState(true);
	const [hideBrand, setHideBrand] = useState(false);
	const [copied, setCopied] = useState(false);
	const [height, setHeight] = useState(360);
	const preview = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		setUnavailable(false);
		Promise.all([embedApi.teams(kind, id), embedApi.standings(kind, id)])
			.then(([teamsRes, standingsRes]) => {
				setCompetition(teamsRes.data.competition);
				setTeams(teamsRes.data.teams);
				setGroups(standingsRes.data.tables.flatMap((table) => (table.group ? [table.group] : [])));
			})
			.catch(() => setUnavailable(true));
	}, [kind, id]);

	// The preview reports its height the same way embed.js reads it on a club's page.
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.source !== preview.current?.contentWindow || event.data?.type !== 'atm-embed:height') return;
			setHeight(Math.min(Math.max(Number(event.data.height) || 0, 120), 1200));
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, []);

	const src = useMemo(() => {
		const query = new URLSearchParams();
		if (team) query.set('team', team);
		if (group) query.set('group', group);
		if (rows) query.set('rows', rows);
		if (view === 'games' && results) query.set('results', '1');
		if (theme === 'dark') query.set('theme', 'dark');
		if (color.toLowerCase() !== '#0f172a') query.set('accent', color.replace('#', ''));
		if (lang !== 'cs') query.set('lang', lang);
		if (!logos) query.set('logos', '0');
		if (hideBrand && competition?.canHideBrand) query.set('brand', '0');
		const search = query.toString();
		return `${window.location.origin}/embed/${kind}/${id}/${view}${search ? `?${search}` : ''}`;
	}, [kind, id, view, team, group, rows, results, theme, color, lang, logos, hideBrand, competition]);

	const title = competition
		? `${t(`embedPanel.views.${view}`)} – ${competition.name}`
		: t(`embedPanel.views.${view}`);
	const code = `<iframe src="${src}" title="${title.replace(/"/g, '&quot;')}" loading="lazy" style="width:100%;height:${height}px;border:0"></iframe>`
		+ `<script src="${window.location.origin}/embed.js" async></script>`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	if (unavailable) {
		return <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t('embedPanel.unavailable')}</p>;
	}

	const field = 'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm';
	const label = 'flex flex-col gap-1.5 text-[12.5px] font-medium text-muted-foreground';
	const check = 'flex items-center gap-2 text-sm';

	return (
		<div className="flex flex-col gap-5">
			<p className="text-sm text-muted-foreground">{t('embedPanel.intro')}</p>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
				<div className="flex flex-col gap-4">
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">{t('embedPanel.widget')}</legend>
						{(['standings', 'games'] as View[]).map((value) => (
							<label key={value} className={check}>
								<input type="radio" name="embed-view" checked={view === value} onChange={() => setView(value)} />
								{t(`embedPanel.views.${value}`)}
							</label>
						))}
					</fieldset>

					{!fixedTeam && (
						<label className={label}>
							{t('embedPanel.team')}
							<select className={field} value={team} onChange={(e) => setTeam(e.target.value)}>
								<option value="">{t('embedPanel.allTeams')}</option>
								{teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
							</select>
						</label>
					)}

					{view === 'standings' && groups.length > 0 && (
						<label className={label}>
							{t(kind === 'season' ? 'embedPanel.division' : 'embedPanel.group')}
							<select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
								<option value="">{t(kind === 'season' ? 'embedPanel.allDivisions' : 'embedPanel.allGroups')}</option>
								{kind === 'season' && <option value="total">{t('embedPanel.wholeSeason')}</option>}
								{groups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
							</select>
						</label>
					)}

					<label className={label}>
						{t(view === 'standings' ? 'embedPanel.rowsTable' : 'embedPanel.rowsGames')}
						<input
							type="number"
							min={1}
							max={30}
							inputMode="numeric"
							className={field}
							value={rows}
							placeholder={view === 'standings' ? t('embedPanel.rowsAll') : '5'}
							onChange={(e) => setRows(e.target.value)}
						/>
					</label>

					{view === 'games' && (
						<label className={check}>
							<input type="checkbox" checked={results} onChange={(e) => setResults(e.target.checked)} />
							{t('embedPanel.results')}
						</label>
					)}

					<div className="grid grid-cols-2 gap-3">
						<label className={label}>
							{t('embedPanel.theme')}
							<select className={field} value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
								<option value="light">{t('embedPanel.light')}</option>
								<option value="dark">{t('embedPanel.dark')}</option>
							</select>
						</label>
						<label className={label}>
							{t('embedPanel.language')}
							<select className={field} value={lang} onChange={(e) => setLang(e.target.value as 'cs' | 'en')}>
								<option value="cs">Čeština</option>
								<option value="en">English</option>
							</select>
						</label>
					</div>

					<label className={label}>
						{t('embedPanel.accent')}
						<input type="color" className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-card p-1" value={color} onChange={(e) => setColor(e.target.value)} />
					</label>

					<label className={check}>
						<input type="checkbox" checked={logos} onChange={(e) => setLogos(e.target.checked)} />
						{t('embedPanel.logos')}
					</label>

					<label className={`${check} ${competition?.canHideBrand ? '' : 'text-muted-foreground'}`}>
						<input type="checkbox" checked={hideBrand} disabled={!competition?.canHideBrand} onChange={(e) => setHideBrand(e.target.checked)} />
						{t('embedPanel.hideBrand')}
					</label>
					{!competition?.canHideBrand && <p className="-mt-2 text-xs text-muted-foreground">{t('embedPanel.hideBrandPaid')}</p>}
				</div>

				<div className="flex min-w-0 flex-col gap-3">
					<span className="text-[12.5px] font-medium text-muted-foreground">{t('embedPanel.preview')}</span>
					<div className="rounded-xl border border-dashed border-border bg-muted/40 p-3">
						<iframe
							ref={preview}
							key={src}
							src={src}
							title={title}
							className="w-full rounded-lg border-0"
							style={{ height }}
						/>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<label htmlFor="embed-code" className="text-[12.5px] font-medium text-muted-foreground">{t('embedPanel.code')}</label>
				<textarea id="embed-code" readOnly value={code} rows={4} className="w-full rounded-lg border border-border bg-card p-3 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						onClick={() => void copy()}
						className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
						style={{ backgroundColor: accent }}
					>
						{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
						{copied ? t('embedPanel.copied') : t('embedPanel.copy')}
					</button>
					<a href="/docs/vlozeni-na-web" target="_blank" rel="noopener" className="text-sm font-semibold underline underline-offset-2">
						{t('embedPanel.help')}
					</a>
				</div>
			</div>
		</div>
	);
}
