import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { registrationApi } from '@/services/api';
import type { MyRegistration, RegistrationStatus } from '@types';

const TONE: Record<RegistrationStatus, { bg: string; fg: string }> = {
	PENDING: { bg: '#dbeafe', fg: '#1e3a8a' },
	WAITLISTED: { bg: '#fef3c7', fg: '#92400e' },
	APPROVED: { bg: '#dcfce7', fg: '#166534' },
	REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
	WITHDRAWN: { bg: '#f1f5f9', fg: '#475569' },
};

/**
 * The signed-in user's applications to seasons and tournaments, so someone
 * who applied can see where it stands and take it back while it waits.
 * Renders nothing for an account that never applied.
 */
export default function MyRegistrationsSection() {
	const { t } = useTranslation();
	const [rows, setRows] = useState<MyRegistration[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		registrationApi.mine().then((res) => setRows(res.data)).catch(() => setRows([]));
	}, []);

	const withdraw = async (row: MyRegistration) => {
		setError('');
		try {
			const res = await registrationApi.withdraw(row.id);
			setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: res.data.status } : r)));
		} catch {
			setError(t('registration.mine.withdrawError'));
		}
	};

	if (rows.length === 0) return null;

	return (
		<section>
			<h2 className="mb-3 text-[20px] font-bold">{t('registration.mine.title')}</h2>
			{error && <p className="mb-2 text-sm text-red-600">{error}</p>}
			<div className="flex flex-col gap-2">
				{rows.map((row) => {
					const tone = TONE[row.status];
					const path = row.competition.kind === 'season' ? `/season-detail/${row.competition.id}` : `/tournament/${row.competition.id}`;
					return (
						<div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
							<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.primaryColor || '#cbd5e1' }} />
							<span className="flex min-w-[10rem] flex-1 flex-col gap-0.5">
								<span className="truncate text-[15px] font-semibold">{row.teamName}</span>
								<Link to={path} className="truncate text-[12px] text-muted-foreground hover:text-primary">{row.competition.name}</Link>
								{row.reason && <span className="text-[12px] text-muted-foreground">{t('registrations.reason', { reason: row.reason })}</span>}
							</span>
							<span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: tone.bg, color: tone.fg }}>
								{t(`registrations.status.${row.status}`)}
							</span>
							{(row.status === 'PENDING' || row.status === 'WAITLISTED') && (
								<button type="button" onClick={() => void withdraw(row)} className="h-9 shrink-0 rounded-lg border border-border px-3 text-[13px] font-semibold">
									{t('registration.mine.withdraw')}
								</button>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
