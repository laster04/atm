import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Check, Copy } from 'lucide-react';
import type { PaymentMethod, PlanPayment } from '@types';
import { formatMoney } from '@/utils/money';
import { Button } from '@components/base/button';

interface PaymentDetailsProps {
  payment: PlanPayment;
  busy: boolean;
  onCancel: () => void;
  /** The QR format the payer most likely needs; a euro payment can switch between its two. */
  suggested?: PaymentMethod | null;
}

/**
 * A plan payment waiting for its transfer: the QR code in the payer's
 * format, every detail as text with a copy button, and a way to withdraw it.
 */
export default function PaymentDetails({ payment, busy, onCancel, suggested }: PaymentDetailsProps) {
  const { t, i18n } = useTranslation();
  const methods = payment.methods ?? [];
  const [method, setMethod] = useState<PaymentMethod | null>(
    suggested && methods.includes(suggested) ? suggested : methods[0] ?? null,
  );
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  const code = method ? payment.qr?.[method] : undefined;

  useEffect(() => {
    if (!code) { setQr(''); return; }
    QRCode.toDataURL(code, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [code]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1500);
    } catch {
      setCopied('');
    }
  };

  const transfer = payment.transfer;
  const rows: { key: string; label: string; value: string; copyValue?: string }[] = [
    { key: 'plan', label: t('plans.payment.plan'), value: t(`plans.names.${payment.plan}`) },
    {
      key: 'amount',
      label: t('plans.payment.amount'),
      value: formatMoney(payment.amount, payment.currency, i18n.language),
      copyValue: transfer?.amount,
    },
    ...(transfer ? [
      { key: 'currency', label: t('plans.payment.currency'), value: transfer.currency, copyValue: transfer.currency },
      { key: 'vs', label: t('plans.payment.variableSymbol'), value: String(transfer.variableSymbol), copyValue: String(transfer.variableSymbol) },
      ...(payment.account && payment.account.local !== transfer.iban
        ? [{ key: 'local', label: t('plans.payment.account'), value: payment.account.local, copyValue: payment.account.local }]
        : []),
      { key: 'iban', label: 'IBAN', value: transfer.iban, copyValue: transfer.iban },
      { key: 'bic', label: 'BIC', value: transfer.bic, copyValue: transfer.bic },
      { key: 'recipient', label: t('plans.payment.recipient'), value: transfer.recipient, copyValue: transfer.recipient },
      { key: 'message', label: t('plans.payment.message'), value: transfer.message, copyValue: transfer.message },
    ] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        {t('plans.payment.waiting')}
      </p>
      {methods.length > 1 && (
        <div role="radiogroup" aria-label={t('plans.payment.format')} className="flex flex-wrap gap-2">
          {methods.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={`rounded border px-3 py-1.5 text-sm ${method === value ? 'border-primary bg-primary/10 font-semibold' : ''}`}
            >
              {t(`plans.method.${value}.title`)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-5">
        {qr && <img src={qr} alt={t('plans.payment.qrAlt')} className="size-48 rounded border" />}
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-semibold tabular-nums break-all">{row.value}</dd>
              <dd>
                {row.copyValue && (
                  <button
                    type="button"
                    onClick={() => void copy(row.key, row.copyValue!)}
                    aria-label={t('plans.payment.copy', { label: row.label })}
                    className="flex size-8 items-center justify-center rounded border text-muted-foreground hover:text-foreground"
                  >
                    {copied === row.key ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-sm text-muted-foreground">
        {payment.currency === 'EUR' ? t('plans.payment.hintSepa') : t('plans.payment.hint')}
      </p>
      <div className="flex justify-end">
        <Button variant="outline" disabled={busy} onClick={onCancel}>{t('plans.payment.cancel')}</Button>
      </div>
    </div>
  );
}
