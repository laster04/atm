import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi } from '@/services/api';
import type { PricingOverview } from '@types';
import ConfirmDialog from '../list/ConfirmDialog';
import { countryName, formatMoney, formatRate, splitGross, toMinor } from './money';
import { Card, PrimaryButton, inputClass, labelClass } from './shared';
import { formatDay } from '../format';

type Product = PricingOverview['products'][number];

interface PriceFormProps {
	product: Product;
	vatRates: PricingOverview['vatRates'];
	ossEnabled: boolean;
	onSaved: () => void;
	onCancel: () => void;
}

const minorToText = (minor: number | undefined) => (minor === undefined ? '' : String(minor / 100).replace('.', ','));

/**
 * Plans a new price for one product. Shows the VAT split for every rate on
 * file before saving, and what the change will and will not touch.
 */
export default function PriceForm({ product, vatRates, ossEnabled, onSaved, onCancel }: PriceFormProps) {
	const { t, i18n } = useTranslation();
	const [czk, setCzk] = useState(minorToText(product.current?.priceCzk));
	const [eur, setEur] = useState(minorToText(product.current?.priceEur));
	const [validFrom, setValidFrom] = useState('');
	const [confirming, setConfirming] = useState(false);

	const czkMinor = toMinor(czk);
	const eurMinor = toMinor(eur);
	const name = i18n.language.startsWith('cs') ? product.nameCs : product.nameEn;
	const when = validFrom ? t('adminShell.pricing.from', { when: formatDay(`${validFrom}T12:00:00`, i18n.language) }) : t('adminShell.pricing.now');

	const previews = vatRates.filter((rate) => rate.current).map((rate) => {
		const currency = rate.country === 'CZ' ? 'CZK' : 'EUR';
		const gross = currency === 'CZK' ? czkMinor : eurMinor;
		if (!gross || !rate.current) return null;
		const { base, vat } = splitGross(gross, rate.current.rateBp);
		return {
			country: rate.country,
			text: t('adminShell.pricing.split', {
				country: countryName(rate.country, i18n.language),
				rate: formatRate(rate.current.rateBp, i18n.language),
				base: formatMoney(base, currency, i18n.language),
				vat: formatMoney(vat, currency, i18n.language),
			}),
			note: rate.country === 'CZ' ? null : t(ossEnabled ? 'adminShell.pricing.ossOn' : 'adminShell.pricing.ossOff'),
		};
	}).filter(Boolean) as { country: string; text: string; note: string | null }[];

	const save = async () => {
		try {
			await adminApi.createPrice(product.code, { priceCzk: czkMinor!, priceEur: eurMinor!, validFrom: validFrom || null });
			toast.success(t('adminShell.pricing.priceSaved'));
			onSaved();
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('adminShell.pricing.saveError'));
			throw error;
		}
	};

	return (
		<Card title={t('adminShell.pricing.newPrice')} accent>
			<form
				className="flex flex-col gap-3 px-4 py-3.5"
				onSubmit={(event) => { event.preventDefault(); if (czkMinor && eurMinor) setConfirming(true); }}
			>
				<h3 className="text-lg font-extrabold">{name}</h3>
				<div className="flex flex-wrap gap-2.5">
					<label className={`${labelClass} flex-[1_1_120px]`}>
						{t('adminShell.pricing.czk')}
						<input inputMode="decimal" value={czk} onChange={(event) => setCzk(event.target.value)} className={inputClass} aria-invalid={!czkMinor} />
					</label>
					<label className={`${labelClass} flex-[1_1_120px]`}>
						{t('adminShell.pricing.eur')}
						<input inputMode="decimal" value={eur} onChange={(event) => setEur(event.target.value)} className={inputClass} aria-invalid={!eurMinor} />
					</label>
				</div>
				<label className={labelClass}>
					{t('adminShell.pricing.validFrom')}
					<input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className={inputClass} />
					<span className="font-normal">{t('adminShell.pricing.validFromHint')}</span>
				</label>

				{previews.length > 0 && (
					<div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-snug">
						{previews.map((preview) => (
							<span key={preview.country}>
								{preview.text}
								{preview.note && <span className="text-muted-foreground"> {preview.note}</span>}
							</span>
						))}
					</div>
				)}
				<p className="rounded-lg bg-[#FFF8E1] px-3 py-2.5 text-[13px] leading-snug text-[#334155]">
					{t('adminShell.pricing.priceScope', { when })}
				</p>
				<div className="flex flex-wrap gap-2">
					<PrimaryButton disabled={!czkMinor || !eurMinor}>{t('adminShell.pricing.schedule')}</PrimaryButton>
					<button type="button" onClick={onCancel} className="h-11 rounded-lg border border-border px-4 text-sm font-bold">{t('common.cancel')}</button>
				</div>
			</form>

			{confirming && czkMinor && eurMinor && (
				<ConfirmDialog
					title={t('adminShell.pricing.confirmPriceTitle', { name })}
					description={t('adminShell.pricing.confirmPrice', {
						czk: formatMoney(czkMinor, 'CZK', i18n.language),
						eur: formatMoney(eurMinor, 'EUR', i18n.language),
						when,
					})}
					confirmLabel={t('adminShell.pricing.schedule')}
					onConfirm={save}
					onClose={() => setConfirming(false)}
				/>
			)}
		</Card>
	);
}
