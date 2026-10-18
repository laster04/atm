import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Shield, Trophy, Users, Medal, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Role, type ManagedCompetition } from '@types';
import type { StartKind } from './CreateCompetitionDialog';

interface Workspace {
	key: 'season' | 'team' | 'tournament' | 'admin';
	to: string;
	icon: LucideIcon;
	/** The shell's own colour, so the card matches the area it opens. */
	bg: string;
	ink: string;
	count?: number;
	pending?: number;
}

interface WorkspacesSectionProps {
	managed: ManagedCompetition[];
	onStart: (kind: StartKind) => void;
}

/**
 * The management areas this account holds, each with what waits there, then
 * the two ways to start something new. This replaces the links that used to
 * sit in the header's menu.
 */
export default function WorkspacesSection({ managed, onStart }: WorkspacesSectionProps) {
	const { t } = useTranslation();
	const { user } = useAuth();
	if (!user) return null;

	const pendingOf = (kind: ManagedCompetition['kind']) =>
		managed.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.pending, 0);
	const manages = user.manages ?? { leagues: 0, teams: 0, series: 0 };

	const workspaces: Workspace[] = [
		manages.leagues > 0 && { key: 'season', to: '/season-management', icon: Trophy, bg: '#0F172A', ink: '#FFFFFF', count: manages.leagues, pending: pendingOf('season') },
		manages.teams > 0 && { key: 'team', to: '/team-management', icon: Users, bg: '#DC2626', ink: '#FFFFFF', count: manages.teams },
		manages.series > 0 && { key: 'tournament', to: '/tournament-management', icon: Medal, bg: '#7C3AED', ink: '#FFFFFF', count: manages.series, pending: pendingOf('tournament') },
		user.role === Role.ADMIN && { key: 'admin', to: '/admin', icon: Shield, bg: '#FFC629', ink: '#252525' },
	].filter(Boolean) as Workspace[];

	return (
		<section className="flex flex-col gap-3" data-tour="workspaces" aria-labelledby="workspaces-title">
			<div className="flex flex-col gap-0.5">
				<h2 id="workspaces-title" className="text-[20px] font-bold">{t('dashboard.workspaces.title')}</h2>
				<p className="text-[14px] text-muted-foreground">
					{workspaces.length > 0 ? t('dashboard.workspaces.text') : t('dashboard.workspaces.emptyText')}
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				{workspaces.map(({ key, to, icon: Icon, bg, ink, count, pending }) => (
					<Link
						key={key}
						to={to}
						className="group flex min-h-[88px] items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
					>
						<span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: bg, color: ink }}>
							<Icon className="size-6" aria-hidden />
						</span>
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="text-[16px] font-bold leading-tight">{t(`dashboard.workspaces.${key}.title`)}</span>
							<span className="text-[13px] text-muted-foreground">
								{count != null ? t(`dashboard.workspaces.${key}.count`, { count }) : t(`dashboard.workspaces.${key}.text`)}
							</span>
							{!!pending && (
								<span className="self-start rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold text-warning-strong">
									{t('dashboard.workspaces.pending', { count: pending })}
								</span>
							)}
						</span>
						<ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
					</Link>
				))}

				{(['league', 'series'] as StartKind[]).map((kind) => (
					<button
						key={kind}
						type="button"
						onClick={() => onStart(kind)}
						className="flex min-h-[88px] items-center gap-3.5 rounded-2xl border-2 border-dashed border-border bg-card/60 p-4 text-left transition-colors hover:border-navy hover:bg-card"
					>
						<span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ice text-navy">
							<Plus className="size-6" aria-hidden />
						</span>
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="text-[16px] font-bold leading-tight">{t(`dashboard.start.${kind}.title`)}</span>
							<span className="text-[13px] text-muted-foreground">{t(`dashboard.start.${kind}.text`)}</span>
						</span>
					</button>
				))}
			</div>
		</section>
	);
}
