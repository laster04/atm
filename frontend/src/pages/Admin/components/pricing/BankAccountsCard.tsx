import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi } from '@/services/api';
import type { PaymentCurrency, PricingOverview } from '@types';
import { Card, PrimaryButton, SmallButton } from './shared';

const CURRENCIES: PaymentCurrency[] = ['CZK', 'EUR'];
const field = 'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm';
const label = 'flex flex-col gap-1 text-[13px] font-semibold';

/**
 * The accounts organisers pay ATM's plans to (celek K). A currency without an
 * account is not offered. Only the pricing manager changes them, with a
 * reason for the audit log; payments already created keep their account.
 */
export default function BankAccountsCard({ accounts, canEdit, onChanged }: {
	accounts: PricingOverview['bankAccounts'];
	canEdit: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation();
	const [editing, setEditing] = useState<PaymentCurrency | null>(null);
	const [draft, setDraft] = useState({ iban: '', bic: '', recipient: '', reason: '' });
	const [saving, setSaving] = useState(false);

	const open = (currency: PaymentCurrency) => {
		const current = accounts[currency];
		setDraft({ iban: current?.iban ?? '', bic: current?.bic ?? '', recipient: current?.recipient ?? '', reason: '' });
		setEditing(currency);
	};

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		try {
			await adminApi.setBankAccount(editing, draft);
			toast.success(t('adminShell.pricing.bankAccounts.saved'));
			setEditing(null);
			onChanged();
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('adminShell.pricing.saveError'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Card title={t('adminShell.pricing.bankAccounts.title')}>
			<div className="flex flex-col gap-3 px-4 py-3.5">
				<p className="text-[13px] leading-snug text-muted-foreground">{t('adminShell.pricing.bankAccounts.hint')}</p>
				{CURRENCIES.map((currency) => {
					const account = accounts[currency];
					return (
						<div key={currency} className="flex flex-col gap-2 rounded-lg border border-border p-3">
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-extrabold">{currency}</span>
								{canEdit && editing !== currency && (
									<SmallButton onClick={() => open(currency)}>{t('adminShell.pricing.bankAccounts.change')}</SmallButton>
								)}
							</div>
							{editing === currency ? (
								<form
									className="flex flex-col gap-2"
									onSubmit={(event) => { event.preventDefault(); void save(); }}
								>
									<label className={label}>IBAN<input className={field} value={draft.iban} onChange={(e) => setDraft({ ...draft, iban: e.target.value })} required /></label>
									<label className={label}>BIC<input className={field} value={draft.bic} onChange={(e) => setDraft({ ...draft, bic: e.target.value })} required /></label>
									<label className={label}>
										{t('adminShell.pricing.bankAccounts.recipient')}
										<input className={field} value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} required />
									</label>
									<label className={label}>
										{t('adminShell.confirm.reasonRequired')}
										<input className={field} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} required />
									</label>
									<div className="flex gap-2">
										<SmallButton onClick={() => setEditing(null)}>{t('common.cancel')}</SmallButton>
										<PrimaryButton disabled={saving}>{t('common.save')}</PrimaryButton>
									</div>
								</form>
							) : account ? (
								<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
									{account.local !== account.iban && (<><dt className="text-muted-foreground">{t('plans.payment.account')}</dt><dd className="font-semibold tabular-nums">{account.local}</dd></>)}
									<dt className="text-muted-foreground">IBAN</dt><dd className="font-semibold tabular-nums break-all">{account.iban}</dd>
									<dt className="text-muted-foreground">BIC</dt><dd className="font-semibold">{account.bic}</dd>
									<dt className="text-muted-foreground">{t('adminShell.pricing.bankAccounts.recipient')}</dt><dd className="font-semibold">{account.recipient}</dd>
								</dl>
							) : (
								<p className="text-[13px] font-semibold text-red-700">{t('adminShell.pricing.bankAccounts.missing')}</p>
							)}
						</div>
					);
				})}
			</div>
		</Card>
	);
}
