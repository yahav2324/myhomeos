import { createHash, randomInt, randomBytes } from 'crypto';

export function generateOtp6(): string {
  // 100000..999999
  const n = randomInt(100000, 1000000);
  return String(n);
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function makeOtpHash(code: string, phoneE164: string, pepper: string): string {
  // bind to phone so code reuse across phones is useless
  return sha256(`${pepper}:${phoneE164}:${code}`);
}

export function makeRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function makeRefreshTokenHash(token: string, pepper: string): string {
  return sha256(`${pepper}:refresh:${token}`);
}
