import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { billingApi } from '@/services/api';
import type { CompanyLookup, VatCheckResult } from '@types';
import { Card, SmallButton, inputClass } from './shared';
import { formatInstant } from '../format';

type Result =
	| { kind: 'vat'; check: VatCheckResult }
	| { kind: 'company'; company: CompanyLookup }
	| { kind: 'error'; message: string };

/**
 * Asks VIES about a VAT ID or ARES about an IČO, the same lookups the billing
 * form makes in celek B. Useful for an admin answering a customer.
 */
export default function LookupCard() {
	const { t, i18n } = useTranslation();
	const [value, setValue] = useState('');
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<Result | null>(null);

	const run = async () => {
		const input = value.trim();
		if (!input) return;
		setBusy(true);
		setResult(null);
		try {
			if (/^\d[\d\s]{6,}$/.test(input)) {
				const res = await billingApi.company(input.replace(/\s/g, ''));
				setResult({ kind: 'company', company: res.data });
			} else {
				const res = await billingApi.vatCheck(input);
				setResult({ kind: 'vat', check: res.data });
			}
		} catch (error) {
			const code = (error as AxiosError<{ code?: string }>).response?.data?.code;
			setResult({ kind: 'error', message: t(`adminShell.pricing.lookupErrors.${code ?? 'failed'}`, t('adminShell.pricing.lookupErrors.failed')) });
		} finally {
			setBusy(false);
		}
	};

	const statusTone = { VALID: 'bg-[#DCFCE7] text-[#14532D]', INVALID: 'bg-[#FEE2E2] text-[#991B1B]', UNAVAILABLE: 'bg-[#FFF1C2] text-[#7C5A00]' };

	return (
		<Card title={t('adminShell.pricing.lookup')}>
			<form className="flex flex-col gap-3 px-4 py-3.5" onSubmit={(event) => { event.preventDefault(); void run(); }}>
				<p className="text-[13px] leading-snug text-muted-foreground">{t('adminShell.pricing.lookupHint')}</p>
				<div className="flex gap-2">
					<input
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder="SK2020123456 / 00006947"
						aria-label={t('adminShell.pricing.lookup')}
						className={`${inputClass} min-w-0 flex-1 font-normal`}
					/>
					<SmallButton onClick={() => void run()} disabled={busy || !value.trim()}>
						{busy ? <Loader2 className="size-4 animate-spin" aria-label={t('common.loading')} /> : t('adminShell.pricing.lookupRun')}
					</SmallButton>
				</div>

				{result?.kind === 'error' && <p className="text-[13px] text-destructive">{result.message}</p>}
				{result?.kind === 'vat' && (
					<div className="flex flex-col gap-1 text-[13px]">
						<span className={`self-start rounded-md px-2 py-0.5 text-xs font-bold ${statusTone[result.check.status]}`}>
							{t(`adminShell.pricing.vatStatus.${result.check.status}`)}
						</span>
						<span className="font-semibold">{result.check.countryCode}{result.check.vatNumber}</span>
						{result.check.name && <span>{result.check.name}</span>}
						{result.check.address && <span className="whitespace-pre-line text-muted-foreground">{result.check.address}</span>}
						<span className="text-muted-foreground">
							{t('adminShell.pricing.checkedAt', { when: formatInstant(result.check.checkedAt, i18n.language) })}
							{result.check.requestIdentifier && ` · ${t('adminShell.pricing.consultation', { id: result.check.requestIdentifier })}`}
						</span>
					</div>
				)}
				{result?.kind === 'company' && (
					<div className="flex flex-col gap-1 text-[13px]">
						<span className="font-semibold">{result.company.name}</span>
						<span>{t('adminShell.pricing.ico', { ico: result.company.ico })}{result.company.vatId && ` · ${t('adminShell.pricing.dic', { dic: result.company.vatId })}`}</span>
						{result.company.address.text && <span className="text-muted-foreground">{result.company.address.text}</span>}
					</div>
				)}
			</form>
		</Card>
	);
}
