export const CODING_CONTRACT_ANSWERS_UNIQUEPATHSINAGRID = {
  'Unique Paths in a Grid I': (data: [number, number]): number => {
    const [m, n] = data;
    const dp = Array(n).fill(1);
    for (let i = 1; i < m; i++) {
      for (let j = 1; j < n; j++) {
        dp[j] += dp[j - 1];
      }
    }
    return dp[n - 1];
  },
  'Unique Paths in a Grid II': (grid: (0 | 1)[][]): number => {
    const rows = grid.length;
    const cols = grid[0].length;
    const dp = Array(cols).fill(0);
    dp[0] = grid[0][0] === 0 ? 1 : 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 1) {
          dp[c] = 0;
        } else if (c > 0) {
          dp[c] += dp[c - 1];
        }
      }
    }
    return dp[cols - 1];
  },
} as Record<string, (data: unknown) => unknown>;
