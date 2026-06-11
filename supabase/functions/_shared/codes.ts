// Access codes: GS-XXXX-XXXX from an unambiguous 31-char alphabet
// (no 0/O/1/I/L). ~31^8 ≈ 2^39.6 — plenty against online guessing.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateCode(): string {
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[buf[i] % 31];
  return `GS-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[\s-]/g, '');
}

// Compare via SHA-256 digests so the comparison itself can't leak
// positional information about the stored code.
export async function codesMatch(stored: string, given: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(normalizeCode(stored))),
    crypto.subtle.digest('SHA-256', enc.encode(normalizeCode(given))),
  ]);
  const ua = new Uint8Array(a), ub = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}
