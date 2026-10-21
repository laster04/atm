import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi } from '@/services/api';
import type { PricingOverview } from '@types';
import ConfirmDialog from '../components/list/ConfirmDialog';
import PriceForm from '../components/pricing/PriceForm';
import OssCard from '../components/pricing/OssCard';
import LookupCard from '../components/pricing/LookupCard';
import { countryName, formatMoney, formatRate } from '../components/pricing/money';
import { Card, PrimaryButton, SmallButton, inputClass, labelClass, useFromDay } from '../components/pricing/shared';
import { formatDay } from '../components/format';

const errorText = (error: unknown, fallback: string) =>
	(error as AxiosError<{ error?: string }>).response?.data?.error ?? fallback;

/**
 * Prices, VAT rates, plan limits and OSS (canvas page 16). Every change is a
 * new dated version; issued payments keep what they were created with.
 */
export default function PricingPage() {
	const { t, i18n } = useTranslation();
	const fromDay = useFromDay();
	const [data, setData] = useState<PricingOverview | null>(null);
	const [failed, setFailed] = useState(false);
	const [editingProduct, setEditingProduct] = useState<string | null>(null);
	const [addingRate, setAddingRate] = useState(false);
	const [editingLimits, setEditingLimits] = useState(false);
	const [withdraw, setWithdraw] = useState<{ kind: 'price' | 'rate'; id: string; label: string } | null>(null);

	const load = useCallback(() => {
		adminApi.pricing()
			.then((res) => setData(res.data))
			.catch((error) => {
				console.error(error);
				setFailed(true);
			});
	}, []);
	useEffect(load, [load]);

	if (failed) return <p className="text-sm text-destructive">{t('adminShell.list.loadError')}</p>;
	if (!data) return <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t('common.loading')} />;

	const czech = i18n.language.startsWith('cs');
	const product = data.products.find((row) => row.code === editingProduct);
	const money = (minor: number, currency: 'CZK' | 'EUR') => formatMoney(minor, currency, i18n.language);
	const scheduledNote = (when: string) => t('adminShell.pricing.from', { when: fromDay(when) });

	const doWithdraw = async () => {
		if (!withdraw) return;
		try {
			if (withdraw.kind === 'price') await adminApi.cancelPrice(withdraw.id);
			else await adminApi.cancelVatRate(withdraw.id);
			toast.success(t('adminShell.pricing.withdrawn'));
			load();
		} catch (error) {
			toast.error(errorText(error, t('adminShell.pricing.saveError')));
			throw error;
		}
	};

	const withdrawButton = (kind: 'price' | 'rate', id: string, label: string) =>
		data.canEdit && (
			<button
				type="button"
				onClick={() => setWithdraw({ kind, id, label })}
				aria-label={t('adminShell.pricing.withdraw', { label })}
				className="ml-1 inline-flex size-6 items-center justify-center rounded text-destructive align-middle"
			>
				<X className="size-3.5" aria-hidden />
			</button>
		);

	return (
		<div className="flex flex-col gap-4">
			{!data.canEdit && (
				<p className="rounded-lg bg-[#FFF8E1] px-3 py-2.5 text-[13px] text-[#334155]">{t('adminShell.pricing.readOnly')}</p>
			)}

			<div className="flex flex-wrap items-start gap-4">
				<div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
					<Card title={t('adminShell.pricing.products')} action={<span className="text-[13px] text-muted-foreground">{t('adminShell.pricing.leaguePlansLater')}</span>}>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[640px] border-collapse text-[13.5px]">
								<thead>
									<tr className="bg-muted text-left text-xs text-muted-foreground">
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.product')}</th>
										<th scope="col" className="px-3.5 py-2.5 text-right">{t('adminShell.pricing.czk')}</th>
										<th scope="col" className="px-3.5 py-2.5 text-right">{t('adminShell.pricing.eur')}</th>
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.validFromShort')}</th>
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.scheduled')}</th>
										<th scope="col" className="px-3.5 py-2.5"><span className="sr-only">{t('adminShell.audit.action')}</span></th>
									</tr>
								</thead>
								<tbody>
									{data.products.map((row) => {
										const name = czech ? row.nameCs : row.nameEn;
										return (
											<tr key={row.id} className={`border-t border-border ${row.code === editingProduct ? 'bg-[#FFFBEB]' : ''}`}>
												<th scope="row" className="px-3.5 py-2.5 text-left">
													<span className="block font-bold">{name}</span>
													<code className="text-xs font-normal text-muted-foreground">{row.code}</code>
												</th>
												<td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">{row.current ? money(row.current.priceCzk, 'CZK') : '—'}</td>
												<td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">{row.current ? money(row.current.priceEur, 'EUR') : '—'}</td>
												<td className="px-3.5 py-2.5 text-muted-foreground">{fromDay(row.current?.validFrom)}</td>
												<td className="px-3.5 py-2.5">
													{row.scheduled.length === 0 ? '—' : row.scheduled.map((version) => (
														<span key={version.id} className="block whitespace-nowrap">
															{money(version.priceCzk, 'CZK')} / {money(version.priceEur, 'EUR')} {scheduledNote(version.validFrom)}
															{withdrawButton('price', version.id, `${name} ${scheduledNote(version.validFrom)}`)}
														</span>
													))}
												</td>
												<td className="px-3.5 py-1.5 text-right">
													{data.canEdit && <SmallButton onClick={() => setEditingProduct(row.code)}>{t('adminShell.pricing.changePrice')}</SmallButton>}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Card>

					<Card
						title={t('adminShell.pricing.vatRates')}
						action={data.canEdit && <SmallButton onClick={() => setAddingRate(true)}>{t('adminShell.pricing.addRate')}</SmallButton>}
					>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[560px] border-collapse text-[13.5px]">
								<thead>
									<tr className="bg-muted text-left text-xs text-muted-foreground">
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.country')}</th>
										<th scope="col" className="px-3.5 py-2.5 text-right">{t('adminShell.pricing.rate')}</th>
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.validFromShort')}</th>
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.scheduled')}</th>
										<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.appliesWhen')}</th>
									</tr>
								</thead>
								<tbody>
									{data.vatRates.map((row) => (
										<tr key={row.country} className="border-t border-border">
											<th scope="row" className="px-3.5 py-2.5 text-left font-bold">{countryName(row.country, i18n.language)} ({row.country})</th>
											<td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">{row.current ? formatRate(row.current.rateBp, i18n.language) : '—'}</td>
											<td className="px-3.5 py-2.5 text-muted-foreground">{fromDay(row.current?.validFrom)}</td>
											<td className="px-3.5 py-2.5">
												{row.scheduled.length === 0 ? '—' : row.scheduled.map((version) => (
													<span key={version.id} className="block whitespace-nowrap">
														{formatRate(version.rateBp, i18n.language)} {scheduledNote(version.validFrom)}
														{withdrawButton('rate', version.id, `${row.country} ${scheduledNote(version.validFrom)}`)}
													</span>
												))}
											</td>
											<td className="px-3.5 py-2.5 text-[#334155]">{row.country === 'CZ' ? t('adminShell.pricing.appliesCz') : t('adminShell.pricing.appliesOss')}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{addingRate && <RateForm countries={data.euCountries} onDone={() => { setAddingRate(false); load(); }} onCancel={() => setAddingRate(false)} />}
						<p className="px-4 pb-3.5 pt-2.5 text-[12.5px] text-muted-foreground">{t('adminShell.pricing.ratesNote')}</p>
					</Card>

					<LimitsCard data={data} editing={editingLimits} onEdit={() => setEditingLimits(true)} onDone={() => { setEditingLimits(false); load(); }} onCancel={() => setEditingLimits(false)} />
				</div>

				<aside aria-label={t('adminShell.pricing.side')} className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
					{product && (
						<PriceForm
							key={product.code}
							product={product}
							vatRates={data.vatRates}
							ossEnabled={data.oss.enabled}
							onSaved={() => { setEditingProduct(null); load(); }}
							onCancel={() => setEditingProduct(null)}
						/>
					)}
					<OssCard oss={data.oss} canEdit={data.canEdit} onChanged={load} />
					<LookupCard />
				</aside>
			</div>

			{withdraw && (
				<ConfirmDialog
					title={t('adminShell.pricing.withdrawTitle')}
					description={t('adminShell.pricing.withdrawHint', { label: withdraw.label })}
					confirmLabel={t('adminShell.pricing.withdrawConfirm')}
					tone="danger"
					onConfirm={doWithdraw}
					onClose={() => setWithdraw(null)}
				/>
			)}
		</div>
	);
}

function RateForm({ countries, onDone, onCancel }: { countries: string[]; onDone: () => void; onCancel: () => void }) {
	const { t, i18n } = useTranslation();
	const [country, setCountry] = useState('SK');
	const [rate, setRate] = useState('');
	const [validFrom, setValidFrom] = useState('');
	const [confirming, setConfirming] = useState(false);
	const valid = /^\d{1,2}([.,]\d{1,2})?$/.test(rate.trim());
	const when = validFrom ? t('adminShell.pricing.from', { when: formatDay(`${validFrom}T12:00:00`, i18n.language) }) : t('adminShell.pricing.now');

	const save = async () => {
		try {
			await adminApi.createVatRate({ country, ratePercent: rate.trim(), validFrom: validFrom || null });
			toast.success(t('adminShell.pricing.rateSaved'));
			onDone();
		} catch (error) {
			toast.error(errorText(error, t('adminShell.pricing.saveError')));
			throw error;
		}
	};

	return (
		<form className="flex flex-wrap items-end gap-2.5 border-t border-border px-4 py-3.5" onSubmit={(event) => { event.preventDefault(); if (valid) setConfirming(true); }}>
			<label className={labelClass}>
				{t('adminShell.pricing.country')}
				<select value={country} onChange={(event) => setCountry(event.target.value)} className={inputClass}>
					{countries.map((code) => <option key={code} value={code}>{countryName(code, i18n.language)} ({code})</option>)}
				</select>
			</label>
			<label className={`${labelClass} w-28`}>
				{t('adminShell.pricing.ratePercent')}
				<input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} className={inputClass} />
			</label>
			<label className={labelClass}>
				{t('adminShell.pricing.validFrom')}
				<input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className={inputClass} />
			</label>
			<div className="flex flex-[1_1_200px] gap-2">
				<PrimaryButton disabled={!valid}>{t('adminShell.pricing.schedule')}</PrimaryButton>
				<button type="button" onClick={onCancel} className="h-11 rounded-lg border border-border px-4 text-sm font-bold">{t('common.cancel')}</button>
			</div>
			{confirming && (
				<ConfirmDialog
					title={t('adminShell.pricing.confirmRateTitle')}
					description={t('adminShell.pricing.confirmRate', { country: countryName(country, i18n.language), rate: `${rate.trim()} %`, when })}
					confirmLabel={t('adminShell.pricing.schedule')}
					onConfirm={save}
					onClose={() => setConfirming(false)}
				/>
			)}
		</form>
	);
}

/** Plan limits: a plans × limits grid; editing writes only the changed cells, all from one date. */
function LimitsCard({ data, editing, onEdit, onDone, onCancel }: {
	data: PricingOverview; editing: boolean; onEdit: () => void; onDone: () => void; onCancel: () => void;
}) {
	const { t, i18n } = useTranslation();
	const fromDay = useFromDay();
	const { plans, keys, cells } = data.limits;
	const cell = (plan: string, key: string) => cells.find((row) => row.plan === plan && row.key === key);
	const asText = (value: number | null | undefined) => (value === null ? '' : value === undefined ? '0' : String(value));
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [validFrom, setValidFrom] = useState('');
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (editing) setDraft(Object.fromEntries(cells.map((row) => [`${row.plan}:${row.key}`, asText(row.current?.value)])));
	}, [editing, cells]);

	const show = (value: number | null | undefined) =>
		value === null ? t('adminShell.pricing.unlimited') : !value ? '—' : String(value);

	const changes = Object.entries(draft).flatMap(([id, text]) => {
		const [plan, key] = id.split(':');
		const value = text.trim() === '' ? null : Number(text);
		if (value !== null && (!Number.isInteger(value) || value < 0)) return [];
		const current = cell(plan, key)?.current;
		return value === (current ? current.value : 0) ? [] : [{ plan, key, value }];
	});
	const invalid = Object.values(draft).some((text) => text.trim() !== '' && !/^\d+$/.test(text.trim()));
	const when = validFrom ? t('adminShell.pricing.from', { when: formatDay(`${validFrom}T12:00:00`, i18n.language) }) : t('adminShell.pricing.now');

	const save = async () => {
		try {
			await adminApi.createLimits({ validFrom: validFrom || null, values: changes });
			toast.success(t('adminShell.pricing.limitsSaved'));
			onDone();
		} catch (error) {
			toast.error(errorText(error, t('adminShell.pricing.saveError')));
			throw error;
		}
	};

	return (
		<Card
			title={t('adminShell.pricing.limits')}
			action={data.canEdit && !editing && <SmallButton onClick={onEdit}>{t('adminShell.pricing.changeLimits')}</SmallButton>}
		>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] border-collapse text-[13.5px]">
					<thead>
						<tr className="bg-muted text-left text-xs text-muted-foreground">
							<th scope="col" className="px-3.5 py-2.5">{t('adminShell.pricing.limit')}</th>
							{plans.map((plan) => <th key={plan} scope="col" className="px-3.5 py-2.5">{t(`adminShell.pricing.plans.${plan}`)}</th>)}
						</tr>
					</thead>
					<tbody>
						{keys.map((key) => (
							<tr key={key} className="border-t border-border">
								<th scope="row" className="px-3.5 py-2.5 text-left font-bold">{t(`adminShell.pricing.limitKeys.${key}`)}</th>
								{plans.map((plan) => {
									const row = cell(plan, key);
									const id = `${plan}:${key}`;
									return (
										<td key={plan} className="px-3.5 py-2">
											{editing ? (
												<input
													inputMode="numeric"
													value={draft[id] ?? ''}
													onChange={(event) => setDraft((prev) => ({ ...prev, [id]: event.target.value }))}
													placeholder={t('adminShell.pricing.unlimited')}
													aria-label={`${t(`adminShell.pricing.limitKeys.${key}`)}, ${t(`adminShell.pricing.plans.${plan}`)}`}
													className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-sm"
												/>
											) : (
												<>
													{show(row?.current?.value)}
													{row?.scheduled.map((version) => (
														<span key={version.id} className="block text-xs text-muted-foreground">
															{show(version.value)} {t('adminShell.pricing.from', { when: fromDay(version.validFrom) })}
														</span>
													))}
												</>
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{editing && (
				<form className="flex flex-wrap items-end gap-2.5 border-t border-border px-4 py-3.5" onSubmit={(event) => { event.preventDefault(); if (changes.length && !invalid) setConfirming(true); }}>
					<p className="w-full text-[12.5px] text-muted-foreground">{t('adminShell.pricing.limitsHint')}</p>
					<label className={labelClass}>
						{t('adminShell.pricing.validFrom')}
						<input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className={inputClass} />
					</label>
					<div className="flex flex-[1_1_200px] gap-2">
						<PrimaryButton disabled={changes.length === 0 || invalid}>{t('adminShell.pricing.schedule')}</PrimaryButton>
						<button type="button" onClick={onCancel} className="h-11 rounded-lg border border-border px-4 text-sm font-bold">{t('common.cancel')}</button>
					</div>
					{confirming && (
						<ConfirmDialog
							title={t('adminShell.pricing.confirmLimitsTitle', { count: changes.length })}
							description={t('adminShell.pricing.confirmLimits', {
								when,
								list: changes.map((change) => `${t(`adminShell.pricing.plans.${change.plan}`)} · ${t(`adminShell.pricing.limitKeys.${change.key}`)}: ${show(change.value)}`).join('; '),
							})}
							confirmLabel={t('adminShell.pricing.schedule')}
							onConfirm={save}
							onClose={() => setConfirming(false)}
						/>
					)}
				</form>
			)}
		</Card>
	);
}
