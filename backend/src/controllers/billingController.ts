import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { checkVatId, VatIdFormatError } from '../services/billing/vies.js';
import { AresUnavailableError, isValidIco, lookupCompany } from '../services/billing/ares.js';

/** Both services are free and public; a per-user cap keeps ATM a polite client. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByUser = new Map<string, number[]>();

function limited(userId: string): boolean {
  const now = Date.now();
  const recent = (recentByUser.get(userId) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  recentByUser.set(userId, recent);
  return false;
}

export const resetBillingRateLimit = (): void => recentByUser.clear();

/**
 * POST /api/billing/vat-check — `{ vatId }`
 *
 * Checks an EU VAT ID in VIES and returns the stored check. A VIES outage is
 * an answer too (status UNAVAILABLE), not an error.
 */
export const postVatCheck = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (limited(req.user!.id)) { res.status(429).json({ error: 'Too many lookups, try again later' }); return; }
    const check = await checkVatId(req.body?.vatId, req.user!.id);
    res.json({
      id: check.id,
      countryCode: check.countryCode,
      vatNumber: check.vatNumber,
      status: check.status,
      name: check.name,
      address: check.address,
      requestIdentifier: check.requestIdentifier,
      checkedAt: check.checkedAt,
    });
  } catch (error) {
    if (error instanceof VatIdFormatError) { res.status(400).json({ error: error.message, code: 'VAT_ID_FORMAT' }); return; }
    console.error('VAT check error:', error);
    res.status(500).json({ error: 'Failed to check the VAT ID' });
  }
};

/** GET /api/billing/company/:ico — name, address and DIČ from ARES. */
export const getCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ico = (req.params.ico ?? '').replace(/\s/g, '');
    if (!isValidIco(ico)) { res.status(400).json({ error: 'Not a valid IČO', code: 'ICO_FORMAT' }); return; }
    if (limited(req.user!.id)) { res.status(429).json({ error: 'Too many lookups, try again later' }); return; }
    const company = await lookupCompany(ico);
    if (!company) { res.status(404).json({ error: 'No company with this IČO', code: 'ICO_UNKNOWN' }); return; }
    res.json(company);
  } catch (error) {
    if (error instanceof AresUnavailableError) {
      res.status(503).json({ error: 'ARES is not answering; fill in the details by hand', code: 'ARES_UNAVAILABLE' });
      return;
    }
    console.error('ARES lookup error:', error);
    res.status(500).json({ error: 'Failed to look up the company' });
  }
};
