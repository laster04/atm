import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { contactApi } from '@/services/api';
import { getLocale } from '@/utils/date';
import type { SupportTicket, SupportTicketStatus } from '@types';

const STATUSES: SupportTicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'];

/** Messages sent through /contact. Administrators only. */
export default function SupportPage() {
	const { t, i18n } = useTranslation();
	const { isAdmin } = useAuth();
	const [filter, setFilter] = useState<SupportTicketStatus | 'ALL'>('NEW');
	const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
	const [open, setOpen] = useState<string | null>(null);

	useEffect(() => {
		if (!isAdmin()) return;
		setTickets(null);
		contactApi
			.list(filter === 'ALL' ? undefined : filter)
			.then((res) => setTickets(res.data))
			.catch(() => {
				setTickets([]);
				toast.error(t('admin.support.loadError'));
			});
	}, [filter, isAdmin, t]);

	if (!isAdmin()) return <Navigate to="/admin/leagues" replace />;

	const changeStatus = async (ticket: SupportTicket, status: SupportTicketStatus) => {
		try {
			const res = await contactApi.updateStatus(ticket.id, status);
			setTickets((current) =>
				(current ?? [])
					.map((item) => (item.id === ticket.id ? res.data : item))
					.filter((item) => filter === 'ALL' || item.status === filter),
			);
		} catch {
			toast.error(t('admin.support.updateError'));
		}
	};

	const when = (iso: string) =>
		new Date(iso).toLocaleString(getLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' });

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<label htmlFor="support-filter" className="text-sm font-semibold">{t('admin.support.filter')}</label>
				<select
					id="support-filter"
					value={filter}
					onChange={(e) => setFilter(e.target.value as SupportTicketStatus | 'ALL')}
					className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
				>
					<option value="ALL">{t('admin.support.all')}</option>
					{STATUSES.map((status) => (
						<option key={status} value={status}>{t(`admin.support.status.${status}`)}</option>
					))}
				</select>
			</div>

			{tickets === null ? (
				<div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy="true" />
			) : tickets.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
					{t('admin.support.empty')}
				</div>
			) : (
				<ul className="tm-rows-card">
					{tickets.map((ticket) => {
						const expanded = open === ticket.id;
						return (
							<li key={ticket.id} className="flex flex-col gap-2 px-3 py-3">
								<div className="flex flex-wrap items-start gap-3">
									<button
										type="button"
										onClick={() => setOpen(expanded ? null : ticket.id)}
										aria-expanded={expanded}
										className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
									>
										<span className="text-[14.5px] font-semibold">{ticket.subject}</span>
										<span className="text-xs text-muted-foreground">
											{t(`admin.support.category.${ticket.category}`)} · {when(ticket.createdAt)} ·{' '}
											{ticket.user?.name ?? ticket.email ?? t('admin.support.anonymous')}
										</span>
									</button>
									<select
										aria-label={t('admin.support.statusFor', { subject: ticket.subject })}
										value={ticket.status}
										onChange={(e) => changeStatus(ticket, e.target.value as SupportTicketStatus)}
										className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
									>
										{STATUSES.map((status) => (
											<option key={status} value={status}>{t(`admin.support.status.${status}`)}</option>
										))}
									</select>
								</div>
								{expanded && (
									<div className="flex flex-col gap-2 rounded-lg bg-background p-3 text-sm">
										<p className="whitespace-pre-wrap">{ticket.message}</p>
										{(ticket.email || ticket.user) && (
											<p className="text-muted-foreground">
												{t('admin.support.replyTo')}: {ticket.email ?? ticket.user?.email}
											</p>
										)}
										{ticket.context && (
											<p className="break-all text-xs text-muted-foreground">
												{Object.entries(ticket.context).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
											</p>
										)}
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
