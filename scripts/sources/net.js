// Network guards for source ingestion/search: SSRF classification of URLs,
// DNS address checks, credential/protocol rejection, manual redirect following
// and JSON fetches. Every caller-supplied URL passes resolveSourceTarget before
// any request is made, every redirect hop is re-validated and capped, and the
// connection is pinned to the addresses that were validated: the default
// transport passes a custom `lookup` to node:http(s) so the socket goes to the
// checked IP while TLS still validates the certificate against the hostname.
// That removes the DNS-rebinding TOCTOU window that a fetch(hostname) had.
//
// Test seams: setSourceTransport(fn) replaces the network transport (tests must
// not monkeypatch global.fetch) and setSourceResolver(fn) replaces DNS
// resolution (used by the rebinding regression); both return a restore function.
// The default path never calls global.fetch.
import net from 'node:net';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const USER_AGENT = 'Wishmachine/0.1 (source ingest)';
const SEARCH_USER_AGENT = 'Wishmachine/0.1 (source search)';
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set(['metadata', 'metadata.google.internal', 'metadata.azure.internal']);
const ACCEPT_ENCODING = 'gzip, deflate, br';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);
const brotliDecompress = promisify(zlib.brotliDecompress);

async function defaultResolveHost(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

let resolveHost = defaultResolveHost;
let sourceTransport = pinnedTransport;

function setSourceResolver(resolver) {
  const previous = resolveHost;
  resolveHost = typeof resolver === 'function' ? resolver : defaultResolveHost;
  return () => { resolveHost = previous; };
}

function setSourceTransport(transport) {
  const previous = sourceTransport;
  sourceTransport = typeof transport === 'function' ? transport : pinnedTransport;
  return () => { sourceTransport = previous; };
}

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

// Resolve a URL to the exact IP addresses the connection may use. Callers keep
// the returned addresses and hand them to the transport, so the hostname is
// never resolved a second time at connect time (DNS rebinding is impossible).
async function resolveSourceTarget(rawUrl, options = {}) {
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
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    checkAddress(hostname);
    return { url: parsed, hostname, addresses: [{ address: hostname, family: literalFamily }] };
  }
  let resolved;
  try {
    resolved = await resolveHost(hostname);
  } catch (error) {
    throw new Error(`source host could not be resolved: ${hostname} (${error.code || error.message})`);
  }
  const answers = Array.isArray(resolved) ? resolved : [resolved];
  const addresses = answers
    .map((entry) => (typeof entry === 'string'
      ? { address: entry, family: net.isIP(entry) }
      : { address: entry?.address, family: entry?.family || net.isIP(entry?.address) }))
    .filter((entry) => entry.address);
  if (!addresses.length) throw new Error(`source host could not be resolved: ${hostname}`);
  for (const entry of addresses) checkAddress(entry.address);
  return { url: parsed, hostname, addresses };
}

async function assertSafeSourceUrl(rawUrl, options = {}) {
  return (await resolveSourceTarget(rawUrl, options)).url;
}

// node:http(s) calls `lookup` at connect time; returning the validated address
// here means the connection can never be pointed at a freshly rebound host.
function createPinnedLookup(addresses) {
  const pinned = addresses.map(({ address, family }) => ({ address, family: family || net.isIP(address) }));
  return function pinnedLookup(hostname, options, callback) {
    const requestedFamily = typeof options === 'number' ? options : options?.family;
    const matching = requestedFamily ? pinned.filter((entry) => entry.family === requestedFamily) : pinned;
    if (!matching.length) {
      callback(Object.assign(new Error(`source host is not allowed: ${hostname}`), { code: 'EAI_AGAIN' }));
      return;
    }
    if (typeof options === 'object' && options?.all) {
      callback(null, matching.map((entry) => ({ ...entry })));
      return;
    }
    callback(null, matching[0].address, matching[0].family);
  };
}

function headerLookup(rawHeaders) {
  const normalized = new Map();
  for (const [name, value] of Object.entries(rawHeaders || {})) {
    normalized.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value ?? ''));
  }
  return { get: (name) => normalized.get(String(name).toLowerCase()) ?? null };
}

async function inflateOrRaw(body) {
  try {
    return await inflate(body);
  } catch {
    return inflateRaw(body);
  }
}

async function decodeBody(body, encodingHeader) {
  const encodings = String(encodingHeader || '')
    .toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item !== 'identity');
  let decoded = body;
  for (const encoding of encodings.reverse()) {
    if (encoding === 'gzip' || encoding === 'x-gzip') decoded = await gunzip(decoded);
    else if (encoding === 'deflate') decoded = await inflateOrRaw(decoded);
    else if (encoding === 'br') decoded = await brotliDecompress(decoded);
  }
  return decoded;
}

function collectResponse({ url, addresses, headers, timeoutMs = TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const options = {
      agent: false,
      headers: { 'accept-encoding': ACCEPT_ENCODING, ...headers },
      lookup: net.isIP(hostname) ? undefined : createPinnedLookup(addresses),
    };
    let request;
    try {
      request = client.request(url, options);
    } catch (error) {
      reject(error);
      return;
    }
    let timer;
    const fail = (error) => {
      clearTimeout(timer);
      request.destroy();
      reject(error);
    };
    timer = setTimeout(() => {
      fail(Object.assign(new Error(`source request timed out after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }));
    }, timeoutMs);
    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.on('response', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      response.on('end', () => {
        clearTimeout(timer);
        resolve({
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          rawHeaders: response.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    request.end();
  });
}

// Default transport: connect to the validated IP, keep Host/SNI on the hostname
// and TLS certificate verification enabled, then decompress the response body.
async function pinnedTransport(request) {
  const raw = await collectResponse(request);
  const decoded = await decodeBody(raw.body, raw.rawHeaders?.['content-encoding']);
  const status = raw.statusCode;
  return {
    status,
    statusText: raw.statusMessage || '',
    ok: status >= 200 && status < 300,
    headers: headerLookup(raw.rawHeaders),
    body: decoded,
    text: async () => decoded.toString('utf8'),
    json: async () => JSON.parse(decoded.toString('utf8')),
  };
}

async function requestWithRedirects(target, headers, options = {}) {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await sourceTransport({
      url: current.url,
      addresses: current.addresses,
      headers,
      timeoutMs: TIMEOUT_MS,
    });
    const location = response.headers?.get?.('location');
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (hop === MAX_REDIRECTS) {
        throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
      }
      current = await resolveSourceTarget(new URL(location, current.url), options);
      continue;
    }
    return { response, finalUrl: current.url };
  }
  throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
}

async function fetchDocument(url, options = {}) {
  const target = await resolveSourceTarget(url, options);
  const { response, finalUrl } = await requestWithRedirects(target, { 'user-agent': USER_AGENT }, options);
  if (!response.ok) {
    throw new Error(`source fetch failed: ${response.status} ${response.statusText}`);
  }
  return { response, finalUrl };
}

async function fetchJson(url) {
  const target = await resolveSourceTarget(url);
  const { response } = await requestWithRedirects(target, { 'user-agent': SEARCH_USER_AGENT });
  if (!response.ok) throw new Error(`search request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export {
  assertSafeSourceUrl, fetchDocument, fetchJson, resolveSourceTarget,
  setSourceResolver, setSourceTransport,
};
