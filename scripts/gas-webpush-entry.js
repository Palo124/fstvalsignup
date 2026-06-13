import EC from 'elliptic';

const ec = new EC.ec('p256');

function base64Url(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '';
    result += i + 2 < bytes.length ? chars[c & 63] : '';
  }
  return result;
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8Bytes(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }
  const bytes = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(bytes);
}

function signEs256Jwt(header, payload, privateKeyBytes) {
  const unsigned = `${base64Url(utf8Bytes(JSON.stringify(header)))}.${base64Url(utf8Bytes(JSON.stringify(payload)))}`;
  const key = ec.keyFromPrivate(privateKeyBytes);
  const sig = key.sign(unsigned, { canonical: true });
  const r = sig.r.toArray('be', 32);
  const s = sig.s.toArray('be', 32);
  const signature = new Uint8Array(64);
  signature.set(r, 32 - r.length);
  signature.set(s, 64 - s.length);
  return `${unsigned}.${base64Url(signature)}`;
}

function audienceFromEndpoint(endpoint) {
  const match = /^([^:]+:\/\/[^/]+)/.exec(endpoint);
  if (!match) throw new Error(`Invalid push endpoint: ${endpoint}`);
  return match[1];
}

function futureExpiration(seconds = 12 * 60 * 60) {
  return Math.floor(Date.now() / 1000) + seconds;
}

export function buildEmptyPushRequest(subscription, vapidPublicKey, vapidPrivateKey, subject = 'mailto:planner@b4l.local') {
  const jwt = signEs256Jwt(
    { typ: 'JWT', alg: 'ES256' },
    {
      aud: audienceFromEndpoint(subscription.endpoint),
      exp: futureExpiration(),
      sub: subject,
    },
    base64UrlDecode(vapidPrivateKey),
  );

  return {
    endpoint: subscription.endpoint,
    method: 'POST',
    headers: {
      TTL: '120',
      'Content-Length': '0',
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      Urgency: 'normal',
    },
    body: '',
  };
}
