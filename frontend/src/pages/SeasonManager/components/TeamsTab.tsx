import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, Plus, Send, UserPlus } from 'lucide-react';
import { AxiosError } from 'axios';
import { inviteApi, teamApi } from '@/services/api';
import type { ManagerInvite, ManagerInviteSent, Season, Team } from '@types';
import TeamFormModal, { type TeamFormData } from '@/pages/Admin/components/teams/TeamFormModal';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/base/dropdown-menu';
import InviteManagerSheet from '@/components/invite/InviteManagerSheet';
import { invitesByTarget, managerState, sentAgo, type ManagerState } from '@/components/invite/inviteState';
import { SEASON_ACCENT, initials } from './util';

interface TeamsTabProps {
	season: Season;
	teams: Team[];
	invites: ManagerInvite[];
	onTeamsChange: (teams: Team[]) => void;
	onInvitesChange: (invites: ManagerInvite[]) => void;
}

const STATE_COLOR: Record<ManagerState, string> = {
	ACTIVE: '#15803d',
	INVITED: '#d97706',
	EXPIRED: '#b45309',
	NONE: '#cbd5e1',
};

export default function TeamsTab({ season, teams, invites, onTeamsChange, onInvitesChange }: TeamsTabProps) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const [showForm, setShowForm] = useState(false);
	const [error, setError] = useState('');
	/** The team being invited for, and the result when the sheet shows a sent invite. */
	const [sheet, setSheet] = useState<{ team: Team; sent?: ManagerInviteSent } | null>(null);

	const inviteFor = useMemo(() => invitesByTarget(invites, 'teamId'), [invites]);
	const stateOf = (team: Team) => managerState(team.managerId ?? team.manager?.id, inviteFor.get(team.id));

	const counts = useMemo(() => {
		const tally: Record<ManagerState, number> = { ACTIVE: 0, INVITED: 0, EXPIRED: 0, NONE: 0 };
		teams.forEach((team) => {
			tally[managerState(team.managerId ?? team.manager?.id, inviteFor.get(team.id))] += 1;
		});
		return tally;
	}, [teams, inviteFor]);

	const handleCreate = async (data: TeamFormData) => {
		setError('');
		try {
			const res = await teamApi.create(season.id, { name: data.name, logo: data.logo });
			onTeamsChange([...teams, res.data]);
			setShowForm(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.teams.createError'));
		}
	};

	const replaceInvite = (invite: ManagerInvite) => {
		onInvitesChange([invite, ...invites.filter((i) => i.teamId !== invite.teamId)]);
	};

	const resend = async (team: Team, invite: ManagerInvite) => {
		setError('');
		try {
			const res = await inviteApi.resend(invite.id);
			replaceInvite(res.data.invite);
			setSheet({ team, sent: res.data });
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('invites.actions.resendError'));
		}
	};

	const cancel = async (invite: ManagerInvite) => {
		setError('');
		try {
			await inviteApi.cancel(invite.id);
			onInvitesChange(invites.filter((i) => i.id !== invite.id));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('invites.actions.cancelError'));
		}
	};

	// After one invite, offer the next team nobody has been asked to run yet.
	const nextUninvited = (current: Team) =>
		teams.find((team) => team.id !== current.id && stateOf(team) === 'NONE') ?? null;

	const statusLine = (team: Team) => {
		const state = stateOf(team);
		const invite = inviteFor.get(team.id);
		if (state === 'ACTIVE') {
			return (
				<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					<Check className="size-3 shrink-0" style={{ color: STATE_COLOR.ACTIVE }} aria-hidden />
					<span className="truncate">{team.manager?.name}</span>
				</span>
			);
		}
		if (state === 'INVITED' && invite) {
			return (
				<span className="truncate text-xs" style={{ color: '#92400e' }}>
					{t('invites.status.invited', { when: sentAgo(invite.sentAt, i18n.language), email: invite.email })}
				</span>
			);
		}
		if (state === 'EXPIRED' && invite) {
			return (
				<span className="truncate text-xs" style={{ color: '#92400e' }}>
					{t('invites.status.expired', { email: invite.email })}
				</span>
			);
		}
		return (
			<span className="text-xs" style={{ color: '#92400e' }}>
				{t('invites.status.noManager')}
			</span>
		);
	};

	const action = (team: Team) => {
		const state = stateOf(team);
		const invite = inviteFor.get(team.id);
		if (state === 'NONE') {
			return (
				<button
					type="button"
					onClick={() => setSheet({ team })}
					className="flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[14px] font-semibold text-white"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					<UserPlus className="size-4" aria-hidden />
					{t('invites.actions.invite')}
				</button>
			);
		}
		if ((state === 'INVITED' || state === 'EXPIRED') && invite) {
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex h-11 shrink-0 items-center gap-1 rounded-[10px] border border-amber-300 bg-amber-50 px-3 text-[13px] font-semibold text-amber-900"
							aria-label={t('invites.actions.menuLabel', { team: team.name })}
						>
							{state === 'EXPIRED' ? t('invites.status.expiredLabel') : t('invites.status.invitedLabel')}
							<ChevronDown className="size-3.5" aria-hidden />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => void resend(team, invite)}>
							<Send className="size-4" aria-hidden />
							{t('invites.actions.resend')}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => void cancel(invite)}>
							{t('invites.actions.cancel')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		}
		return (
			<span className="flex shrink-0 flex-col items-center gap-px">
				<span className="text-[15px] font-semibold tabular-nums">
					{team._count?.players ?? team.players?.length ?? 0}
				</span>
				<span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
					{t('seasonManagement.teams.players')}
				</span>
			</span>
		);
	};

	return (
		<div className="flex flex-col gap-2.5">
			{error && <p className="text-sm text-red-600">{error}</p>}

			{teams.length > 0 && (
				<section
					aria-labelledby="team-managers-title"
					className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm"
				>
					<div className="flex items-baseline justify-between gap-3">
						<h2 id="team-managers-title" className="text-[15px] font-bold">
							{t('invites.summary.title')}
						</h2>
						<span className="text-[13px] font-semibold text-muted-foreground">
							{t('invites.summary.activeOf', { active: counts.ACTIVE, total: teams.length })}
						</span>
					</div>
					<div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
						<div style={{ width: `${(counts.ACTIVE / teams.length) * 100}%`, backgroundColor: STATE_COLOR.ACTIVE }} />
						<div
							style={{
								width: `${((counts.INVITED + counts.EXPIRED) / teams.length) * 100}%`,
								backgroundColor: STATE_COLOR.INVITED,
							}}
						/>
					</div>
					<div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
						<Legend color={STATE_COLOR.ACTIVE} label={t('invites.summary.active', { count: counts.ACTIVE })} />
						<Legend
							color={STATE_COLOR.INVITED}
							label={t('invites.summary.invited', { count: counts.INVITED + counts.EXPIRED })}
						/>
						<Legend color={STATE_COLOR.NONE} label={t('invites.summary.none', { count: counts.NONE })} />
					</div>
				</section>
			)}

			{teams.length === 0 ? (
				<div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
					{t('seasonManagement.teams.empty')}
				</div>
			) : (
				teams.map((team) => {
					const color = team.primaryColor || SEASON_ACCENT;
					return (
						<div
							key={team.id}
							className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm"
							style={{ borderLeft: `4px solid ${color}` }}
						>
							<button
								type="button"
								onClick={() => navigate(`/team-management/${team.id}`)}
								className="flex min-w-0 flex-1 items-center gap-3 text-left"
							>
								<span
									className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] text-sm font-bold text-white"
									style={{ backgroundColor: color }}
								>
									{initials(team.name)}
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate text-[15.5px] font-semibold leading-tight">{team.name}</span>
									{statusLine(team)}
								</span>
								{stateOf(team) === 'ACTIVE' && (
									<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
								)}
							</button>
							{action(team)}
						</div>
					);
				})
			)}

			<button
				onClick={() => setShowForm(true)}
				className="tm-fab"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<Plus className="size-5" aria-hidden />
				{t('seasonManagement.teams.add')}
			</button>

			{showForm && (
				<TeamFormModal
					onSubmit={handleCreate}
					onClose={() => setShowForm(false)}
				/>
			)}

			{sheet && (() => {
				const next = nextUninvited(sheet.team);
				return (
					<InviteManagerSheet
						// A new key per team resets the form when "invite next" moves on.
						key={sheet.team.id}
						target={{ kind: 'TEAM', id: sheet.team.id, name: sheet.team.name }}
						accent={SEASON_ACCENT}
						currentManagerName={sheet.team.manager?.name}
						sent={sheet.sent}
						next={next ? { label: t('invites.sent.inviteNext', { team: next.name }), onClick: () => setSheet({ team: next }) } : null}
						onSent={(result) => replaceInvite(result.invite)}
						onClose={() => setSheet(null)}
					/>
				);
			})()}
		</div>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
			{label}
		</span>
	);
}
