import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/services/api';
import type { PlanPayment } from '@types';
import DataList, { type ListColumn, type ListFilter } from '../components/list/DataList';
import DetailPanel, { PanelFacts } from '../components/list/DetailPanel';
import ConfirmDialog from '../components/list/ConfirmDialog';
import { useListParams } from '../components/list/useListParams';
import { AuditTrail } from '../components/audit/AuditChanges';
import { formatInstant } from '../components/format';
import { formatMoney } from '../components/pricing/money';
import { ADMIN_GOLD, ADMIN_INK } from '../components/util';

const STATUSES = ['PENDING', 'PAID', 'CANCELLED'] as const;
const PRODUCTS = ['TOURNAMENT', 'TOURNAMENT_PLUS', 'ORGANIZER_YEAR'] as const;

const STATUS_TONE: Record<PlanPayment['status'], string> = {
	PENDING: 'bg-amber-100 text-amber-900',
	PAID: 'bg-emerald-100 text-emerald-900',
	CANCELLED: 'bg-slate-100 text-slate-600',
};

interface Decision {
	action: 'confirm' | 'cancel';
	ids: string[];
	resolve?: (changed: boolean) => void;
}

/**
 * QR transfers for plans. Confirming one applies the plan it paid for; the
 * tax document and the e-mail to the organiser arrive with B4.
 */
