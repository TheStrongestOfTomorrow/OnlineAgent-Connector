'use strict';

/**
 * Crypto / hashing tools.
 *   - crypto.hash    -> compute hash (md5, sha1, sha256, sha512)
 *   - crypto.uuid    -> generate UUID v4
 *   - crypto.random  -> generate random bytes (hex / base64)
 *   - crypto.hmac    -> compute HMAC
 */

const crypto = require('crypto');

const ALLOWED_ALGOS = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'ripemd160'];

class CryptoAPI {
  hash({ algorithm = 'sha256', input, encoding = 'hex' } = {}) {
    if (!ALLOWED_ALGOS.includes(algorithm)) {
      throw new Error(`Unsupported algorithm. Allowed: ${ALLOWED_ALGOS.join(', ')}`);
    }
    if (typeof input !== 'string') throw new Error('params.input (string) required');
    const h = crypto.createHash(algorithm);
    h.update(input, 'utf8');
    const digestBuf = h.digest();
    return {
      algorithm,
      digest: digestBuf.toString(encoding),
      length: digestBuf.length,
    };
  }

  uuid() {
    return { uuid: crypto.randomUUID() };
  }

  random({ bytes = 16, encoding = 'hex' } = {}) {
    if (bytes < 1 || bytes > 1024) throw new Error('bytes must be 1..1024');
    const buf = crypto.randomBytes(bytes);
    return {
      bytes,
      encoding,
      value: buf.toString(encoding),
    };
  }

  hmac({ algorithm = 'sha256', key, message, encoding = 'hex' } = {}) {
    if (!ALLOWED_ALGOS.includes(algorithm)) throw new Error('Unsupported algorithm');
    if (typeof key !== 'string' || typeof message !== 'string') {
      throw new Error('params.key and params.message (string) required');
    }
    const h = crypto.createHmac(algorithm, key);
    h.update(message, 'utf8');
    return { algorithm, digest: h.digest(encoding) };
  }

  base64Encode({ input } = {}) {
    if (typeof input !== 'string') throw new Error('params.input (string) required');
    return { encoded: Buffer.from(input, 'utf8').toString('base64') };
  }

  base64Decode({ input } = {}) {
    if (typeof input !== 'string') throw new Error('params.input (string) required');
    return { decoded: Buffer.from(input, 'base64').toString('utf8') };
  }
}

module.exports = CryptoAPI;
