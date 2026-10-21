import { retryUnavailableVatChecks } from '../services/billing/vies.js';

const INTERVAL_MS = 15 * 60 * 1000;

/**
 * Asks VIES again about VAT IDs it did not answer. Each check carries its own
 * next attempt time, so running this on several instances only repeats a
 * lookup, it never changes an answer.
 */
export function startVatCheckRetry(): void {
  const run = () => {
    retryUnavailableVatChecks()
      .then((answered) => { if (answered > 0) console.log(`VIES retry: ${answered} VAT ID(s) answered`); })
      .catch((error) => console.error('VIES retry failed:', error));
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, INTERVAL_MS).unref();
}
