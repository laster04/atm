import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, UserPlus } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { inviteApi } from '@/services/api';
import InviteManagerSheet from '@/components/invite/InviteManagerSheet';
import { sentAgo } from '@/components/invite/inviteState';
import { SEASON_ACCENT } from '@/pages/SeasonManager/components/util';
import TeamColorPicker from './TeamColorPicker';
import TeamChatCard from './TeamChatCard';
import type { ManagerInvite, ManagerInviteSent, Standing, Team } from '@types';

interface SettingsTabProps {
	team: Team;
	standing?: Standing;
	onColorChange: (color: string | null) => void;
}

export default function SettingsTab({
	team,
	standing,
	onColorChange,
}: SettingsTabProps) {
	const { t, i18n } = useTranslation();
	const { isAdmin, isSeasonManager, user } = useAuth();
	// Naming the manager is the season side's call. The team's own manager may
	// also run some other league, so the server's answer decides, not the badge.
	const mayInvite = isAdmin() || (isSeasonManager() && user?.id !== team.managerId);
	const [canInvite, setCanInvite] = useState(false);
	const [invite, setInvite] = useState<ManagerInvite | null>(null);
	const [sheet, setSheet] = useState<{ sent?: ManagerInviteSent } | null>(null);
	const [inviteError, setInviteError] = useState('');

	useEffect(() => {
		if (!mayInvite) return;
		inviteApi.getForTeam(team.id)
			.then((res) => {
				setInvite(res.data);
				setCanInvite(true);
			})
			.catch(() => setCanInvite(false));
	}, [team.id, mayInvite]);

	const resend = async () => {
		if (!invite) return;
		setInviteError('');
		try {
			const res = await inviteApi.resend(invite.id);
			setInvite(res.data.invite);
			setSheet({ sent: res.data });
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setInviteError(axiosError.response?.data?.error || t('invites.actions.resendError'));
		}
	};

	const cancel = async () => {
		if (!invite) return;
		setInviteError('');
		try {
			await inviteApi.cancel(invite.id);
			setInvite(null);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setInviteError(axiosError.response?.data?.error || t('invites.actions.cancelError'));
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="settings-header">
				<h3 className="settings-title">{t('teamManagement.pwa.teamSettings')}</h3>
				<p className="settings-subtitle">
					{t('teamManagement.pwa.customizeBranding')}
				</p>
			</div>

			<TeamColorPicker
				teamId={team.id}
				teamName={team.name}
				initialColor={team.primaryColor}
				points={standing?.points}
				onColorChange={onColorChange}
			/>

			<TeamChatCard teamId={team.id} initialUrl={team.chatUrl} />

			{/* Team Info */}
			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('teamManagement.pwa.teamInfo')}</span>
				<div className="tm-rows-card">
					{[
						{ label: t('teamManagement.pwa.teamName'), value: team.name },
						...(team.season ? [{ label: t('teamManagement.pwa.season'), value: team.season.name }] : []),
						{ label: t('teamManagement.pwa.manager'), value: team.manager?.name || '—' },
						{
							label: t('teamManagement.pwa.seasonRecord'),
							value: standing ? `${standing.wins}-${standing.draws}-${standing.losses}` : '—',
						},
						{ label: t('teamManagement.pwa.totalPoints'), value: String(standing?.points ?? 0) },
					].map((row) => (
						<div key={row.label} className="flex min-h-12 items-center gap-3 px-3.5 py-2.5">
							<span className="shrink-0 text-sm text-muted-foreground">{row.label}</span>
							<span className="ml-auto min-w-0 truncate text-right text-sm font-medium">
								{row.value}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* The team's manager - for the season side only */}
			{canInvite && (
				<div className="flex flex-col gap-2">
					<span className="tm-section-label">{t('invites.teamCard.title')}</span>
					<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
						<p className="text-sm">
							{team.manager
								? t('invites.teamCard.current', { name: team.manager.name, email: team.manager.email })
								: t('invites.status.noManager')}
						</p>
						{invite && (
							<div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
								<p className="text-[13px] leading-snug text-amber-900">
									{invite.status === 'EXPIRED'
										? t('invites.status.expired', { email: invite.email })
										: t('invites.status.invited', { when: sentAgo(invite.sentAt, i18n.language), email: invite.email })}
								</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => void resend()}
										className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-card text-[13px] font-semibold"
									>
										<Send className="size-3.5" aria-hidden />
										{t('invites.actions.resend')}
									</button>
									<button
										type="button"
										onClick={() => void cancel()}
										className="h-10 flex-1 rounded-lg text-[13px] font-semibold text-amber-900"
									>
										{t('invites.actions.cancel')}
									</button>
								</div>
							</div>
						)}
						<button
							type="button"
							onClick={() => setSheet({})}
							className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white"
							style={{ backgroundColor: SEASON_ACCENT }}
						>
							<UserPlus className="size-4" aria-hidden />
							{team.manager ? t('invites.teamCard.change') : t('invites.actions.inviteManager')}
						</button>
						{inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
					</div>
				</div>
			)}

			{sheet && (
				<InviteManagerSheet
					target={{ kind: 'TEAM', id: team.id, name: team.name }}
					accent={SEASON_ACCENT}
					currentManagerName={team.manager?.name}
					sent={sheet.sent}
					onSent={(result) => setInvite(result.invite)}
					onClose={() => setSheet(null)}
				/>
			)}
		</div>
	);
}
