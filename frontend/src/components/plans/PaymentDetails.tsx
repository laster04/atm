import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import type { PlanPayment } from '@types';
import { formatMoney } from '@/utils/money';
import { Button } from '@components/base/button';

/** A plan payment waiting for its QR transfer: the code, the account and a way to withdraw it. */
export default function PaymentDetails({ payment, busy, onCancel }: { payment: PlanPayment; busy: boolean; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!payment.qr) { setQr(''); return; }
    QRCode.toDataURL(payment.qr, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [payment.qr]);

  const rows = [
    { label: t('plans.payment.plan'), value: t(`plans.names.${payment.plan}`) },
    { label: t('plans.payment.amount'), value: formatMoney(payment.amount, payment.currency, i18n.language) },
    { label: t('plans.payment.variableSymbol'), value: String(payment.variableSymbol) },
    ...(payment.account ? [
      { label: t('plans.payment.account'), value: payment.account.local },
      { label: 'IBAN', value: payment.account.iban },
      ...(payment.account.bic ? [{ label: 'BIC', value: payment.account.bic }] : []),
      { label: t('plans.payment.recipient'), value: payment.account.recipient },
    ] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        {t('plans.payment.waiting')}
      </p>
      <div className="flex flex-wrap items-start gap-5">
        {qr && <img src={qr} alt={t('plans.payment.qrAlt')} className="size-48 rounded border" />}
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-semibold tabular-nums break-all">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-sm text-muted-foreground">{t('plans.payment.hint')}</p>
      <div className="flex justify-end">
        <Button variant="outline" disabled={busy} onClick={onCancel}>{t('plans.payment.cancel')}</Button>
      </div>
    </div>
  );
}
