export const CODING_CONTRACT_ANSWERS_TOTALWAYSTOSUM = {
  'Total Ways to Sum': (n: number): number => {
    const ways: number[] = Array(n + 1).fill(0);
    ways[0] = 1;
    for (let i = 1; i < n; i++) {
      for (let j = i; j <= n; j++) {
        ways[j] += ways[j - i];
      }
    }
    return ways[n];
  },
  'Total Ways to Sum II': (data: [number, number[]]): number => {
    const n = data[0];
    const s = data[1];
    const ways: number[] = Array(n + 1).fill(0);
    ways[0] = 1;
    for (const coin of s) {
      for (let j = coin; j <= n; j++) {
        ways[j] += ways[j - coin];
      }
    }
    return ways[n];
  },
} as Record<string, (data: unknown) => unknown>;
