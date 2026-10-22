import { getLocale } from './date';

/** An amount in minor units (haléře, cents) as people read it: no decimals when it is whole. */
export const formatMoney = (minor: number, currency: 'CZK' | 'EUR', language: string): string =>
	new Intl.NumberFormat(getLocale(language), { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 })
		.format(minor / 100);
