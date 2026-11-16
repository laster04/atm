import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { OfferPlan, PaymentCurrency, PlanOffer, PlanPayment } from '@types';
import { tournamentApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { formatSeasonDate } from '@/utils/date';
import { Button } from '@components/base/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import PaymentDetails from '@/components/plans/PaymentDetails';

interface UpgradeDialogProps {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The payment waiting, shown instead of the offers. */
  payment: PlanPayment | null;
  /** After a payment was started or cancelled. */
  onChanged: () => void;
}

/** The paid plans for a tournament, and the QR transfer once one is chosen. */
export default function UpgradeDialog({ tournamentId, open, onOpenChange, payment, onChanged }: UpgradeDialogProps) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<PlanOffer[] | null>(null);
  const [currencies, setCurrencies] = useState<PaymentCurrency[]>([]);
  const [currency, setCurrency] = useState<PaymentCurrency>('CZK');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Asked afresh each time the offers open; see the terms, section 5.
  const [immediateStart, setImmediateStart] = useState(false);

  useEffect(() => {
    if (!open || payment) return;
    setError('');
    setImmediateStart(false);
    tournamentApi.getOffers(tournamentId)
      .then((res) => {
        setOffers(res.data.offers);
        setCurrencies(res.data.currencies);
        setCurrency((current) => (res.data.currencies.includes(current) ? current : res.data.currencies[0] ?? current));
      })
      .catch(() => setError(t('plans.offersError')));
  }, [open, payment, tournamentId, t]);

  const choose = async (plan: OfferPlan) => {
    setBusy(true);
    setError('');
    try {
      await tournamentApi.startPayment(tournamentId, plan, currency);
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
      await tournamentApi.cancelPayment(payment.id);
      onChanged();
    } catch {
      setError(t('plans.cancelError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{payment ? t('plans.payment.title') : t('plans.offers.title')}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {payment
          ? <PaymentDetails payment={payment} busy={busy} onCancel={() => void cancel()} />
          : <Offers offers={offers} currencies={currencies} currency={currency} onCurrency={setCurrency} immediateStart={immediateStart} onImmediateStart={setImmediateStart} busy={busy} onChoose={(plan) => void choose(plan)} />}
      </DialogContent>
    </Dialog>
  );
}

function Offers({ offers, currencies, currency, onCurrency, immediateStart, onImmediateStart, busy, onChoose }: {
  offers: PlanOffer[] | null;
  currencies: PaymentCurrency[];
  currency: PaymentCurrency;
  onCurrency: (currency: PaymentCurrency) => void;
  immediateStart: boolean;
  onImmediateStart: (value: boolean) => void;
  busy: boolean;
  onChoose: (plan: OfferPlan) => void;
}) {
  const { t, i18n } = useTranslation();
  if (!offers) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (currencies.length === 0) return <p className="text-sm">{t('plans.offers.unavailable')}</p>;
  if (offers.length === 0) return <p className="text-sm">{t('plans.offers.none')}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('plans.offers.intro')}{' '}
        <Link to="/docs/plany-turnaju" target="_blank" className="font-semibold text-primary hover:underline">{t('plans.offers.howItWorks')}</Link>
      </p>
      {currencies.length > 1 && (
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">{t('plans.offers.currency')}</legend>
          {currencies.map((value) => (
            <label key={value} className={`cursor-pointer rounded border px-3 py-1.5 ${currency === value ? 'border-primary bg-primary/10 font-semibold' : ''}`}>
              <input type="radio" name="currency" value={value} checked={currency === value} onChange={() => onCurrency(value)} className="sr-only" />
              {value}
            </label>
          ))}
        </fieldset>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {offers.map((offer) => {
          const price = offer.prices[currency];
          return (
            <li key={offer.plan} className="flex flex-col gap-2 rounded-lg border p-4">
              <h3 className="font-bold">{t(`plans.names.${offer.plan}`)}</h3>
              <p className="text-xl font-extrabold tabular-nums">
                {price === undefined ? '—' : formatMoney(price, currency, i18n.language)}
              </p>
              <p className="text-xs text-muted-foreground">
                {offer.plan === 'ORGANIZER' ? t('plans.offers.perYear') : t('plans.offers.perTournament')}
                {offer.upgradeFrom && ` · ${t('plans.offers.upgrade', { plan: t(`plans.names.${offer.upgradeFrom}`) })}`}
                {offer.startsAt && ` · ${t('plans.offers.renewalFrom', { date: formatSeasonDate(offer.startsAt, i18n.language) })}`}
              </p>
              <p className="flex-1 text-sm">{t(`plans.offers.points.${offer.plan}`, { limit: offer.limit })}</p>
              <Button disabled={busy || price === undefined || !immediateStart} onClick={() => onChoose(offer.plan)}>{t('plans.offers.choose')}</Button>
            </li>
          );
        })}
      </ul>
      <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={immediateStart}
          onChange={(event) => onImmediateStart(event.target.checked)}
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
  );
}
