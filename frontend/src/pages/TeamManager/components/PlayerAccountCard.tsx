import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Link2Off, UserRound } from 'lucide-react';
import { AxiosError } from 'axios';
import { playerApi } from '@/services/api';
import type { Player } from '@types';

interface PlayerAccountCardProps {
	player: Player;
	accent: string;
	onChanged: (player: Player) => void;
}

/**
 * Connects a roster row to the account of the person who holds it, so a player
 * who manages nothing still has somewhere to sign in to.
 *
 * The account has to exist already: the manager types the address the player
 * registered with. Nothing is created here, and unlinking only removes the
 * connection - the roster row, the number and the games all stay.
 */
export default function PlayerAccountCard({ player, accent, onChanged }: PlayerAccountCardProps) {
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const run = async (action: () => Promise<{ data: Player }>) => {
		setError('');
		setBusy(true);
		try {
			const res = await action();
			onChanged(res.data);
			setEmail('');
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('teamManagement.account.error'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5">
			<span className="tm-section-label">{t('teamManagement.account.title')}</span>

			{player.userId ? (
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
						onClick={() => void run(() => playerApi.unlinkAccount(player.id))}
						disabled={busy}
						className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold disabled:opacity-60"
					>
						<Link2Off className="size-4" aria-hidden />
						{t('teamManagement.account.unlink')}
					</button>
				</>
			) : (
				<>
					<p className="text-[12.5px] leading-snug text-muted-foreground">
						{t('teamManagement.account.hint')}
					</p>
					<div className="flex gap-2">
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t('teamManagement.account.emailPlaceholder')}
							className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
						/>
						<button
							onClick={() => void run(() => playerApi.linkAccount(player.id, email))}
							disabled={busy || !email.trim()}
							className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-[14.5px] font-semibold text-white disabled:opacity-60"
							style={{ backgroundColor: accent }}
						>
							<Link2 className="size-4" aria-hidden />
							{t('teamManagement.account.link')}
						</button>
					</div>
				</>
			)}

			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}
