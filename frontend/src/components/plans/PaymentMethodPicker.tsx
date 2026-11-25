import { useTranslation } from 'react-i18next';
import { METHOD_CURRENCY, type PaymentCurrency, type PaymentMethod } from '@types';

const ORDER: PaymentMethod[] = ['SPD', 'BYSQUARE', 'SEPA'];

/** The ways to pay a plan offered by the accounts ATM has, each with its currency. */
export const availableMethods = (currencies: PaymentCurrency[]): PaymentMethod[] =>
  ORDER.filter((method) => currencies.includes(METHOD_CURRENCY[method]));

/** The method to start with: the suggested one if it can be used, else the first that can. */
export const initialMethod = (currencies: PaymentCurrency[], suggested: PaymentMethod | null | undefined): PaymentMethod | null => {
  const methods = availableMethods(currencies);
  return suggested && methods.includes(suggested) ? suggested : methods[0] ?? null;
};

interface PaymentMethodPickerProps {
  currencies: PaymentCurrency[];
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
}

/**
 * "Where will you pay from?": a Czech bank pays in crowns with the Czech QR
 * code, a Slovak bank in euros with PAY by square, any other eurozone bank in
 * euros with a SEPA transfer typed in by hand (no QR code). The suggestion comes from the payer's language and
 * can always be changed here.
 */
export default function PaymentMethodPicker({ currencies, value, onChange }: PaymentMethodPickerProps) {
  const { t } = useTranslation();
  const methods = availableMethods(currencies);
  if (methods.length < 2) return null;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-semibold">{t('plans.method.label')}</legend>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <label
            key={method}
            className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm ${value === method ? 'border-primary bg-primary/10' : ''}`}
          >
            <input type="radio" name="payment-method" value={method} checked={value === method} onChange={() => onChange(method)} className="sr-only" />
            <span className="font-semibold">{t(`plans.method.${method}.title`)}</span>
            <span className="text-xs text-muted-foreground">{t(`plans.method.${method}.hint`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
