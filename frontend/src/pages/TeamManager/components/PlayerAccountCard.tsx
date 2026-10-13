import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2Off, Send, UserRound } from 'lucide-react';
import { AxiosError } from 'axios';
import { inviteApi, playerApi } from '@/services/api';
import InviteManagerSheet from '@/components/invite/InviteManagerSheet';
import { sentAgo } from '@/components/invite/inviteState';
import type { ManagerInvite, ManagerInviteSent, Player } from '@types';

interface PlayerAccountCardProps {
	player: Player;
	teamName: string;
	accent: string;
	/** Opens the invite sheet straight away, e.g. when the checklist sent us here. */
	autoInvite?: boolean;
	onChanged: (player: Player) => void;
}

/**
 * Connects a roster row to the account of the person who holds it, so a player
 * who manages nothing still has somewhere to sign in to.
 *
 * The manager invites the player by email; the link is made when they accept,
 * creating their account or signing in on the way. Unlinking only removes the
 * connection - the roster row, the number and the games all stay.
 */
export default function PlayerAccountCard({ player, teamName, accent, autoInvite = false, onChanged }: PlayerAccountCardProps) {
	const { t, i18n } = useTranslation();
	const [invite, setInvite] = useState<ManagerInvite | null>(null);
	const [sheet, setSheet] = useState<{ sent?: ManagerInviteSent } | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (player.userId) return;
		let cancelled = false;
		inviteApi.getForPlayer(player.id)
			.then((res) => {
				if (cancelled) return;
				setInvite(res.data);
				if (autoInvite && !res.data) setSheet({});
			})
			.catch(() => !cancelled && setInvite(null));
		return () => { cancelled = true; };
	}, [player.id, player.userId, autoInvite]);

	const run = async (action: () => Promise<void>, fallback: string) => {
		setError('');
		setBusy(true);
		try {
			await action();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t(fallback));
		} finally {
			setBusy(false);
		}
	};

	const unlink = () => run(async () => {
		onChanged((await playerApi.unlinkAccount(player.id)).data);
	}, 'teamManagement.account.error');

	const resend = () => run(async () => {
		if (!invite) return;
		const res = await inviteApi.resend(invite.id);
		setInvite(res.data.invite);
		setSheet({ sent: res.data });
	}, 'invites.actions.resendError');

	const cancel = () => run(async () => {
		if (!invite) return;
		await inviteApi.cancel(invite.id);
		setInvite(null);
	}, 'invites.actions.cancelError');

	let content;
	if (player.userId) {
		content = (
			<>
				<div className="flex items-center gap-2.5">
					<span
						className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
						style={{ backgroundColor: accent }}
					>
						<UserRound className="size-4" aria-hidden />
					</span>
					<span className="flex min-w-0 flex-1 flex-col gap-px">
						<span className="truncate text-[14.5px] font-semibold">
							{player.user?.name ?? t('teamManagement.account.linked')}
						</span>
						{player.user?.email && (
							<span className="truncate text-[12px] text-muted-foreground">{player.user.email}</span>
						)}
					</span>
				</div>
				<button
					onClick={() => void unlink()}
					disabled={busy}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold disabled:opacity-60"
				>
					<Link2Off className="size-4" aria-hidden />
					{t('teamManagement.account.unlink')}
				</button>
			</>
		);
	} else if (invite) {
		const expired = invite.status === 'EXPIRED';
		content = (
			<>
				<p className={`text-[13px] leading-snug ${expired ? 'text-amber-800' : 'text-muted-foreground'}`}>
					{expired
						? t('invites.status.expired', { email: invite.email })
						: t('invites.status.invited', { when: sentAgo(invite.sentAt, i18n.language), email: invite.email })}
				</p>
				<div className="flex gap-2">
					<button
						onClick={() => void resend()}
						disabled={busy}
						className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-60"
						style={{ backgroundColor: accent }}
					>
						<Send className="size-4" aria-hidden />
						{t('invites.actions.resend')}
					</button>
					<button
						onClick={() => void cancel()}
						disabled={busy}
						className="h-11 shrink-0 rounded-[10px] border border-border px-3.5 text-[14px] font-semibold disabled:opacity-60"
					>
						{t('invites.actions.cancel')}
					</button>
				</div>
			</>
		);
	} else {
		content = (
			<>
				<p className="text-[12.5px] leading-snug text-muted-foreground">{t('teamManagement.account.hint')}</p>
				<button
					onClick={() => setSheet({})}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white"
					style={{ backgroundColor: accent }}
				>
					<Send className="size-4" aria-hidden />
					{t('teamManagement.account.invite')}
				</button>
			</>
		);
	}

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5">
			<span className="tm-section-label">{t('teamManagement.account.title')}</span>
			{content}
			{error && <p className="text-sm text-red-600">{error}</p>}

			{sheet && (
				<InviteManagerSheet
					target={{ kind: 'PLAYER', id: player.id, name: teamName }}
					accent={accent}
					defaultName={player.name}
					sent={sheet.sent ?? null}
					onSent={(result) => setInvite(result.invite)}
					onClose={() => setSheet(null)}
				/>
			)}
		</div>
	);
}
