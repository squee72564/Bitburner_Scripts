function bigintSqrtNearest(n: bigint): bigint {
  if (n < 0n) return 0n;
  if (n < 2n) return n;
  let low = 0n;
  let high = n;
  while (low <= high) {
    const mid = (low + high) >> 1n;
    const sq = mid * mid;
    if (sq === n) return mid;
    if (sq < n) low = mid + 1n;
    else high = mid - 1n;
  }
  const lower = high;
  const upper = low;
  const lowerDiff = n - lower * lower;
  const upperDiff = upper * upper - n;
  return lowerDiff <= upperDiff ? lower : upper;
}

export const CODING_CONTRACT_ANSWERS_SQUAREROOT = {
  'Square Root': (data: bigint): bigint => {
    return bigintSqrtNearest(data);
  },
} as Record<string, (data: unknown) => unknown>;
