import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuth } from '../../../context/AuthContext';

/**
 * The only way to turn the round summary off, so the mail can honestly say it
 * exists. Transactional mail - activation, password resets, invitations - is not
 * covered by it and never should be.
 */
export default function EmailPreferenceCard() {
	const { t } = useTranslation();
	const { user } = useAuth();
	const [enabled, setEnabled] = useState(user?.emailDigest !== false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	if (!user) return null;

	const toggle = async () => {
		const next = !enabled;
		// Moved first so the switch answers immediately, and put back if the save
		// fails rather than leaving the screen disagreeing with the server.
		setEnabled(next);
		setSaving(true);
		setError('');
		try {
			await authApi.updateProfile({ emailDigest: next });
		} catch {
			setEnabled(!next);
			setError(t('home.emailPrefs.error'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
			<Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[14.5px] font-semibold">{t('home.emailPrefs.title')}</span>
				<span className="text-[12.5px] text-muted-foreground">{t('home.emailPrefs.hint')}</span>
				{error && <span className="text-[12.5px] text-red-600">{error}</span>}
			</span>
			<button
				role="switch"
				aria-checked={enabled}
				aria-label={t('home.emailPrefs.title')}
				disabled={saving}
				onClick={() => void toggle()}
				className="h-7 w-12 shrink-0 rounded-full border border-border p-0.5 disabled:opacity-60"
				style={enabled ? { backgroundColor: '#003E7E', borderColor: '#003E7E' } : undefined}
			>
				<span
					className="block size-6 rounded-full bg-white shadow-sm transition-transform"
					style={enabled ? { transform: 'translateX(20px)' } : undefined}
				/>
			</button>
		</div>
	);
}
