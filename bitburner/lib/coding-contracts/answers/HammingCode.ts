function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function hammingEncode(value: number): string {
  const dataBits = value
    .toString(2)
    .split('')
    .reverse()
    .map((b) => Number(b));
  const encoded: number[] = [];
  let dataIndex = 0;

  for (let i = 1; dataIndex < dataBits.length; i++) {
    if (isPowerOfTwo(i)) {
      encoded[i] = 0;
    } else {
      encoded[i] = dataBits[dataIndex++];
    }
  }

  const maxIndex = encoded.length - 1;
  for (let p = 1; p <= maxIndex; p <<= 1) {
    let parity = 0;
    for (let i = p; i <= maxIndex; i++) {
      if (i & p) parity ^= encoded[i] ?? 0;
    }
    encoded[p] = parity;
  }

  let overall = 0;
  for (let i = 1; i <= maxIndex; i++) overall ^= encoded[i] ?? 0;
  const out: number[] = [overall];
  for (let i = 1; i <= maxIndex; i++) out.push(encoded[i] ?? 0);
  return out.join('');
}

function hammingDecode(bits: string): number {
  const arr = bits.split('').map((b) => Number(b));
  const overall = arr[0];
  const data = arr.slice(1);
  let syndrome = 0;
  for (let p = 1; p <= data.length; p <<= 1) {
    let parity = 0;
    for (let i = p; i <= data.length; i++) {
      if (i & p) parity ^= data[i - 1] ?? 0;
    }
    if (parity !== 0) syndrome += p;
  }
  if (syndrome > 0 && syndrome <= data.length) {
    data[syndrome - 1] ^= 1;
  }
  // optional overall parity check (ignored for decode)
  void overall;

  const extracted: number[] = [];
  for (let i = 1; i <= data.length; i++) {
    if (!isPowerOfTwo(i)) extracted.push(data[i - 1]);
  }
  const bin = extracted.reverse().join('') || '0';
  return parseInt(bin, 2);
}

export const CODING_CONTRACT_ANSWERS_HAMMINGCODE = {
  'HammingCodes: Integer to Encoded Binary': (data: number): string => {
    return hammingEncode(data);
  },
  'HammingCodes: Encoded Binary to Integer': (data: string): number => {
    return hammingDecode(data);
  },
} as Record<string, (data: unknown) => unknown>;
