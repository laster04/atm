import dns from 'dns';
import https from 'https';
import net from 'net';
import { storeLogo } from './files.js';
import { FileRejectedError } from './images.js';
import { EXTERNAL_FETCH_MAX_REDIRECTS, EXTERNAL_FETCH_TIMEOUT_MS, LOGO_MAX_BYTES } from './limits.js';

/**
 * Why a link could not be imported. `transient` failures (a timeout, a server
 * error) may work on a later save; the others never will.
 */
export class ExternalFetchError extends Error {
  constructor(message: string, public readonly transient = false) {
    super(message);
    this.name = 'ExternalFetchError';
  }
}

// Addresses the server must never be made to fetch from: its own machine, the
// private network around it, cloud metadata endpoints and reserved ranges.
const blocked = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  // IPv4-mapped addresses (::ffff:a.b.c.d) are not listed: BlockList would
  // then match every IPv4 address. They are unwrapped and checked as IPv4.
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64],
  ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

export const isBlockedAddress = (address: string): boolean => {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    return mapped ? isBlockedAddress(mapped[1]) : blocked.check(address, 'ipv6');
  }
  return true;
};

/** Parses a link and refuses anything but https on the default port to a public host. */
export const checkExternalUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ExternalFetchError('Not a URL');
  }
  if (url.protocol !== 'https:') throw new ExternalFetchError('Only https links can be imported');
  if (url.port && url.port !== '443') throw new ExternalFetchError('Only the default https port is allowed');
  if (url.username || url.password) throw new ExternalFetchError('Links with credentials are refused');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // An IP literal never goes through the lookup below, so it is checked here.
  if (net.isIP(host) && isBlockedAddress(host)) throw new ExternalFetchError('Address is not public');
  return url;
};

/**
 * DNS lookup for the request itself. The connection goes to the address
 * checked here, so a hostname cannot pass the check and then resolve somewhere
 * else (DNS rebinding).
 */
const publicOnlyLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void => {
  dns.lookup(hostname, { all: true, family: options.family }, (err, addresses) => {
    if (err) {
      callback(err, '');
      return;
    }
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      callback(new ExternalFetchError(`${hostname} does not resolve to a public address`), '');
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

type Hop = { redirect: string } | { body: Buffer };

const fetchOnce = (url: URL, signal: AbortSignal): Promise<Hop> =>
  new Promise((resolve, reject) => {
    const req = https.get(url, {
      lookup: publicOnlyLookup as unknown as net.LookupFunction,
      signal,
      headers: { 'User-Agent': 'ATM logo import', Accept: 'image/png,image/jpeg,image/webp' },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        resolve({ redirect: new URL(res.headers.location, url).toString() });
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new ExternalFetchError(`HTTP ${status}`, status >= 500 || status === 429));
        return;
      }
      if (Number(res.headers['content-length']) > LOGO_MAX_BYTES) {
        res.destroy();
        reject(new FileRejectedError('FILE_TOO_LARGE', 'Logo is larger than 1 MB'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > LOGO_MAX_BYTES) {
          res.destroy();
          reject(new FileRejectedError('FILE_TOO_LARGE', 'Logo is larger than 1 MB'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks) }));
      res.on('error', (err) => reject(new ExternalFetchError(err.message, true)));
    });
    req.on('error', (err) => {
      if (err instanceof ExternalFetchError) reject(err);
      else if (signal.aborted) reject(new ExternalFetchError('Timed out', true));
      else {
        // A name that does not exist will not exist on the next save either.
        const code = (err as NodeJS.ErrnoException).code;
        reject(new ExternalFetchError(err.message, code !== 'ENOTFOUND'));
      }
    });
  });

/** Downloads an image from a public https link, following a few redirects. */
export const fetchExternalImage = async (raw: string): Promise<Buffer> => {
  const signal = AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS);
  let next = raw;
  for (let hop = 0; hop <= EXTERNAL_FETCH_MAX_REDIRECTS; hop++) {
    // Every hop is checked again: a public link may redirect inwards.
    const result = await fetchOnce(checkExternalUrl(next), signal);
    if ('body' in result) return result.body;
    next = result.redirect;
  }
  throw new ExternalFetchError('Too many redirects');
};

export type ImportResult = { url: string } | { failed: 'permanent' | 'transient' };

/**
 * Copies a logo from an external link into our storage. The file is stored
 * unattached; the caller attaches it once the record is saved.
 */
export const importExternalLogo = async (
  raw: string,
  uploadedById: string | null,
  fetcher: (url: string) => Promise<Buffer> = fetchExternalImage
): Promise<ImportResult> => {
  try {
    const file = await storeLogo(await fetcher(raw), { uploadedById, sourceUrl: raw });
    return { url: file.url as string };
  } catch (err) {
    const transient = err instanceof ExternalFetchError && err.transient;
    console.warn(`Logo import from ${raw} failed${transient ? ' (will retry on next save)' : ''}:`, (err as Error).message);
    return { failed: transient ? 'transient' : 'permanent' };
  }
};
