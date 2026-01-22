function comprLZEncode(plain: string): string {
  let curState: (string | null)[][] = Array.from({ length: 10 }, () => Array(10).fill(null));
  let newState: (string | null)[][] = Array.from({ length: 10 }, () => Array(10).fill(null));

  function set(state: (string | null)[][], i: number, j: number, str: string): void {
    const current = state[i][j];
    if (current == null || str.length < current.length) {
      state[i][j] = str;
    }
  }

  curState[0][1] = '';

  for (let i = 1; i < plain.length; i++) {
    for (const row of newState) row.fill(null);
    const c = plain[i];

    // literals
    for (let length = 1; length <= 9; ++length) {
      const str = curState[0][length];
      if (str == null) continue;
      if (length < 9) {
        set(newState, 0, length + 1, str);
      } else {
        set(newState, 0, 1, str + '9' + plain.substring(i - 9, i) + '0');
      }
      for (let offset = 1; offset <= Math.min(9, i); ++offset) {
        if (plain[i - offset] === c) {
          set(newState, offset, 1, str + String(length) + plain.substring(i - length, i));
        }
      }
    }

    // backrefs
    for (let offset = 1; offset <= 9; ++offset) {
      for (let length = 1; length <= 9; ++length) {
        const str = curState[offset][length];
        if (str == null) continue;

        if (plain[i - offset] === c) {
          if (length < 9) {
            set(newState, offset, length + 1, str);
          } else {
            set(newState, offset, 1, str + '9' + String(offset) + '0');
          }
        }

        set(newState, 0, 1, str + String(length) + String(offset));

        for (let newOffset = 1; newOffset <= Math.min(9, i); ++newOffset) {
          if (plain[i - newOffset] === c) {
            set(newState, newOffset, 1, str + String(length) + String(offset) + '0');
          }
        }
      }
    }

    const tmp = newState;
    newState = curState;
    curState = tmp;
  }

  let result: string | null = null;
  for (let len = 1; len <= 9; ++len) {
    const str = curState[0][len];
    if (str == null) continue;
    const candidate = str + String(len) + plain.substring(plain.length - len, plain.length);
    if (result == null || candidate.length < result.length) result = candidate;
  }
  for (let offset = 1; offset <= 9; ++offset) {
    for (let len = 1; len <= 9; ++len) {
      const str = curState[offset][len];
      if (str == null) continue;
      const candidate = str + String(len) + String(offset);
      if (result == null || candidate.length < result.length) result = candidate;
    }
  }

  return result ?? '';
}

function comprLZDecode(compr: string): string | null {
  let plain = '';
  for (let i = 0; i < compr.length; ) {
    const literalLength = compr.charCodeAt(i) - 0x30;
    if (literalLength < 0 || literalLength > 9 || i + 1 + literalLength > compr.length) return null;
    plain += compr.substring(i + 1, i + 1 + literalLength);
    i += 1 + literalLength;
    if (i >= compr.length) break;

    const backrefLength = compr.charCodeAt(i) - 0x30;
    if (backrefLength < 0 || backrefLength > 9) return null;
    if (backrefLength === 0) {
      ++i;
    } else {
      if (i + 1 >= compr.length) return null;
      const backrefOffset = compr.charCodeAt(i + 1) - 0x30;
      if ((backrefOffset < 1 || backrefOffset > 9) && backrefLength > 0) return null;
      if (backrefOffset > plain.length) return null;
      for (let j = 0; j < backrefLength; ++j) {
        plain += plain[plain.length - backrefOffset];
      }
      i += 2;
    }
  }
  return plain;
}

export const CODING_CONTRACT_ANSWERS_COMPRESSION = {
  'Compression I: RLE Compression': (plain: string): string => {
    if (plain.length === 0) return '';
    let out = '';
    let count = 1;
    for (let i = 1; i < plain.length; i++) {
      if (count < 9 && plain[i] === plain[i - 1]) {
        count++;
        continue;
      }
      out += count + plain[i - 1];
      count = 1;
    }
    out += count + plain[plain.length - 1];
    return out;
  },
  'Compression II: LZ Decompression': (compr: string): string => {
    return comprLZDecode(compr) ?? '';
  },
  'Compression III: LZ Compression': (plain: string): string => {
    return comprLZEncode(plain);
  },
} as Record<string, (data: unknown) => unknown>;