export default function PaymentsPage() {
	const { t, i18n } = useTranslation();
	const { openId, setOpenId } = useListParams();
	const [open, setOpen] = useState<PlanPayment | null>(null);
	const [deciding, setDeciding] = useState<Decision | null>(null);
	const [reload, setReload] = useState(0);

	const status = (value: PlanPayment['status']) => t(`adminShell.payments.status.${value}`);
	const product = (code: string) => t(`adminShell.payments.products.${code}`, code);
	const money = (row: PlanPayment, minor: number) => formatMoney(minor, row.currency, i18n.language);

	const columns: ListColumn<PlanPayment>[] = [
		{ key: 'variableSymbol', label: t('adminShell.payments.variableSymbol'), sort: 'variableSymbol', className: 'tabular-nums font-semibold', render: (row) => row.variableSymbol },
		{ key: 'payer', label: t('adminShell.payments.customer'), render: (row) => (
			<span className="flex flex-col">
				<span className="font-semibold">{row.tournament?.name ?? '—'}</span>
				<span className="text-xs text-muted-foreground">{row.payer?.email ?? ''}</span>
			</span>
		) },
		{ key: 'product', label: t('adminShell.payments.product'), render: (row) => product(row.productCode) },
		{ key: 'amount', label: t('adminShell.payments.amount'), sort: 'amount', align: 'right', className: 'tabular-nums', render: (row) => money(row, row.amount) },
		{ key: 'vat', label: t('adminShell.payments.vat'), align: 'right', className: 'tabular-nums text-muted-foreground', render: (row) => money(row, row.vat) },
		{ key: 'status', label: t('adminShell.payments.statusLabel'), render: (row) => (
			<span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_TONE[row.status]}`}>{status(row.status)}</span>
		) },
		{ key: 'createdAt', label: t('adminShell.payments.created'), sort: 'createdAt', className: 'whitespace-nowrap tabular-nums', render: (row) => formatInstant(row.createdAt, i18n.language) },
		{ key: 'document', label: t('adminShell.payments.document'), className: 'tabular-nums text-muted-foreground', render: (row) => row.document?.number ?? '' },
	];

	const filters: ListFilter[] = [
		{ key: 'status', label: t('adminShell.payments.statusLabel'), type: 'select', options: STATUSES.map((value) => ({ value, label: status(value) })) },
		{ key: 'product', label: t('adminShell.payments.product'), type: 'select', options: PRODUCTS.map((value) => ({ value, label: product(value) })) },
		{ key: 'currency', label: t('adminShell.payments.currency'), type: 'select', options: [{ value: 'CZK', label: 'CZK' }, { value: 'EUR', label: 'EUR' }] },
		{ key: 'created', label: t('adminShell.payments.period'), type: 'dateRange' },
	];

	const ask = (action: Decision['action']) => (ids: string[]) =>
		new Promise<boolean>((resolve) => setDeciding({ action, ids, resolve }));

	const download = async (payment: PlanPayment) => {
		try {
			const res = await adminApi.paymentDocument(payment.id);
			window.open(res.data.url, '_blank', 'noopener');
		} catch {
			toast.error(t('adminShell.payments.documentError'));
		}
	};

	const decide = async (decision: Decision, reason: string) => {
		const call = decision.action === 'confirm' ? adminApi.confirmPayments : adminApi.cancelPayments;
		try {
			const res = await call(decision.ids, reason || undefined);
			const { done, skipped } = res.data;
			if (done.length) toast.success(t(`adminShell.payments.${decision.action}ed`, { count: done.length }));
			if (skipped.length) toast.error(t('adminShell.payments.skipped', { count: skipped.length }));
			decision.resolve?.(done.length > 0);
			if (!decision.resolve) setReload((n) => n + 1);
			if (open && done.includes(open.id)) { setOpen(null); setOpenId(null); }
		} catch (error) {
			toast.error(t('adminShell.payments.decideError'));
			throw error;
		}
	};

	return (
		<div className="flex flex-wrap items-start gap-4">
			<div className="min-w-0 flex-[999_1_560px]">
				<DataList
					columns={columns}
					filters={filters}
					load={(query) => adminApi.payments(query).then((res) => res.data)}
					exportCsv={adminApi.exportPayments}
					defaultSort={{ sort: 'createdAt', dir: 'desc' }}
					searchLabel={t('adminShell.payments.search')}
					searchPlaceholder={t('adminShell.payments.searchPlaceholder')}
					bulkActions={[
						{ key: 'confirm', label: t('adminShell.payments.confirm'), tone: 'primary', run: ask('confirm') },
						{ key: 'cancel', label: t('adminShell.payments.cancel'), tone: 'danger', run: ask('cancel') },
					]}
					onOpen={(row) => { setOpen(row); setOpenId(row.id); }}
					activeId={openId}
					reloadToken={reload}
					rowLabel={(row) => String(row.variableSymbol)}
					empty={t('adminShell.payments.empty')}
					onLoad={(rows) => {
						if (openId && open?.id !== openId) setOpen(rows.find((row) => row.id === openId) ?? null);
					}}
				/>
			</div>
			{openId && open?.id === openId && (
				<DetailPanel
					key={open.id}
					kicker={`${t('adminShell.payments.kicker')} · VS ${open.variableSymbol}`}
					title={`${product(open.productCode)}${open.tournament ? ` · ${open.tournament.name}` : ''}`}
					onClose={() => { setOpenId(null); setOpen(null); }}
					tabs={[
						{
							key: 'overview',
							label: t('adminShell.panel.overview'),
							content: (
								<PanelFacts rows={[
									{ label: t('adminShell.payments.statusLabel'), value: status(open.status) },
									{ label: t('adminShell.payments.payer'), value: open.payer ? `${open.payer.name} · ${open.payer.email}` : '—' },
									...(open.tournament ? [{
										label: t('adminShell.payments.tournament'),
										value: <Link to={`/tournament-management/tournament/${open.tournament.id}`} className="underline">{open.tournament.name}</Link>,
									}] : []),
									{ label: t('adminShell.payments.amount'), value: money(open, open.amount) },
									{ label: t('adminShell.payments.base'), value: money(open, open.base) },
									{ label: t('adminShell.payments.vatRate', { rate: open.vatRateBp / 100 }), value: money(open, open.vat) },
									...(open.upgradeFrom ? [{ label: t('adminShell.payments.upgradeFrom'), value: product(open.upgradeFrom) }] : []),
									{ label: t('adminShell.payments.account'), value: open.account ? `${open.account.recipient} · ${open.account.local}` : '—' },
									{ label: t('adminShell.payments.created'), value: formatInstant(open.createdAt, i18n.language) },
									...(open.confirmedAt ? [{
										label: t('adminShell.payments.confirmedAt'),
										value: `${formatInstant(open.confirmedAt, i18n.language)}${open.confirmedBy ? ` · ${open.confirmedBy.email}` : ''}`,
									}] : []),
									...(open.cancelledAt ? [{ label: t('adminShell.payments.cancelledAt'), value: formatInstant(open.cancelledAt, i18n.language) }] : []),
									...(open.document ? [{
										label: t('adminShell.payments.document'),
										value: (
											<span className="flex flex-col gap-1">
												<span>{t(`adminShell.payments.documentKind.${open.document.kind}`)} {open.document.number}</span>
												<span className="text-xs font-normal text-muted-foreground">
													{open.document.emailedAt
														? t('adminShell.payments.documentEmailed', { when: formatInstant(open.document.emailedAt, i18n.language) })
														: t('adminShell.payments.documentNotEmailed')}
												</span>
												<button type="button" onClick={() => void download(open)} className="self-start text-sm font-semibold underline underline-offset-2">
													{t('adminShell.payments.downloadDocument')}
												</button>
											</span>
										),
									}] : []),
								]} />
							),
						},
						{ key: 'history', label: t('adminShell.panel.history'), content: <AuditTrail entityType="Payment" entityId={open.id} /> },
					]}
					footer={open.status === 'PENDING' && (
						<div className="flex flex-wrap gap-2">
							<button type="button" onClick={() => setDeciding({ action: 'confirm', ids: [open.id] })} className="h-11 flex-1 rounded-lg px-4 text-sm font-extrabold" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
								{t('adminShell.payments.confirm')}
							</button>
							<button type="button" onClick={() => setDeciding({ action: 'cancel', ids: [open.id] })} className="h-11 rounded-lg border px-4 text-sm font-bold">
								{t('adminShell.payments.cancel')}
							</button>
						</div>
					)}
				/>
			)}
			{deciding && (
				<ConfirmDialog
					title={t(`adminShell.payments.${deciding.action}Title`, { count: deciding.ids.length })}
					description={t(`adminShell.payments.${deciding.action}Hint`, { count: deciding.ids.length })}
					confirmLabel={t(`adminShell.payments.${deciding.action}`)}
					reason="optional"
					tone={deciding.action === 'cancel' ? 'danger' : 'default'}
					onConfirm={(reason) => decide(deciding, reason)}
					onClose={() => {
						deciding.resolve?.(false);
						setDeciding(null);
					}}
				/>
			)}
		</div>
	);
}
