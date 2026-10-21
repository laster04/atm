import { getLocale } from '@/utils/date';

/**
 * Display helpers for the pricing screen. The server computes every amount a
 * payment stores; `splitGross` here only previews a price being typed, with
 * the same § 37 formula as backend/src/services/pricing/vat.ts.
 */

export const formatMoney = (minor: number, currency: 'CZK' | 'EUR', language: string): string =>
	new Intl.NumberFormat(getLocale(language), { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 })
		.format(minor / 100);

export const formatRate = (rateBp: number, language: string): string =>
	`${new Intl.NumberFormat(getLocale(language), { maximumFractionDigits: 2 }).format(rateBp / 100)} %`;

/** `1 490,50` or `1490.5` → 149050; null when not a positive amount with at most two decimals. */
export function toMinor(text: string): number | null {
	const cleaned = text.replace(/\s/g, '').replace(',', '.');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
	const minor = Math.round(Number(cleaned) * 100);
	return minor > 0 ? minor : null;
}

export function splitGross(grossMinor: number, rateBp: number): { base: number; vat: number } {
	const numerator = grossMinor * rateBp;
	const denominator = 10_000 + rateBp;
	const vat = Math.floor((2 * numerator + denominator) / (2 * denominator));
	return { base: grossMinor - vat, vat };
}

export const countryName = (code: string, language: string): string => {
	try {
		return new Intl.DisplayNames([getLocale(language)], { type: 'region' }).of(code) ?? code;
	} catch {
		return code;
	}
};
