/**
 * Company details from ARES, the Czech register of economic subjects, so a
 * Czech customer types their IČO and gets name, address and DIČ filled in.
 * Free service of the Ministry of Finance; answers are cached for a day.
 */

const DEFAULT_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';
const TIMEOUT_MS = 5_000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1_000;

export type Fetcher = typeof fetch;

export interface Company {
  ico: string;
  name: string;
  /** DIČ, when the subject is a VAT payer. */
  vatId: string | null;
  address: {
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string;
    /** The one-line address as ARES formats it. */
    text: string | null;
  };
}

export class AresUnavailableError extends Error {}

/** Eight digits with the mod-11 check digit every IČO carries. */
export function isValidIco(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const sum = digits.slice(0, 7).reduce((total, digit, index) => total + digit * (8 - index), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === digits[7];
}

const cache = new Map<string, { at: number; company: Company | null }>();
export const clearAresCache = (): void => cache.clear();

type AresSidlo = {
  kodStatu?: string; nazevObce?: string; nazevCastiObce?: string; psc?: number | string;
  nazevUlice?: string; cisloDomovni?: number | string; cisloOrientacni?: number | string;
  cisloOrientacniPismeno?: string; textovaAdresa?: string;
};

function streetLine(sidlo: AresSidlo): string | null {
  const name = sidlo.nazevUlice ?? sidlo.nazevCastiObce ?? sidlo.nazevObce;
  if (!sidlo.cisloDomovni) return sidlo.nazevUlice ?? null;
  const orientation = sidlo.cisloOrientacni ? `/${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno ?? ''}` : '';
  return `${name ?? ''} ${sidlo.cisloDomovni}${orientation}`.trim();
}

/**
 * The subject with this IČO, null when ARES does not know it. Throws
 * AresUnavailableError when ARES fails or is slow, so the form falls back to
 * manual entry instead of claiming the company does not exist.
 */
export async function lookupCompany(ico: string, fetcher: Fetcher = fetch): Promise<Company | null> {
  const hit = cache.get(ico);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.company;

  let res: Response;
  try {
    res = await fetcher(`${process.env.ARES_API_URL ?? DEFAULT_URL}/ekonomicke-subjekty/${ico}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AresUnavailableError(String(error));
  }

  let company: Company | null = null;
  if (res.status !== 404) {
    if (!res.ok) throw new AresUnavailableError(`ARES answered ${res.status}`);
    const body = (await res.json().catch(() => null)) as {
      ico?: string; obchodniJmeno?: string; dic?: string; sidlo?: AresSidlo;
    } | null;
    if (!body?.obchodniJmeno) throw new AresUnavailableError('ARES answered without a name');
    const sidlo = body.sidlo ?? {};
    company = {
      ico: body.ico ?? ico,
      name: body.obchodniJmeno,
      vatId: body.dic ?? null,
      address: {
        street: streetLine(sidlo),
        city: sidlo.nazevObce ?? null,
        postalCode: sidlo.psc !== undefined ? String(sidlo.psc) : null,
        country: sidlo.kodStatu ?? 'CZ',
        text: sidlo.textovaAdresa ?? null,
      },
    };
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(ico, { at: Date.now(), company });
  return company;
}
