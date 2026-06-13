import EC from 'elliptic';
import { gcm } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';

const ec = new EC.ec('p256');
const KEY_LENGTH = 16;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const RECORD_SIZE = 4096;

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

function concatBytes(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function hmacSha256(key, input) {
  return hmac(sha256, key, input);
}

function hkdfExtract(salt, ikm) {
  return hmacSha256(salt, ikm);
}

function hkdfExpand(prk, info, length) {
  const infoBytes = typeof info === 'string' ? utf8Bytes(info) : info;
  const output = [];
  let previous = new Uint8Array(0);
  let counter = 1;

  while (output.length < length) {
    previous = hmacSha256(prk, concatBytes(previous, infoBytes, new Uint8Array([counter])));
    output.push(...previous);
    counter += 1;
  }

  return new Uint8Array(output.slice(0, length));
}

function hkdf(salt, ikm, info, length) {
  return hkdfExpand(hkdfExtract(salt, ikm), info, length);
}

function createLocalKeyPair() {
  return ec.genKeyPair();
}

function publicKeyBytes(keyPair) {
  return new Uint8Array(keyPair.getPublic().encode('array', false));
}

function sharedSecret(localKeyPair, remotePublicKey) {
  const remoteKey = ec.keyFromPublic(Array.from(remotePublicKey));
  return new Uint8Array(localKeyPair.derive(remoteKey.getPublic()).toArray('be', 32));
}

function webPushSecret(authSecret, localKeyPair, userPublicKey) {
  const localPublicKey = publicKeyBytes(localKeyPair);
  const ecdhSecret = sharedSecret(localKeyPair, userPublicKey);
  const info = concatBytes(utf8Bytes('WebPush: info'), new Uint8Array([0]), userPublicKey, localPublicKey);
  return hkdf(authSecret, ecdhSecret, info, 32);
}

function deriveKeyAndNonce(salt, secret) {
  const prk = hkdfExtract(salt, secret);
  const key = hkdfExpand(prk, utf8Bytes('Content-Encoding: aes128gcm\0'), KEY_LENGTH);
  const nonce = hkdfExpand(prk, utf8Bytes('Content-Encoding: nonce\0'), NONCE_LENGTH);
  return { key, nonce };
}

function writeHeader(salt, recordSize, keyId) {
  const header = new Uint8Array(21 + keyId.length);
  header.set(salt, 0);
  header[16] = (recordSize >>> 24) & 0xff;
  header[17] = (recordSize >>> 16) & 0xff;
  header[18] = (recordSize >>> 8) & 0xff;
  header[19] = recordSize & 0xff;
  header[20] = keyId.length;
  header.set(keyId, 21);
  return header;
}

function encryptPayload(plaintext, userPublicKey, authSecret) {
  const localKeyPair = createLocalKeyPair();
  const salt = randomBytes(KEY_LENGTH);
  const localPublicKey = publicKeyBytes(localKeyPair);
  const secret = webPushSecret(authSecret, localKeyPair, userPublicKey);
  const { key, nonce } = deriveKeyAndNonce(salt, secret);
  const padding = new Uint8Array(1);
  padding[0] = 2;
  const cipher = gcm(key, nonce);
  const encrypted = cipher.encrypt(concatBytes(plaintext, padding));
  return concatBytes(writeHeader(salt, RECORD_SIZE, localPublicKey), encrypted);
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

function buildVapidHeaders(subscription, vapidPublicKey, vapidPrivateKey, subject) {
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
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    Urgency: 'high',
    TTL: '86400',
  };
}

export function buildPushRequest(
  subscription,
  vapidPublicKey,
  vapidPrivateKey,
  payload,
  subject = 'mailto:planner@b4l.local',
) {
  const headers = buildVapidHeaders(subscription, vapidPublicKey, vapidPrivateKey, subject);
  if (!payload) {
    return {
      endpoint: subscription.endpoint,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': '0',
      },
      body: '',
    };
  }

  const userPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);
  if (userPublicKey.length !== 65) {
    throw new Error('Subscription p256dh must decode to 65 bytes.');
  }
  if (authSecret.length < 16) {
    throw new Error('Subscription auth must be at least 16 bytes.');
  }

  const bodyBytes = encryptPayload(utf8Bytes(payload), userPublicKey, authSecret);
  const body = Array.from(bodyBytes, (byte) => String.fromCharCode(byte)).join('');

  return {
    endpoint: subscription.endpoint,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bodyBytes.length),
    },
    body,
  };
}

export function buildEmptyPushRequest(subscription, vapidPublicKey, vapidPrivateKey, subject = 'mailto:planner@b4l.local') {
  return buildPushRequest(subscription, vapidPublicKey, vapidPrivateKey, null, subject);
}
