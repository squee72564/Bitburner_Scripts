function isValidOctet(s: string): boolean {
  if (s.length === 0 || s.length > 3) return false;
  if (s.length > 1 && s[0] === '0') return false;
  const val = Number(s);
  return val >= 0 && val <= 255;
}

export const CODING_CONTRACT_ANSWERS_GENERATEIPADDRESSES = {
  'Generate IP Addresses': (data: string): string[] => {
    const res: string[] = [];
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= 3; j++) {
        for (let k = 1; k <= 3; k++) {
          for (let l = 1; l <= 3; l++) {
            if (i + j + k + l !== data.length) continue;
            const a = data.slice(0, i);
            const b = data.slice(i, i + j);
            const c = data.slice(i + j, i + j + k);
            const d = data.slice(i + j + k);
            if (isValidOctet(a) && isValidOctet(b) && isValidOctet(c) && isValidOctet(d)) {
              res.push(`${a}.${b}.${c}.${d}`);
            }
          }
        }
      }
    }
    return res;
  },
} as Record<string, (data: unknown) => unknown>;
