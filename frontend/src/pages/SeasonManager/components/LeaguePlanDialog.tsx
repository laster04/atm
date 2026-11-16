import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { METHOD_CURRENCY, type LeagueOfferKind, type LeaguePlanBand, type LeaguePlanView, type PaymentCurrency, type PaymentMethod } from '@types';
import PaymentMethodPicker, { initialMethod } from '@/components/plans/PaymentMethodPicker';
import { leagueApi, tournamentApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { formatSeasonDate } from '@/utils/date';
import { Button } from '@components/base/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import PaymentDetails from '@/components/plans/PaymentDetails';

interface LeaguePlanDialogProps {
	leagueId: string;
	view: LeaguePlanView;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** After a payment was started or cancelled. */
	onChanged: () => void;
}

const BAND_PLAN = { SMALL: 'LEAGUE_SMALL', LARGE: 'LEAGUE_LARGE' } as const;

/** The League plan offers for a league, and the QR transfer once one is chosen. */
export default function LeaguePlanDialog({ leagueId, view, open, onOpenChange, onChanged }: LeaguePlanDialogProps) {
	const { t, i18n } = useTranslation();
	const [method, setMethod] = useState<PaymentMethod | null>(initialMethod(view.currencies, view.suggestedMethod));
	const currency: PaymentCurrency = method ? METHOD_CURRENCY[method] : 'CZK';
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	// Asked afresh each time the offers open; see the terms, section 5.
	const [immediateStart, setImmediateStart] = useState(false);
	const payment = view.payment;

	useEffect(() => {
		if (!open) return;
		setError('');
		setImmediateStart(false);
	}, [open]);

	const choose = async (band: LeaguePlanBand, kind: LeagueOfferKind) => {
		setBusy(true);
		setError('');
		try {
			await leagueApi.startPayment(leagueId, band, kind, currency);
			onChanged();
		} catch {
			setError(t('plans.startError'));
		} finally {
			setBusy(false);
		}
	};

	const cancel = async () => {
		if (!payment) return;
		setBusy(true);
		setError('');
		try {
			// The same withdrawal as for a tournament plan.
			await tournamentApi.cancelPayment(payment.id);
			onChanged();
		} catch {
			setError(t('plans.cancelError'));
		} finally {
			setBusy(false);
		}
	};

	const date = (value: string) => formatSeasonDate(value, i18n.language);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{payment ? t('plans.payment.title') : t('leaguePlan.dialog.title')}</DialogTitle>
				</DialogHeader>
				{error && <p className="text-sm text-red-700">{error}</p>}
				{payment ? (
					<PaymentDetails payment={payment} busy={busy} onCancel={() => void cancel()} suggested={method ?? view.suggestedMethod} />
				) : view.currencies.length === 0 ? (
					<p className="text-sm">{t('plans.offers.unavailable')}</p>
				) : view.offers.length === 0 ? (
					<p className="text-sm">{t('leaguePlan.dialog.none')}</p>
				) : (
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">{t('leaguePlan.dialog.intro')}</p>
						<PaymentMethodPicker currencies={view.currencies} value={method} onChange={setMethod} />
						<ul className="grid gap-3 sm:grid-cols-2">
							{view.offers.map((offer) => {
								const price = offer.prices[currency];
								return (
									<li key={`${offer.band}-${offer.kind}`} className="flex flex-col gap-2 rounded-lg border p-4">
										<h3 className="font-bold">{t(`plans.names.${BAND_PLAN[offer.band]}`)}</h3>
										<p className="text-xl font-extrabold tabular-nums">
											{price === undefined ? '—' : formatMoney(price, currency, i18n.language)}
										</p>
										<p className="text-xs text-muted-foreground">
											{offer.kind === 'UPGRADE' && offer.endsAt
												? t('leaguePlan.dialog.upgradeUntil', { date: date(offer.endsAt) })
												: t('plans.offers.perYear')}
											{offer.startsAt && ` · ${t('plans.offers.renewalFrom', { date: date(offer.startsAt) })}`}
										</p>
										<p className="flex-1 text-sm">{t(`leaguePlan.dialog.points.${offer.band}`, { limit: offer.limit })}</p>
										<Button disabled={busy || price === undefined || !immediateStart} onClick={() => void choose(offer.band, offer.kind)}>
											{t('plans.offers.choose')}
										</Button>
									</li>
								);
							})}
						</ul>
						<label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed">
							<input
								type="checkbox"
								checked={immediateStart}
								onChange={(event) => setImmediateStart(event.target.checked)}
								className="mt-1 size-4 shrink-0"
							/>
							<span>
								<Trans
									i18nKey="legal.immediateStart"
									components={{ terms: <Link to="/terms" target="_blank" className="font-semibold text-primary hover:underline" /> }}
								/>
							</span>
						</label>
						<p className="text-xs text-muted-foreground">{t('plans.offers.vatIncluded')}</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
