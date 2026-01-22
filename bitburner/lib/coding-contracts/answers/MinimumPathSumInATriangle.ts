export const CODING_CONTRACT_ANSWERS_MINIMUMPATHSUMINATRIANGLE = {
  'Minimum Path Sum in a Triangle': (triangle: number[][]): number => {
    const dp = triangle[triangle.length - 1].slice();
    for (let i = triangle.length - 2; i >= 0; i--) {
      for (let j = 0; j < triangle[i].length; j++) {
        dp[j] = triangle[i][j] + Math.min(dp[j], dp[j + 1]);
      }
    }
    return dp[0];
  },
} as Record<string, (data: unknown) => unknown>;
