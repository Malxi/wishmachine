// Network guards for source ingestion/search: SSRF classification of URLs,
// DNS address checks, credential/protocol rejection, manual redirect following
// and JSON fetches. Every caller-supplied URL passes assertSafeSourceUrl before
// any request is made, and every redirect hop is re-validated and capped.
import net from 'node:net';
import dns from 'node:dns/promises';

const USER_AGENT = 'Wishmachine/0.1 (source ingest)';
const SEARCH_USER_AGENT = 'Wishmachine/0.1 (source search)';
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set(['metadata', 'metadata.google.internal', 'metadata.azure.internal']);

function privateHostsAllowed(options) {
  if (options?.allowPrivateHosts) return true;
  if (/^(1|true|yes)$/i.test(String(process.env.WISHMACHINE_ALLOW_PRIVATE_SOURCES || ''))) return true;
  // The local HTTP fixtures used by `node --test` need loopback access.
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

function classifyAddress(address) {
  const version = net.isIP(address);
  if (!version) return 'unknown';
  if (version === 6) return classifyIpv6(address.toLowerCase());
  return classifyIpv4(address);
}

function classifyIpv6(address) {
  if (address === '::1') return 'loopback';
  if (address === '::') return 'reserved';
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return classifyIpv4(mapped[1]);
  if (/^fe[89ab]/.test(address)) return 'link-local';
  if (/^f[cd]/.test(address)) return 'private';
  return 'public';
}

function classifyIpv4(address) {
  const [a, b] = address.split('.').map(Number);
  if (a === 127) return 'loopback';
  if (a === 10 || a === 0) return a === 10 ? 'private' : 'reserved';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  if (a >= 224) return 'reserved';
  return 'public';
}

async function assertSafeSourceUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl));
  } catch {
    throw new Error(`invalid source URL: ${rawUrl}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('source URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('source URL must not embed credentials');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`source host is not allowed: ${hostname || '(empty)'}`);
  }
  const allowed = privateHostsAllowed(options);
  const checkAddress = (address) => {
    const kind = classifyAddress(address);
    if (kind === 'link-local' || kind === 'reserved' || kind === 'unknown') {
      throw new Error(`source host is not allowed (${kind}): ${hostname}`);
    }
    if ((kind === 'private' || kind === 'loopback') && !allowed) {
      throw new Error(`source host is not allowed (${kind}): ${hostname}`);
    }
  };
  if (net.isIP(hostname)) {
    checkAddress(hostname);
    return parsed;
  }
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`source host could not be resolved: ${hostname} (${error.code || error.message})`);
  }
  if (!addresses.length) throw new Error(`source host could not be resolved: ${hostname}`);
  for (const entry of addresses) checkAddress(entry.address);
  return parsed;
}

async function fetchDocument(url, options = {}) {
  let current = await assertSafeSourceUrl(url, options);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.href, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers?.get?.('location');
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (hop === MAX_REDIRECTS) {
        throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
      }
      current = await assertSafeSourceUrl(new URL(location, current), options);
      continue;
    }
    if (!response.ok) {
      throw new Error(`source fetch failed: ${response.status} ${response.statusText}`);
    }
    return { response, finalUrl: current };
  }
  throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': SEARCH_USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`search request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export { assertSafeSourceUrl, fetchDocument, fetchJson };
